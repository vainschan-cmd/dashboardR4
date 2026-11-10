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
- **JWT HttpOnly Cookie**: Token JWT disimpan dalam cookie `portsight_session` yang terlindungi dengan bendera `HttpOnly`, `SameSite=Lax`, dan `Secure` pada mode produksi.
- **Validasi Kunci Rahasia JWT**: Memeriksa keberadaan dan kekuatan `JWT_SECRET` (minimal 32 karakter). Menolak konfigurasi produksi secara otomatis jika kunci tidak tersedia atau kurang kuat.
- **Rate Limiting Login Terdistribusi**: Menggunakan tabel persisten SQLite WAL (`auth_rate_limits`) untuk membatasi percobaan masuk gagal (maksimal 5 kali per IP dalam 15 menit), tahan terhadap *restart* proses maupun *multi-instance*.

### Kontrol Akses Berbasis Peran & Atribut (RBAC & ABAC Server-Side)
- Seluruh endpoint API menerapkan verifikasi sesi dan otorisasi langsung di server (`src/proxy.ts` dan domain controller):
  - **BOD / Viewer**: Akses hanya baca (*read-only*), otomatis terkunci pada rekaman terverifikasi resmi (`verifiedOnly=true`), dan diblokir dari endpoint penulisan atau menu administratif.
  - **PIC Cabang**: Akses tulis dan baca dibatasi pada cabang penugasan masing-masing (contoh: Cabang Makassar `R01`, Cabang Balikpapan `R04`).
  - **Admin Regional & Super Admin**: Akses verifikasi data, manajemen pengguna PIC, konfigurasi pemetaan kolom, dan jejak audit regional.
- **Pendaftaran Pengguna Terkontrol**: Pendaftaran publik via `POST /api/users` dinonaktifkan secara bawaan (`ALLOW_PUBLIC_REGISTRATION=false`). Akun baru hanya dapat didaftarkan oleh administrator resmi dengan penetapan cabang di server dan sandi wajib yang aman.

### Proteksi Impor Data & Integritas Transaksi
- **Batas Beban**: Impor JSON dibatasi maksimal 2 MB (`MAX_IMPORT_JSON_BYTES`) dan maksimal 2.000 baris data (`MAX_IMPORT_ROWS`).
- **Validasi Skema Input**: Setiap rekaman impor divalidasi ketat menggunakan skema Zod terhadap master cabang, departemen, tipe data, dan aturan ABAC.
- **Integritas Transaksi Atomik**: Penyimpanan rekaman data bulanan, batch impor, dan log audit dieksekusi dalam satu transaksi atomik database (`withTransaction`).
- **Validasi Google Sheets Adapter**: Validasi regex untuk Spreadsheet ID, nama sheet tab, dan format A1 range, disertai batas waktu permintaan (*timeout* 10 detik dengan `AbortSignal.timeout`).

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
# Kunci rahasia JWT wajib diisi minimal 32 karakter untuk produksi
JWT_SECRET=pelindo_r4_executive_dashboard_secret_key_production_32chars_min

# Jalur penyimpanan basis data SQLite
DATABASE_PATH=data/ed_dashboard.db

# Kebijakan pendaftaran publik pengguna (true/false)
ALLOW_PUBLIC_REGISTRATION=false

# Opsional: Integrasi Google Sheets API & Gateway
GOOGLE_SHEETS_API_KEY=
PORT=3000
NODE_ENV=development
```

---

## 5. Menjalankan Aplikasi & Pengujian

### Prasyarat
- Node.js versi 18.18+ atau 20+
- npm versi 9+

### Instalasi & Menjalankan Mode Pengembang
```bash
# Instalasi dependensi
npm install

# Jalankan server pengembangan
npm run dev
```
Buka browser pada alamat `http://localhost:3000`.

### Pemeriksaan Kualitas Kode & Tipe Data
```bash
# Pemeriksaan tipe data TypeScript
npx tsc --noEmit

# Pemeriksaan linter ESLint
npm run lint
```

### Menjalankan Rangkaian Uji Regresi Keamanan
Skrip pengujian otomatis komprehensif menguji seluruh kriteria keamanan dan otorisasi:
```bash
node scripts/regression-test.mjs
```
Rangkaian pengujian mencakup:
1. Penolakan akses unauthenticated pada `/api/master`, `/api/users/export`, `/api/import/sheets-sync`, `/api/import/drive-sync`.
2. Penolakan pendaftaran pengguna publik saat `ALLOW_PUBLIC_REGISTRATION=false`.
3. Pengujian *rate limiting* kegagalan login dan pemulihan kunci sesi.
4. Penegakan isolasi role BOD/Viewer (hanya rekaman terverifikasi yang dikembalikan meskipun query parameter dimanipulasi).
5. Pembatasan akses cabang bagi PIC Cabang (ABAC server-side).
6. Pengujian validasi skema input dan eksekusi transaksi atomik saat impor data.

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
