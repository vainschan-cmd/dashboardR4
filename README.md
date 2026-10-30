# Executive Dashboard – Monitoring Kinerja Pelabuhan
**Platform Web Desktop & Mobile Konsolidasi Kinerja Regional & Seluruh Cabang Pelabuhan**

---

## 1. Ikhtisar Aplikasi
Aplikasi **Executive Dashboard – Monitoring Kinerja Pelabuhan** dibangun sesuai dokumen instruksi/prompt spesifikasi resmi untuk mengonsolidasikan, memonitor, menganalisis, dan menyajikan kinerja operasional, finansial, pelanggan, keselamatan (HSSE), komersial, teknik, SDM, dan profil fasilitas pelabuhan.

Aplikasi dirancang modular, fleksibel, responsif, dan siap dikembangkan lebih lanjut ketika format template resmi dari masing-masing departemen ditetapkan.

> [!NOTE]
> Seluruh data awal yang disajikan dalam demonstrasi ini merupakan **DATA SIMULASI** terstruktur dan konsisten untuk 5 cabang pelabuhan utama selama periode 2024, 2025, dan 2026 berjalan.

---

## 2. Struktur 9 Menu Utama Kinerja

| No | Menu Utama | Cakupan & Indikator Utama |
|---|---|---|
| **3.1** | **Summary Eksekutif** | Ringkasan kinerja Regional & seluruh cabang, Core KPIs (Pendapatan Usaha, Arus Kapal, Petikemas, Fatality Zero, CSAT, RFU Alat), perbandingan antarcabang, tren bulanan, status indikator hijau/kuning/merah. |
| **3.2** | **Pelanggan** | Jumlah pelanggan aktif, pertumbuhan pelanggan, Customer Satisfaction Index (CSAT), keluhan masuk, dan rasio penyelesaian keluhan sesuai SLA (3 hari). |
| **3.3** | **HSSE (K3 & Lingkungan)** | Program Zero Accident, Fatalities (Target: 0), Lost Time Injury (LTI), pelaporan Near Miss, kepatuhan Safety Inspection lapangan, dan kepatuhan baku mutu lingkungan. *(Indikator kecelakaan otomatis menerapkan logika 'semakin kecil semakin baik')*. |
| **3.4** | **Keuangan & RKAP** | Total pendapatan usaha, beban pokok operasional, laba bersih, realisasi anggaran RKAP tahunan, margin EBITDA, dan pertumbuhan MoM/YoY. |
| **3.5** | **Komersial** | Pendapatan jasa dermaga & tambat, jasa pemanduan & penundaan kapal, kontrak kerja sama baru (B2B shipping lines), dan utilisasi fasilitas gudang/lapangan. |
| **3.6** | **Operasional** | Arus kunjungan kapal (Call & GT), throughput petikemas (TEUs), kargo curah/non-petikemas (Ton), Berth Occupancy Ratio (BOR %), Turn Around Time (TRT Jam), Waiting Time (WT), dan produktivitas BSH (Box/Ship/Hour). |
| **3.7** | **Teknik & Fasilitas** | Kesiapan alat (Ready For Use / RFU %), rasio pemeliharaan preventif vs korektif, total jam kerusakan/downtime alat, dan progres proyek investasi capex fasilitas pelabuhan. |
| **3.8** | **SDM (Human Capital)** | Total komposisi pegawai aktif, produktivitas per tenaga kerja (Omset/Pegawai), rata-rata jam diklat kompetensi per pegawai, dan tingkat kehadiran (presensi). |
| **3.9** | **Profil Cabang Pelabuhan** | Informasi umum cabang (Priok, Perak, Belawan, Makassar, Balikpapan), wilayah kerja, spesifikasi panjang dermaga, kedalaman kolam (mLWS), lapangan penumpukan (CY), armada Crane, Tugboat & Pilotboat, serta drilldown data kinerja per cabang. |

---

## 3. Fitur Tata Kelola & Administrasi

### 4.1 Pusat Impor Data (Spreadsheet & Google Sheets)
- **Upload File**: Menerima file Microsoft Excel (`.xlsx`) dan `.csv`.
- **Google Sheets API**: Menghubungkan langsung Google Spreadsheet melalui URL atau Spreadsheet ID dengan adapter server yang aman tanpa mengekspos kredensial di frontend.
- **Validasi Multi-Lapisan**: Preview baris, cek kolom wajib, tipe data, format periode, duplikasi record, dan daftar error spesifik baris & kolom sebelum penyimpanan.
- **Unduh Template**: Menghasilkan template Excel resmi dengan kolom baku dan lembar petunjuk kode cabang/indikator.

### 4.2 Pusat Verifikasi & Monitoring Pengumpulan Data
- **Alur Kerja**: Draft $\rightarrow$ Menunggu Verifikasi $\rightarrow$ Terverifikasi (Data Resmi) / Perlu Revisi.
- **Matriks Monitoring Kelengkapan**: Pemantauan matriks status pengumpulan data cabang per departemen (Belum Upload, Draft, Menunggu Verifikasi, Perlu Revisi, Terverifikasi) dengan nama PIC penanggung jawab dan deteksi keterlambatan.
- **Catatan Revisi**: Admin Regional dapat mengembalikan data yang tidak wajar dengan catatan perbaikan untuk ditindaklanjuti oleh PIC cabang.

### 4.3 Template & Dynamic Mapping Studio
- Admin dapat menambah, mengubah, memetakan, atau menghapus nama kolom spreadsheet ke field database secara dinamis tanpa perlu mengubah source code aplikasi.

### 4.4 Audit Trail
- Pencatatan seluruh aksi pengguna (LOGIN, UPLOAD, IMPORT, APPROVE, REVISE, CONFIG_UPDATE, EXPORT) lengkap dengan timestamp, username, role, dan alamat IP.

---

## 4. Hak Akses Pengguna (RBAC)

Aplikasi dilengkapi selector role interaktif di bagian header untuk kemudahan pengujian:

1. **Super Admin** (`budi.superadmin`): Akses penuh seluruh fitur, kelola master cabang/departemen, mapping template, verifikasi, dan konfigurasi sistem.
2. **Admin Regional** (`hendra.regional`): Akses seluruh data regional/cabang, memonitor kelengkapan data, memverifikasi/mengesahkan data, meminta revisi, dan laporan konsolidasi.
3. **PIC Departemen Regional** (`rudi.ops_regional` / `siti.keuangan`): Mengunggah dan memonitor data departemen yang menjadi tanggung jawabnya.
4. **PIC Cabang** (`ahmad.priok` / `bambang.perak`): Mengunggah dan memperbaiki data cabang sesuai kewenangan (terkunci pada cabang masing-masing).
5. **Manajemen / Viewer** (`direksi.eksekutif`): Hak akses khusus eksekutif untuk melihat dashboard, filter, drilldown, dan laporan konsolidasi data resmi (hanya data terverifikasi).

---

## 5. Teknologi & Arsitektur

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
- **Styling**: Vanilla CSS kustom dengan Design System modern maritim eksekutif (Deep Navy, Slate, Accent Electric Blue, status indikator hijau/kuning/merah).
- **Visualisasi**: Recharts (Bar chart antarcabang, Line chart tren bulanan, Donut/Pie chart komposisi).
- **Database Engine**:
  - **Lokal**: Node.js `node:sqlite` (`data/ed_dashboard.db`) berjalan instan tanpa perlu instalasi daemon tambahan.
  - **Produksi**: Skema database PostgreSQL resmi tersedia di `data/schema.sql` lengkap dengan relasi referensial dan indeks performa.
- **Spreadsheet & Ekspor**:
  - Parser & Exporter: SheetJS (`xlsx`) untuk upload/download Excel (.xlsx).
  - Cetak PDF: Tata letak ramah cetak (print-optimized) dengan informasi filter dan stempel waktu.

---

## 6. Cara Menjalankan Aplikasi

### Prasyarat
- Node.js versi 18 atau lebih baru (direkomendasikan Node.js 20+ atau 24).
- npm versi 9 atau lebih baru.

### Langkah Instalasi
1. Masuk ke direktori proyek:
   ```bash
   cd ed-dashboard
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Inisialisasi dan jalankan seeder data awal:
   ```bash
   npx tsx src/lib/seed.ts
   ```
4. Jalankan development server:
   ```bash
   npm run dev
   ```
5. Buka peramban (browser) di alamat:
   ```
   http://localhost:3000
   ```

### Konfigurasi Environment (`.env`)
Buat file `.env` di root direktori jika ingin mengaktifkan Google Sheets API v4 produksi:
```env
# Port & Host
PORT=3000

# Google Sheets API Key (Opsional untuk koneksi live produksi)
GOOGLE_SHEETS_API_KEY=your_google_cloud_api_key_here

# Mode Database
DATABASE_URL=file:./data/ed_dashboard.db
```
*(Jika API key belum diisi, sistem otomatis mengaktifkan Google Sheets Adapter Mode yang aman untuk demonstrasi).*

---

## 7. Struktur Folder Proyek

```
ed-dashboard/
├── data/
│   ├── ed_dashboard.db            # Database SQLite lokal terstruktur
│   └── schema.sql                 # Skema DDL resmi PostgreSQL
├── src/
│   ├── app/
│   │   ├── api/                   # Backend REST API
│   │   │   ├── audit/             # Log audit trail
│   │   │   ├── import/            # Validasi, commit, & Google Sheets sync
│   │   │   ├── master/            # Master data katalog
│   │   │   ├── records/           # Query data bulanan & filter
│   │   │   ├── reports/           # Ekspor Excel (.xlsx) & template generator
│   │   │   ├── templates/         # Konfigurasi mapping dinamis
│   │   │   └── verification/      # Review antrean & matriks kelengkapan
│   │   ├── globals.css            # Token CSS & tema maritim eksekutif
│   │   ├── layout.tsx             # Root Layout & viewport metadata
│   │   └── page.tsx               # Main Dashboard Controller
│   ├── components/
│   │   ├── admin/                 # Modul tata kelola & administrasi
│   │   │   ├── AuditTrailView.tsx
│   │   │   ├── ImportCenter.tsx
│   │   │   ├── MasterDataView.tsx
│   │   │   ├── TemplateMapping.tsx
│   │   │   └── VerificationQueue.tsx
│   │   ├── layout/                # Shell navigasi & header
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── menus/                 # 9 Tampilan menu utama kinerja
│   │   │   ├── HSSEView.tsx
│   │   │   ├── KeuanganView.tsx
│   │   │   ├── KomersialView.tsx
│   │   │   ├── OperasionalView.tsx
│   │   │   ├── PelangganView.tsx
│   │   │   ├── ProfilCabangView.tsx
│   │   │   ├── SDMView.tsx
│   │   │   ├── SummaryView.tsx
│   │   │   └── TeknikView.tsx
│   │   └── ui/                    # Komponen atomik
│   │       ├── DataTable.tsx
│   │       ├── DetailDrilldownModal.tsx
│   │       ├── KPICard.tsx
│   │       └── StatusBadge.tsx
│   └── lib/
│       ├── db.ts                  # Konektor database & query helpers
│       ├── excelExporter.ts       # Generator file Excel & template
│       ├── googleSheetsAdapter.ts # Integrasi Google Sheets API
│       ├── seed.ts                # Seeder data master & simulasi
│       ├── types.ts               # Interface TypeScript
│       └── validator.ts           # Mesin validasi spreadsheet & duplikasi
└── package.json
```
