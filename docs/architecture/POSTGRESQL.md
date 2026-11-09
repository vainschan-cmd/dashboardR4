# Konfigurasi & Migrasi PostgreSQL Produksi — PortDash Regional 4

Aplikasi saat ini menggunakan database embedded **SQLite** (`data/ed_dashboard.db` via `node:sqlite`) yang sangat cepat dan bebas ketergantungan daemon eksternal untuk lingkungan lokal.

Skema database PostgreSQL yang setara telah disiapkan secara penuh di file `data/schema.sql`.

---

## 1. Skema Tabel PostgreSQL

Tabel-tabel relasional yang telah didefinisikan:
1. `branches`: Master 28 cabang pelabuhan Regional 4.
2. `departments`: Departemen operasional, komersial, teknik, keuangan, HSSE, SDM.
3. `users`: Autentikasi dan data otorisasi pengguna/PIC.
4. `kpi_indicators`: Master indikator kinerja dan formula.
5. `templates`: Konfigurasi template pemetaan kolom dinamis.
6. `import_batches`: Riwayat batch impor berkas Excel dan Google Sheets.
7. `monthly_records`: Data transaksi kinerja bulanan lengkap dengan indeks performa.
8. `audit_logs`: Log jejak audit kepatuhan.
9. `integration_settings`: Parameter integrasi layanan pihak ketiga.

---

## 2. Langkah Migrasi ke PostgreSQL Cloud SQL / Supabase

1. Atur variabel lingkungan di `.env.local` atau Cloud Secret Manager:
   ```env
   DATABASE_URL="postgres://username:password@hostname:5432/ed_dashboard?sslmode=require"
   ```
2. Jalankan inisialisasi skema ke instans PostgreSQL:
   ```bash
   psql "$DATABASE_URL" -f data/schema.sql
   ```
3. Konfigurasi driver pool koneksi pada adapter database produksi di `src/lib/db.ts`.
