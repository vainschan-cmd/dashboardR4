# Arsitektur Batas Modul — PortDash Regional 4

Aplikasi menggunakan arsitektur Modular Monolith untuk memastikan batas tanggung jawab (separation of concerns) yang jelas dan mencegah circular dependency antarmodul.

## 1. Peta Modul

```
src/
├── app/                  # Routing tipis (Next.js App Router API & Views)
├── components/
│   ├── auth/             # Modul 1: Identitas & Akses Pengguna
│   ├── layout/           # Modul Shell: Sidebar, PortSightHeader, Footer
│   ├── portsight/        # Modul 2: Presentasi Kinerja & Beranda Eksekutif
│   ├── admin/            # Modul 3: Master Data, Verification, Import, Audit
│   ├── menus/            # Modul 4: Tampilan Profil Cabang & Detail Indikator
│   ├── modals/           # Modul 5: Modal Drilldown & Matriks Komparasi RKAP
│   └── ui/               # Modul Shared UI: KPICard, AlertBadge, Chart Containers
├── lib/
│   ├── db.ts             # Akses Database & Indeks Kueri
│   ├── auth.ts           # Token Sesi Opaque & Otentikasi Server
│   ├── constants.ts      # Master Daftar 28 Cabang Resmi & Indikator Baku
│   ├── validator.ts      # Validasi Format Data & Runtime Schema
│   └── userPicSync.ts    # Sinkronisasi Master Pengguna & Spreadsheet
└── types/                # Kontrak Tipe Data Domain Global
```

## 2. Batas Akses Antarmodul
1. Lapisan UI (`components/`) hanya berkomunikasi dengan backend melalui kontrak API atau service terpusat di `lib/`.
2. Komponen presentasi tidak melakukan kueri database SQL langsung.
3. Hak akses role diverifikasi secara ketat di sisi server (`src/app/api/...`) pada setiap permintaan data terlindungi.
