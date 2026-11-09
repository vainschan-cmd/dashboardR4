# P2 — Implementasi Arsitektur Modular, Performa & UI/UX

Dokumen ini mendokumentasikan progres implementasi Fase P2 pada sistem **PortDash Regional 4**.

---

## 1. Arsitektur Modular Monolith
- **Modul Inti**:
  1. **Identitas & Akses (`src/components/auth/`, `src/lib/auth.ts`)**: Autentikasi server-side opaque session, enkripsi hash bcrypt, kontrol hak akses berbasis role & branch scope.
  2. **Master Data (`src/components/admin/MasterDataView.tsx`)**: Pengelolaan 28 cabang resmi Regional 4, katalog peralatan pelabuhan, daftar indikator KPI, dan data PIC pengguna.
  3. **Kinerja & Pelaporan (`src/components/portsight/`)**: Visualisasi ringkasan eksekutif, kinerja bulanan vs RKAP/YoY, drilldown per cabang dan komoditas layanan.
  4. **Pusat Impor (`src/components/admin/ImportCenter.tsx`)**: Staging data spreadsheet, validasi multi-layer, deteksi anomali baris/kolom, dan deduplikasi berkas.
  5. **Verifikasi & Approval (`src/components/admin/VerificationQueue.tsx`)**: Antrean pengesahan data kinerja PIC cabang oleh Administrator Regional.
  6. **Audit Trail (`src/components/admin/AuditTrailView.tsx`)**: Penelusuran riwayat aktivitas sistem secara transparan dan terstruktur.

---

## 2. Optimasi Kueri & Database (Performance)
- **Engine Database**: SQLite lokal (`node:sqlite` bawaan Node.js v24) untuk performa instan tanpa latensi koneksi jaringan.
- **Indeks Database**: Telah diimplementasikan 10 indeks sekunder pada `data/ed_dashboard.db` dan `src/lib/db.ts`:
  - `idx_records_branch_period (branch_id, year, month)`
  - `idx_records_period (year, month)`
  - `idx_records_branch (branch_id)`
  - `idx_records_dept (department_id)`
  - `idx_records_indicator (indicator_id)`
  - `idx_records_status (verification_status)`
  - `idx_audit_logs_timestamp (timestamp DESC)`
  - `idx_import_batches_period (period_year, period_month)`
  - `idx_kpi_indicators_dept (department_id)`
  - `idx_users_role (role)`
- **Eliminasi Parsing Excel Sinkron**: Permintaan dashboard membaca langsung dari tabel SQLite terindeks, bukan mem-parse workbook `.xlsx` secara berulang pada tiap HTTP request.

---

## 3. Desain UI/UX & Antislop Standard
- **Sidebar Navigasi**: Menu navigasi vertikal di sebelah kiri dengan layout Flexbox, mendukung mode ciut (collapsed 68px mode) dengan hover tooltips interaktif dan pemisahan kelompok menu (Ringkasan, Kinerja, Tata Kelola Data, Administrasi).
- **Top Navbar Collapsible**: Panel atas dapat disembunyikan menggunakan tab pemicu vertikal di tengah bawah navbar untuk memaksimalkan ruang kerja visual di layar desktop maupun tablet.
- **Konsistensi Visual**: Skema warna korporat resmi maritim (Deep Navy, Slate Blue, Teal/Cyan), penghapusan kartu seragam yang berlebihan, dan integrasi grafik kombinasi analitik.
