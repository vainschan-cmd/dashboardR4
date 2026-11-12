# Catatan Pemindaian Rahasia (Secret Scan) — 2026-11-11

**Terkait:** `DEP-06` pada `TASKLIST-REMEDIASI.md`
**Metode:** pemindaian `git log -p --all` (≈ 67 commit) dengan pola untuk JWT secret, kata sandi demo, token tunnel, dan URL tunnel statis. CI menjalankan `gitleaks` dengan konfigurasi `.gitleaks.toml` (riwayat penuh, `fetch-depth: 0`).

---

## 1. Temuan

| # | Temuan | Lokasi | Status risiko |
|---|---|---|---|
| 1 | Kata sandi demo `password123` muncul di commit lama (`scripts/regression-test.mjs`, komponen login, `db.ts` fallback) | Riwayat git | **Termitigasi.** Kode sudah dihapus, dan migrasi `cfg_security_migration` me-reset akun yang masih memakai kata sandi ini. Kata sandi tersebut **tidak berlaku lagi** pada instalasi mana pun. |
| 2 | Nilai `JWT_SECRET` pada `.env.example` (`..._production_32chars_min`) dan placeholder `ganti_dengan_secret_...` | Riwayat git | **Perlu tindakan.** Bila nilai tersebut pernah dipakai sebagai kunci sebenarnya di server mana pun, kunci itu harus dianggap bocor. |
| 3 | URL tunnel statis `*.trycloudflare.com` pada `next.config.ts` (`allowedDevOrigins`) | Riwayat git | **Rendah.** Hanya berlaku untuk dev; `allowedDevOrigins` sekarang memakai wildcard, bukan hostname tetap. |
| 4 | Tidak ada token Cloudflare, API key Google, atau kata sandi PostgreSQL yang ditemukan pada riwayat | — | Bersih |

---

## 2. Tindakan yang sudah dilakukan

- [x] Kata sandi demo dihapus dari seluruh kode; akun yang masih memakainya direset lewat migrasi satu kali.
- [x] `.env.example` hanya berisi placeholder yang tidak dapat dipakai.
- [x] `JWT_SECRET` < 32 karakter ditolak saat runtime; produksi menolak start tanpa kunci yang valid.
- [x] `gitleaks` ditambahkan ke CI (`.gitleaks.toml`) sehingga commit baru yang memuat kredensial langsung gagal.
- [x] Kredensial tersimpan (`pg_password`, `google_api_key`, `api_gateway_token`) dienkripsi AES-256-GCM sehingga dump basis data tidak membocorkan secret.

---

## 3. Tindakan yang masih harus dilakukan (manual, di luar repo)

| # | Tindakan | Pemilik | Catatan |
|---|---|---|---|
| 1 | **Rotasi `JWT_SECRET`** di server produksi bila nilai lama pernah sama dengan yang ada di `.env.example`. Rotasi otomatis membatalkan semua sesi (semua pengguna login ulang). | ICT Ops | Wajib sebelum go-live |
| 2 | **Rotasi `SECRETS_ENCRYPTION_KEY`** bila sudah pernah dipakai; setelah rotasi, seluruh kredensial tersimpan harus diisi ulang. | ICT Ops | Koordinasi dengan #1: menaikkan `JWT_SECRET` tanpa `SECRETS_ENCRYPTION_KEY` membuat secret turunan tidak terbaca |
| 3 | **Rotasi token Cloudflare Tunnel** bila pernah tertulis di berkas yang di-commit. | ICT Ops | Token hanya boleh ada di secret manager |
| 4 | Putuskan apakah riwayat git akan **ditulis ulang** (`git filter-repo`). | Tech lead | Tidak wajib: kredensial sudah tidak berlaku dan setiap clone memerlukan akses repo. Bila dipilih, koordinasikan karena semua clone harus di-clone ulang. |

---

## 4. Verifikasi berkala

```bash
# pemindaian lokal sebelum push
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source=/repo -c /repo/.gitleaks.toml -v
```

CI menjalankan pemindaian yang sama pada setiap push dan pull request. Temuan baru menggagalkan pipeline, bukan sekadar memberi peringatan.

---

## 5. Batas yang diketahui

- `gitleaks` mendeteksi **pola**, bukan kebocoran nyata. Kredensial yang diformat tidak lazim bisa lolos; karena itu rotasi pada §3 tetap wajib meski pemindaian bersih.
- Riwayat git **belum** ditulis ulang, jadi nilai lama masih dapat dibaca siapa pun yang memiliki akses ke repositori. Mitigasinya adalah rotasi kredensial, bukan penghapusan riwayat.
