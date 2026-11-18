# Runbook Operasional PortSight R4 (DOC-03)

Dokumen ini berisi prosedur standar operasional (SOP) untuk tim DevOps, Administrator Sistem, dan Tim ICT PT Pelabuhan Indonesia (Persero) Regional 4.

---

## 1. Arsitektur & Lingkungan Layanan

- **Aplikasi**: Next.js 15 (Node.js runtime, standalone production build)
- **Basis Data**: PostgreSQL 16 (Container `ed_dashboard-postgres` pada port 5432)
- **Autentikasi**: JWT HttpOnly Cookies (`portsight_access_token`, `portsight_refresh_token`) + Session Revocation table (`auth_sessions`)
- **Port Layanan**: `3000` (Web UI/API)
- **Container PostgreSQL**: `ed_dashboard-postgres` (`5432:5432`)

---

## 2. Prosedur Backup & Restore Basis Data PostgreSQL

### 2.1 Backup Rutin Manual
Jalankan perintah berikut untuk mengekspor dump data PostgreSQL lengkap:
```bash
# Backup format custom compressed
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
docker exec -t ed_dashboard-postgres pg_dump -U postgres -d ed_dashboard -Fc > "backups/backup_ed_dashboard_${TIMESTAMP}.dump"

# Backup format SQL plaintext
docker exec -t ed_dashboard-postgres pg_dump -U postgres -d ed_dashboard --clean --if-exists > "backups/backup_ed_dashboard_${TIMESTAMP}.sql"
```

### 2.2 Restore dari Berkas Backup
Untuk memulihkan database dari snapshot dump:
```bash
# 1. Hentikan aplikasi atau putuskan koneksi aktif
docker exec -it ed_dashboard-postgres psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'ed_dashboard' AND pid <> pg_backend_pid();"

# 2. Restore basis data dari format custom (.dump)
docker exec -i ed_dashboard-postgres pg_restore -U postgres -d ed_dashboard --clean --if-exists < "backups/backup_target.dump"

# 3. Jalankan verifikasi integritas data
npm run verify
```

---

## 3. Prosedur Rotasi Secret & Kredensial

Sistem PortSight R4 menggunakan dua secret kriptografis utama di dalam file `.env`:
- `JWT_SECRET`: Kunci simetris penandatanganan token JWT (HS256).
- `SECRETS_ENCRYPTION_KEY`: Kunci AES-256-GCM 32-byte (64-karakter hex) untuk enkripsi kredensial integrasi.

### 3.1 Prosedur Rotasi `JWT_SECRET`
1. Generate secret acak baru:
   ```bash
   node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
   ```
2. Perbarui nilai `JWT_SECRET` di berkas `.env`.
3. Restart server Next.js:
   ```bash
   npm run build && pm2 restart ed-dashboard || kill -HUP <pid>
   ```
4. **Dampak Operasional**: Seluruh sesi aktif pengguna akan terputus (logout otomatis) dan pengguna diminta masuk kembali dengan kata sandi mereka.

### 3.2 Prosedur Rotasi `SECRETS_ENCRYPTION_KEY`
1. Dekripsi data integrasi yang ada terlebih dahulu atau catat kredensial Google Drive/Sheets.
2. Buat kunci 32-byte baru di `.env`.
3. Simpan kembali kredensial integrasi melalui menu **Master Data > Parameter Sistem**.

---

## 4. Penanganan Insiden & Pemulihan Akun Terkunci

### 4.1 Pemulihan Akun Terkunci Karena Salah Kata Sandi
Sistem menerapkan rate limiting ketat: 5 kali percobaan gagal berturut-turut mengunci akun selama 15 menit.
Jika akun pengguna operasional terkunci dan membutuhkan pembukaan darurat:

1. Periksa catatan rate limit di PostgreSQL:
   ```bash
   docker exec -it ed_dashboard-postgres psql -U postgres -d ed_dashboard -c \
     "SELECT * FROM auth_rate_limits WHERE key LIKE '%<nipp>%';"
   ```
2. Hapus batas blokir untuk NIPP tersebut:
   ```bash
   docker exec -it ed_dashboard-postgres psql -U postgres -d ed_dashboard -c \
     "DELETE FROM auth_rate_limits WHERE key LIKE '%<nipp>%';"
   ```
3. Akun dapat langsung mencoba login kembali.

### 4.2 Reset Kata Sandi Pengguna Secara Darurat
Jika Super Admin atau pengguna lupa kata sandi:
1. Jalankan utilitas CLI:
   ```bash
   node scripts/seed_users_postgres.mjs
   ```
2. Atau lakukan reset langsung pada tabel `users` dengan hash scrypt valid dan paksa ubah kata sandi pada login pertama (`must_change_password = true`).

---

## 5. Prosedur Rollback Deploy

Jika rilis baru mengalami anomali di lingkungan produksi:

### 5.1 Rollback Kode Aplikasi
```bash
# 1. Kembali ke tag atau commit stabil sebelumnya
git checkout <stable_tag_or_commit>

# 2. Build ulang aplikasi Next.js
npm ci
npm run build

# 3. Jalankan rangkaian verifikasi
npm run verify

# 4. Restart proses layanan
pm2 restart ed-dashboard
```

### 5.2 Rollback Basis Data
Jika terjadi kesalahan skema atau inkonsistensi data, pulihkan snapshot database yang diambil sebelum rilis menggunakan langkah §2.2.

---

## 6. Diagnosis & Pemeriksaan Kesehatan Layanan

Jalankan perintah berikut untuk memeriksa status layanan:
```bash
# 1. Cek kesehatan container PostgreSQL
docker ps --filter "name=ed_dashboard-postgres"

# 2. Cek uji verifikasi menyeluruh (Typecheck, Linting, Unit Tests, Security Regressions)
npm run verify

# 3. Cek log audit terbaru di database
docker exec -it ed_dashboard-postgres psql -U postgres -d ed_dashboard -c \
  "SELECT timestamp, user_name, user_role, action, entity, ip_address FROM audit_logs ORDER BY timestamp DESC LIMIT 10;"
```

