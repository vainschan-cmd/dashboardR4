# Pelindo Regional 4 – Executive Dashboard (PortDash R4)
**Platform Web Desktop & Mobile Konsolidasi Kinerja Regional & 28 Cabang Pelabuhan**

---

## 1. Ikhtisar Arsitektur Aplikasi
**PortDash Regional 4** adalah portal intelijen bisnis eksekutif dan manajemen tata kelola data kinerja pelabuhan PT Pelabuhan Indonesia (Persero) Regional 4. Sistem ini mengintegrasikan data dari 28 cabang pelabuhan aktif yang mencakup modul:
- **Beranda Eksekutif**: Konsolidasi metrik finansial, operasional, fasilitas, dan peralatan pelabuhan.
- **Finansial (Keuangan)**: Pendapatan, Beban Pokok Operasi, Laba Usaha, Laba Bersih, dan EBITDA konsolidasi per cabang dan entitas anak/afiliasi (PMT, PTP, PSL, PJM).
- **Opkom (Operasi & Komersial)**: Realisasi pendapatan dan trafik layanan kapal, petikemas, barang curah/general cargo, penumpang, dan rupa-rupa usaha.
- **Kinerja Operasional**: Indikator kinerja pelayanan (WTP, ET:BT, BSH, BCH, TGH, TSD).
- **Utilisasi Dermaga & Lapangan**: BOR (Berth Occupancy Ratio), YOR (Yard Occupancy Ratio), dan SOR (Shed Occupancy Ratio).
- **Peralatan Pelabuhan**: Kesiapan peralatan (RFU - Ready For Use), populasi armada (QCC, HMC, RTG, Reach Stacker, Forklift, Head Truck, Tugboat, Pilot Boat), dan utilisasi jam kerja.
- **Fasilitas & Infrastruktur**: Inventaris dermaga, lapangan penumpukan, gudang, alur pelayaran, kedalaman kolam (mLWS), dan panjang fasilitas.
- **Data Governance Suite**: Rekaman data kinerja (raw data), verifikasi & pengesahan berjenjang, studio pemetaan template dinamis, pusat impor spreadsheet, master data pengguna, dan jejak audit (audit trail).

---

## 2. Pengamanan & Tata Kelola Keamanan (Security Hardening)

### Autentikasi & Sesi
- **JWT HttpOnly Cookie**: Token akses disimpan pada cookie `portsight_access_token` dan token penyegar pada `portsight_refresh_token`. Keduanya `HttpOnly`; `Secure` aktif di produksi; akses `SameSite=Lax`, refresh `SameSite=Strict`.
- **Prefiks `__Host-` di produksi**: nama cookie menjadi `__Host-portsight_access_token` dan `__Host-portsight_refresh_token`. Browser menolak cookie `__Host-` yang tidak `Secure`, yang `Path`-nya bukan `/`, atau yang membawa atribut `Domain`, sehingga cookie tidak dapat ditanam dari subdomain lain. Nama lama tetap dibaca agar upgrade tidak memaksa login ulang.
- **TTL token**: access token **15 menit** dan diperbarui otomatis oleh klien (`GET /api/users/me?rotate=1`) selama pengguna aktif; refresh token 7 hari. `exp` pada JWT selalu sama dengan `maxAge` cookie.
- **Idle timeout ditegakkan di server**: `auth_sessions.last_seen_at` dibandingkan dengan `session_timeout_minutes`; sesi yang melewati batas idle dicabut (`revoked_reason = idle_timeout`) meskipun token belum kedaluwarsa. Hitung mundur di klien hanya lapisan UX.
- **Validasi Kunci Rahasia JWT**: `JWT_SECRET` wajib ≥ 32 karakter. Konfigurasi produksi ditolak bila kunci tidak tersedia atau terlalu lemah.
- **Registri Sesi Server-Side**: Setiap token dicatat pada tabel `auth_sessions` (`jti`, `expires_at`, `revoked_at`, `token_version`). Logout, rotasi token, perubahan kata sandi, perubahan role/scope, dan penonaktifan akun **mencabut sesi secara nyata**.
- **Rotasi & Deteksi Reuse Refresh Token**: Refresh token sekali pakai. Pemakaian ulang token yang sudah dirotasi mencabut seluruh sesi pengguna dan dicatat di audit log.
- **Idle Timeout**: ditegakkan di server melalui `auth_sessions.last_seen_at` (lihat bagian di atas); klien hanya menampilkan hitung mundur dan melakukan logout lebih awal.
- **Rate Limiting Login Berlapis**: Tabel persisten `auth_rate_limits` membatasi percobaan per pasangan IP+NIPP (5 kali / 15 menit) **dan** per IP (20 kali / 15 menit) agar tidak dapat diakali dengan mengganti NIPP.
- **Anti-Enumerasi Akun**: Pesan dan status respons login disamakan; percobaan untuk NIPP yang tidak ada tetap menjalankan verifikasi hash agar waktu respons serupa.
- **Proteksi CSRF**: Proxy menolak request mutasi dengan `Origin` asing atau `Sec-Fetch-Site: cross-site`. Daftar origin tambahan dapat diatur melalui `CSRF_TRUSTED_ORIGINS`.
- **Kredensial Awal Tidak Hardcoded**: Tidak ada kata sandi default di kode. Produksi wajib mengisi `BOOTSTRAP_PIC_PASSWORD`; mode pengembangan membuat kata sandi acak per akun dan mencetaknya sekali di log server.
- **Manajemen Kata Sandi**: Kebijakan tunggal di `src/lib/passwordPolicy.ts` (minimal 12 karakter, minimal 6 karakter berbeda, tanpa spasi di ujung). Pengguna dapat mengganti kata sandi sendiri lewat tombol **Kata Sandi** di header; administrator dapat mereset kata sandi pengguna lain lewat Master PIC. Setiap perubahan/reset menaikkan `token_version`, **mencabut seluruh sesi akun tersebut**, dan tercatat di audit log.
- **Wajib Ganti Kata Sandi**: Akun yang kata sandinya ditetapkan administrator, hasil impor spreadsheet, atau hasil migrasi keamanan ditandai `must_change_password`. Modal ubah kata sandi tampil paksa dan tidak dapat ditutup sampai kata sandi diganti.

### Kontrol Akses Berbasis Peran & Atribut (RBAC & ABAC Server-Side)
- Seluruh endpoint API menerapkan verifikasi sesi dan otorisasi di server (`src/proxy.ts` + handler).
- **Default deny**: endpoint API yang belum terdaftar pada daftar kebijakan akan ditolak (403).
  - **BOD / Viewer**: hanya baca, dipaksa membaca rekaman terverifikasi (`verifiedOnly=true`) di semua endpoint data, dan diblokir dari endpoint penulisan.
  - **PIC Cabang**: baca/tulis dibatasi pada cabang penugasan.
  - **PIC Dept Regional**: hanya menerima modul yang menjadi tanggung jawab departemennya.
  - **Admin Regional & Super Admin**: verifikasi, manajemen pengguna, konfigurasi template, dan audit.
- **Eskalasi Privilege Dicegah**: Hanya Super Admin yang dapat membuat/meniadakan role Super Admin, termasuk saat impor spreadsheet pengguna.
- **Konfigurasi Database**: hanya Super Admin; perpindahan path ditolak bila database tujuan tidak ada, belum terinisialisasi, atau tidak memiliki akun.

### Proteksi Impor Data & Integritas Transaksi
- **Parser Spreadsheet Terpantau**: `xlsx@0.20.3` dipasang dari tarball resmi SheetJS (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) karena registry npm berhenti di 0.18.5 tanpa patch untuk advisory *prototype pollution* dan *ReDoS*.
- **Satu Titik Parse**: seluruh pembacaan workbook melalui `src/lib/spreadsheet.ts` (`readWorkbookSafe` + `sheetToRowsChecked`) dengan batas baris, tanpa evaluasi formula, tanpa makro/VBA, dan tanpa objek tertanam.
- **Batas Beban**: impor JSON maksimal 2 MB dan 2.000 baris; unggahan spreadsheet maksimal 5 MB. Berkas yang melebihi 2.000 baris **ditolak** (`413`), tidak dipotong diam-diam.
- **Validasi Skema Input**: setiap rekaman divalidasi dengan Zod terhadap master cabang, departemen, tipe data, dan aturan ABAC.
- **Integritas Transaksi Atomik**: penyimpanan rekaman, batch impor, dan audit log berjalan dalam satu transaksi.
- **Validasi Google Sheets Adapter**: regex untuk Spreadsheet ID, nama sheet, dan range A1, dengan timeout 10 detik.

### Header Keamanan
`Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, dan HSTS (produksi) dikirim dari `next.config.ts`. `X-Powered-By` dinonaktifkan.

### Enkripsi & Logging
- **Enkripsi at-rest**: `pg_password`, `google_api_key`, dan `api_gateway_token` disimpan dengan AES-256-GCM di `data/db_config.json` dan tabel `integration_settings`. Kunci diambil dari `SECRETS_ENCRYPTION_KEY`; bila kosong, diturunkan dari `JWT_SECRET` (dengan peringatan). Migrasi otomatis mengenkripsi nilai plaintext lama sekali saja (`cfg_secrets_encryption`).
- **Logging aman**: `src/lib/logger.ts` meredaksi kata kunci sensitif (`password`, `token`, `secret`, `api_key`, `authorization`, `cookie`, `jti`) sebelum menulis log, memotong nilai panjang, dan menambahkan `x-request-id` pada setiap respons API untuk penelusuran tanpa membocorkan kredensial.
- **Secret scanning**: `.gitleaks.toml` + job `secret-scan` pada CI memindai seluruh riwayat git (`fetch-depth: 0`).
- **Housekeeping**: sesi kedaluwarsa dan entri rate limit basi dibersihkan otomatis maksimum sekali per jam (`purgeStaleAuthData`), sehingga tabel autentikasi tidak tumbuh tanpa batas.

### Pengujian

| Perintah | Cakupan | Durasi |
|---|---|---|
| `npm test` | **157 unit test** (Vitest): RBAC, validasi Zod, enkripsi, redaksi log, spreadsheet, periode | ~0,5 detik |
| `npm run test:security` | **32 pengujian integrasi** terhadap server berjalan: login, sesi, CSRF, scope cabang, impor | ~5 detik |
| `npm run verify` | typecheck → lint (`--max-warnings 0`) → unit → integrasi | — |

Unit test tidak memerlukan server, basis data, atau kredensial. Uji integrasi memerlukan `TEST_PIC_PASSWORD` atau `TEST_PIC_PASSWORDS` (lihat `scripts/regression-test.mjs`).

### Backup & Pemulihan
`npm run backup` membuat snapshot konsisten (`VACUUM INTO`, bukan `cp` yang dapat kehilangan isi WAL) beserta manifest SHA-256; `npm run restore -- <berkas>` memvalidasi `integrity_check` lalu menyimpan basis data lama sebagai `*.pre-restore-*`. Prosedur lengkap, jadwal retensi, dan hasil drill ada di [`docs/operations/BACKUP-RESTORE.md`](docs/operations/BACKUP-RESTORE.md).

### Catatan Risiko yang Diketahui
- CSP saat ini masih memakai `'unsafe-inline'` untuk skrip karena Next.js menyuntikkan bootstrap inline; target berikutnya adalah CSP berbasis nonce.
- `node:sqlite` bersifat sinkron dan berjalan dalam proses; sebelum beban multi-pengguna nyata, evaluasi migrasi ke PostgreSQL (lihat `docs/architecture/POSTGRESQL.md`).


---

## 3. Matriks Hak Akses Peran Pengguna (RBAC Matrix)

| Peran (Role) | Beranda & Modul Kinerja | Input Data Manual | Impor Spreadsheet | Verifikasi & Pengesahan | Master PIC & Parameter | Jejak Audit |
|---|---|---|---|---|---|---|
| **BOD (Viewer)** | Hanya Baca (Data Terverifikasi) | Ditolak | Ditolak | Ditolak | Ditolak | Ditolak |
| **PIC Cabang** | Baca (Cabang Terkait) | Cabang Terkait | Cabang Terkait | Memantau Status | Ditolak | Ditolak |
| **PIC Dept Regional** | Baca (Seluruh Wilayah) | Departemen Terkait | Departemen Terkait | Memantau Status | Ditolak | Ditolak |
| **Admin Regional 4** | Baca & Analisis Penuh | Seluruh Cabang | Seluruh Cabang | Mengesahkan & Minta Revisi | Kelola Master Data | Baca Seluruh Log |
| **Super Admin** | Akses Penuh Sistem | Seluruh Cabang | Seluruh Cabang | Akses Penuh | Kelola Akun & Sistem | Akses Penuh |

---

## 4. Konfigurasi Lingkungan (.env)

Salin berkas `.env.example` ke `.env.local` atau `.env` sebelum menjalankan aplikasi:

```env
# Kunci rahasia JWT wajib diisi minimal 32 karakter untuk produksi.
# Isi dengan nilai acak, mis. `openssl rand -hex 32` — jangan pakai contoh ini.
JWT_SECRET=ganti_dengan_secret_kriptografis_minimal_32_karakter_acak_hs256

# Kunci enkripsi kredensial tersimpan (AES-256-GCM). Kosongkan hanya untuk development.
SECRETS_ENCRYPTION_KEY=

# Wajib di produksi: kata sandi awal akun (minimal 12 karakter).
# Di development boleh kosong; sistem membuat kata sandi acak per akun dan mencetaknya sekali di log.
BOOTSTRAP_PIC_PASSWORD=

# Jalur penyimpanan basis data SQLite
DATABASE_PATH=data/ed_dashboard.db

# Kebijakan pendaftaran publik pengguna (true/false)
ALLOW_PUBLIC_REGISTRATION=false
# Harus sama agar tombol daftar tampil konsisten di UI
NEXT_PUBLIC_ALLOW_PUBLIC_REGISTRATION=false

# Set true hanya jika berjalan di belakang reverse proxy/Cloudflare yang Anda kendalikan
TRUST_PROXY=false
# Origin tambahan yang dipercaya untuk request mutasi (dipisahkan koma)
CSRF_TRUSTED_ORIGINS=

# Opsional: Integrasi Google Sheets API & Gateway
GOOGLE_SHEETS_API_KEY=
PORT=3000
NODE_ENV=development
```

---

## 5. Menjalankan Aplikasi & Pengujian

### Prasyarat
- **Node.js 22.5+** — aplikasi memakai modul bawaan `node:sqlite`
- npm versi 10+

### Instalasi & Menjalankan Mode Pengembang
```bash
# Instalasi dependensi
npm ci

# Jalankan server pengembangan
npm run dev
```
Buka browser pada alamat `http://localhost:3000`.

### Pemeriksaan Kualitas Kode & Tipe Data
```bash
# Pemeriksaan tipe data TypeScript
npm run typecheck

# Linter; warning diperlakukan sebagai kegagalan
npm run lint:ci

# Semua pemeriksaan + uji keamanan
TEST_PIC_PASSWORD=... npm run verify
```

### Menjalankan Rangkaian Uji Regresi Keamanan
Kredensial uji dibaca dari environment (tidak pernah hardcoded):
```bash
# Satu kata sandi untuk semua akun uji:
TEST_PIC_PASSWORD='<kata-sandi-bootstrap>' node scripts/regression-test.mjs

# Bila tiap akun punya kata sandi berbeda (mode development):
TEST_PIC_PASSWORDS='{"10000":"...","10002":"...","10004":"..."}' node scripts/regression-test.mjs
```
Rangkaian pengujian mencakup:
1. Penolakan akses tanpa sesi pada endpoint sensitif.
2. Penolakan pendaftaran publik saat `ALLOW_PUBLIC_REGISTRATION=false`.
3. Login, penerbitan cookie HttpOnly, dan pemulihan sesi.
4. Isolasi role BOD/Viewer (hanya rekaman terverifikasi meski parameter dimanipulasi).
5. Pembatasan akses cabang PIC (ABAC server-side) pada records **dan** konsolidasi keuangan.
6. Validasi skema input dan transaksi atomik saat impor.
7. Refresh token tidak berlaku sebagai access token.
8. Logout mencabut access **dan** refresh token.
9. Penolakan request mutasi dengan `Origin` asing (CSRF).
10. Penolakan endpoint API yang belum memiliki kebijakan otorisasi (default deny).

### CI
`.github/workflows/ci.yml` menjalankan typecheck, lint (`--max-warnings 0`), `npm audit`, build produksi, lalu rangkaian uji regresi.

---

## 6. Struktur Direktori Proyek

```
dashboardR4/
├── data/                      # Berkas database SQLite dan spreadsheet master
│   ├── ed_dashboard.db
│   ├── input_data.xlsx
│   └── master_user_pic.xlsx
├── scripts/                   # Skrip pengujian regresi dan utilitas pemeliharaan
│   ├── regression-test.mjs
│   └── seed.ts
├── src/
│   ├── app/                   # App Router Next.js (halaman dan 19 endpoint API)
│   │   ├── api/
│   │   └── page.tsx
│   ├── components/            # Komponen antarmuka pengguna (UI)
│   │   ├── admin/             # Data Governance, Verifikasi, Impor, Audit
│   │   ├── auth/              # Layar masuk dan modal otorisasi
│   │   ├── layout/            # Header dan Sidebar responsif
│   │   ├── modals/            # Modal komparasi eksekutif vs RKAP & 2025
│   │   ├── portsight/         # 8 Modul visualisasi data pelabuhan
│   │   └── ui/                # DataTable aksesibel, KPICard, StatusBadge
│   ├── hooks/                 # React custom hooks analitik
│   ├── lib/                   # Layanan domain, database SQLite, JWT, RBAC, validasi
│   └── proxy.ts               # Gateway autentikasi dan penegakan izin API
└── README.md
```
