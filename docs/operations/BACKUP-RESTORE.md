# Backup, Restore & Disaster Recovery Runbook

**Scope:** `PortDash Regional 4` — SQLite database `data/ed_dashboard.db` (WAL mode) plus its configuration files.
**Owner:** ICT Regional 4.

---

## 1. What must be backed up

| Artefak | Lokasi | Mengapa |
|---|---|---|
| Basis data | `data/ed_dashboard.db` (+ `-wal`, `-shm`) | Seluruh data kinerja, akun, audit trail, konfigurasi sistem |
| Konfigurasi DB | `data/db_config.json` | Path SQLite & kredensial PostgreSQL (kata sandi tersimpan **terenkripsi**) |
| Spreadsheet master | `data/master_user_pic.xlsx`, `data/input_data.xlsx` | Sumber impor pengguna & data input |
| Variabel lingkungan | `.env` / secret manager | `JWT_SECRET`, `SECRETS_ENCRYPTION_KEY` — **tanpa kunci ini secret tersimpan tidak dapat dibaca** |

> Kredensial di `db_config.json` dan tabel `integration_settings` disimpan dengan AES-256-GCM.
> Menyalin berkas tanpa `SECRETS_ENCRYPTION_KEY` menghasilkan backup yang tidak lengkap
> secara fungsional: data aman, tetapi integrasi harus dikonfigurasi ulang.

---

## 2. Membuat backup

```bash
npm run backup                       # -> backups/ed_dashboard-<timestamp>.db
npm run backup -- --out /secure/path # tujuan lain (disarankan di luar repo)
npm run backup:list                  # daftar backup + ukuran
```

`scripts/backup-db.mjs` memakai `VACUUM INTO`, bukan `cp`:

- `cp` pada basis data WAL dapat **kehilangan transaksi terakhir** yang masih berada di `-wal`;
- `VACUUM INTO` menghasilkan satu berkas konsisten tanpa menghentikan aplikasi;
- setiap backup menjalankan `PRAGMA integrity_check` dan menulis
  `*.manifest.json` berisi ukuran + SHA-256 untuk verifikasi.

### Jadwal yang disarankan

| Frekuensi | Retensi | Lokasi |
|---|---|---|
| Setiap 6 jam (cron/systemd timer) | 7 hari | Disk terpisah dari server aplikasi |
| Harian | 30 hari | Object storage (S3/Blob) dengan versioning |
| Sebelum rilis/migrasi | sampai rilis berikutnya | Arsip rilis |

Contoh entri cron:

```cron
0 */6 * * * cd /srv/portsight && /usr/bin/node scripts/backup-db.mjs --out /srv/backups >> /var/log/portsight-backup.log 2>&1
```

---

## 3. Memulihkan (restore)

```bash
npm run restore -- backups/ed_dashboard-2026-11-11T15-09-25-778Z.db
```

Perilaku skrip:

1. Memvalidasi snapshot dengan `PRAGMA integrity_check` (menolak berkas rusak);
2. Menyalin basis data aktif ke `<nama>.pre-restore-<timestamp>` agar rollback mungkin;
3. Menghapus `-wal`/`-shm` lama (sisa basis data sebelumnya tidak boleh bercampur);
4. Menyalin snapshot ke posisi basis data aktif.

Setelah restore: **restart aplikasi**, lalu verifikasi login, satu laporan, dan satu rekaman yang baru diubah. Bila hasilnya tidak sesuai, kembalikan berkas `*.pre-restore-*`.

---

## 4. Latihan pemulihan (drill) — wajib triwulanan

Drill dijalankan pada **salinan**, tidak pada basis data produksi:

```bash
cp data/ed_dashboard.db /tmp/drill.db
DATABASE_PATH=/tmp/drill.db node scripts/backup-db.mjs --out /tmp/drill-backups
SNAP=$(ls /tmp/drill-backups/*.db | head -1)
# simulasi kerusakan
node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/tmp/drill.db').prepare(\"DELETE FROM users WHERE nipp LIKE '100%'\").run()"
# pulihkan
DATABASE_PATH=/tmp/drill.db node scripts/backup-db.mjs --restore "$SNAP" --force
```

**Hasil drill terakhir — 2026-11-11:**

| Metrik | Hasil |
|---|---|
| Ukuran snapshot | 2.160 KB |
| Waktu pembuatan snapshot | < 1 detik |
| Akun sebelum kerusakan / setelah kerusakan / setelah restore | 12 / 1 / 12 |
| `integrity_check` pada snapshot & hasil restore | `ok` |
| Waktu restore (termasuk validasi) | < 2 detik |
| Target RTO | ≤ 30 menit (termasuk verifikasi manual) |
| Target RPO | ≤ 6 jam (mengikuti jadwal backup) |

---

## 5. Yang harus dicatat saat insiden

1. Waktu kejadian & waktu deteksi.
2. Snapshot yang dipakai (nama berkas + SHA-256 dari manifest).
3. Jumlah baris/akun sebelum dan sesudah restore.
4. Berkas `*.pre-restore-*` yang tersimpan (jangan dihapus sampai verifikasi selesai).
5. Apakah ada transaksi yang hilang (selisih waktu snapshot vs kejadian) — laporkan sebagai risiko RPO.

---

## 6. Batas yang diketahui

- **`node:sqlite` berjalan satu proses.** Restore harus dilakukan saat aplikasi berhenti; menjalankan restore pada basis data yang sedang terbuka akan membuat proses lama menulis ke berkas yang sudah diganti.
- **Belum ada backup off-site otomatis.** Jadwal pada §2 masih manual/cron; target berikutnya adalah object storage dengan versioning dan uji restore otomatis di CI.
- **Secret tidak ikut ter-backup.** `JWT_SECRET` dan `SECRETS_ENCRYPTION_KEY` harus disimpan di secret manager dengan prosedur rotasi sendiri.
