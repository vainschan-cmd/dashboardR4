# ADR-0001 — Runtime Basis Data: `node:sqlite` untuk pilot, PostgreSQL untuk skala penuh

- **Status:** Diterima (dengan syarat)
- **Tanggal:** 2026-11-11
- **Konteks item tasklist:** `DEP-03`
- **Pengambil keputusan:** Tim ICT Regional 4

---

## 1. Konteks

Aplikasi saat ini memakai `node:sqlite` (`DatabaseSync`) dengan satu berkas `data/ed_dashboard.db` dalam mode WAL. Konsekuensi teknis yang sudah terasa:

| Aspek | Kondisi sekarang |
|---|---|
| Model konkurensi | **Sinkron & single-process.** Semua query memblokir event loop. |
| Skala tulis | Satu penulis pada satu waktu (WAL membantu pembaca, bukan penulis paralel). |
| Multi-instance | Tidak didukung. Dua proses pada berkas yang sama berisiko `SQLITE_BUSY` dan rate limiter tidak dibagi. |
| Beban | ± 28 cabang × 6 modul × 12 bulan; volume saat ini kecil (database ~2,1 MB). |
| Deployment | Satu server (`next start`) di belakang Cloudflare Tunnel. |
| Beban baca berat | `/api/modules-data` sempat 614 KB karena `SELECT *` enam tabel; sudah dipangkas ke SQL terfilter. |

Kebutuhan yang **belum** terpenuhi oleh SQLite:
1. Lebih dari satu instance aplikasi (HA / rolling deploy tanpa downtime).
2. Penulisan paralel dengan banyak PIC mengimpor bersamaan.
3. Backup/PITR terkelola (saat ini manual, lihat `docs/operations/BACKUP-RESTORE.md`).

---

## 2. Keputusan

**Tetap memakai `node:sqlite` untuk pilot produksi Regional 4**, dengan syarat dan jalur keluar yang jelas:

### 2.1 Syarat yang wajib dipenuhi selama memakai SQLite

| # | Syarat | Status |
|---|---|---|
| 1 | Node.js **≥ 22.5.0** (modul `node:sqlite` belum ada sebelumnya) | Terpenuhi — tertulis di `package.json` `engines` dan CI memakai Node 22 |
| 2 | **Satu instance aplikasi saja** per berkas basis data | Terpenuhi — deployment satu proses |
| 3 | Backup otomatis berjadwal + drill restore | Terpenuhi — `npm run backup`, runbook + hasil drill terdokumentasi |
| 4 | Operasi berat (scrypt, tulis spreadsheet) tidak berjalan sinkron di jalur request | Terpenuhi sebagian — scrypt sudah async (`verifyPasswordAsync`); sinkronisasi spreadsheet masih sinkron |
| 5 | Jalur migrasi ke PostgreSQL tersedia dan teruji minimal sekali | Terpenuhi — `scripts/ingest_*` dan `DatabaseConfig` sudah menyimpan parameter PostgreSQL |
| 6 | Tidak ada `SELECT *` tanpa filter pada tabel modul | Terpenuhi — filter cabang + periode dipindah ke SQL |

### 2.2 Pemicu wajib migrasi (salah satu terpenuhi → pindah)

1. Butuh **lebih dari satu instance** aplikasi (rolling deploy, HA, atau penambahan replika).
2. Waktu tunggu tulis (lock) > 1 detik teramati berulang pada jam sibuk.
3. Ukuran basis data > 2 GB atau baris `monthly_records` > 1 juta.
4. Kebutuhan **point-in-time recovery** atau audit retensi > 1 tahun.
5. Integrasi pihak ketiga yang memerlukan koneksi SQL langsung.

### 2.3 Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| **`better-sqlite3`** | Masih sinkron (masalah inti tidak berubah), menambah dependensi native yang harus dikompilasi di setiap lingkungan/CI, dan `node:sqlite` sudah cukup untuk beban saat ini. |
| **PostgreSQL sekarang** | Menambah kompleksitas operasional (server DB, pooling, migrasi data) sebelum ada pengguna yang membutuhkannya. Biaya > manfaat pada tahap pilot. |
| **SQLite + replikasi manual** | Tidak menyelesaikan penulisan paralel dan menciptakan sumber kebenaran ganda. |
| **ORM (Prisma/Drizzle)** | Menyembunyikan query; masalah utama adalah konkurensi, bukan ergonomi query. Ditunda sampai migrasi PostgreSQL. |

---

## 3. Konsekuensi

**Positif**
- Nol biaya operasional basis data untuk pilot; satu berkas yang mudah di-backup dan diaudit.
- Tidak ada lapisan jaringan, kredensial DB, atau connection pool yang bisa salah konfigurasi.
- `node:sqlite` adalah modul bawaan Node — tidak ada dependensi native yang dapat gagal dikompilasi.

**Negatif / risiko yang diterima**
- **Tidak bisa scale-out.** Penambahan instance memerlukan migrasi lebih dulu.
- **Event loop bisa tersandera.** Query sinkron pada tabel besar akan menunda request lain. Mitigasi: filter di SQL, index yang sudah ada, dan pemantauan p95.
- **Rate limiter lokal.** `auth_rate_limits` berada di basis data yang sama; multi-instance memerlukan store bersama (`DEP-07`).
- **Backup bukan PITR.** RPO terbaik = interval backup (6 jam).

**Netral**
- Kode sudah memisahkan akses data di `src/lib/db.ts` (`dbQueries`), sehingga penggantian driver menyentuh satu modul, bukan seluruh aplikasi.

---

## 4. Rencana migrasi (bila pemicu §2.2 tercapai)

1. **Siapkan PostgreSQL 16** + `pg_dump`/`restore` pipeline; simpan kredensial terenkripsi (sudah didukung `SECRETS_ENCRYPTION_KEY`).
2. **Pisahkan `dbQueries` menjadi repository per domain** (`CODE-03`): `users`, `records`, `modules`, `audit`, `settings`.
3. **Buat adapter SQL**: port `withTransaction` ke `BEGIN/COMMIT` PostgreSQL, ganti `INSERT OR REPLACE` menjadi `INSERT ... ON CONFLICT ... DO UPDATE`, ganti `?` menjadi `$1`.
4. **Migrasi data** dengan skrip satu arah + verifikasi jumlah baris per tabel dan checksum agregat (total pendapatan, jumlah rekaman per cabang/periode).
5. **Jalankan paralel (read-only)** selama satu siklus verifikasi bulanan sebelum memindahkan penulisan.
6. **Rate limiter** pindah ke tabel PostgreSQL yang sama; kunci unik `rate_key` tetap.
7. **Perbarui runbook backup** ke `pg_dump` + WAL archiving untuk PITR.

Estimasi: 3–5 hari kerja engineering + 1 siklus verifikasi data.

---

## 5. Verifikasi keputusan ini

- [x] `engines.node` di `package.json` = `>=22.5.0`
- [x] CI memakai Node 22 dan lulus `build` + uji regresi
- [x] Backup/restore diuji (drill 2026-11-11: 12 → 1 → 12 akun, `integrity_check = ok`)
- [x] Jalur baca terberat sudah terfilter di SQL (`modules-data`, `records`, `konsolidasi`)
- [x] scrypt tidak lagi berjalan sinkron pada login (`authenticateUserAsync`)
- [ ] Sinkronisasi spreadsheet keluar dari jalur request (`PERF-09`) — **belum**
- [ ] Rate limiter multi-instance (`DEP-07`) — **belum**, hanya relevan bila scale-out

---

## 6. Rujukan

- `docs/architecture/POSTGRESQL.md` — catatan integrasi PostgreSQL yang sudah ada.
- `docs/operations/BACKUP-RESTORE.md` — prosedur backup, retensi, dan hasil drill.
- `TASKLIST-REMEDIASI.md` — `DEP-03`, `DEP-07`, `DEP-08`, `CODE-03`, `PERF-06`, `PERF-09`.
