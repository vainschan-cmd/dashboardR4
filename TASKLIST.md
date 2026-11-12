# Dokumen Tasklist Audit & Implementasi — PELINDO R4 PortDash

> [!WARNING]
> **Dokumen ini bersifat historis.** Status `[x]` di bawah ini ditulis sebelum audit ulang 2026-11-11 dan sebagian **tidak sesuai kondisi kode** (kredensial default, pencabutan sesi, PostgreSQL, Google Drive, angka fallback fiktif).
> Gunakan [`TASKLIST-REMEDIASI.md`](TASKLIST-REMEDIASI.md) sebagai satu-satunya sumber kebenaran status pekerjaan. Lihat bagian **§16 Catatan Rekonsiliasi** di dokumen tersebut.

> [!IMPORTANT]
> **Temuan Audit vs Klaim [`CHECKLIST.md`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/CHECKLIST.md):**
> Beberapa item yang sebelumnya tercentang `[x]` pada [`CHECKLIST.md`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/CHECKLIST.md) (seperti penghapusan *bypass password*, *hashing password*, modul [`src/lib/auth.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/docs/architecture/MODULES.md#L22), penghentian parsing Excel sinkron di `/api/modules-data`, dan penghapusan *dead code*) **terbukti belum terimplementasi di kode aktual**. Dokumen ini merekonsiliasi kondisi riil kode sumber dan memetakan seluruh pekerjaan ke dalam tahapan eksekusi yang terukur.

---

## Fase 1 (P0) — Remediasi Kerentanan Kritis & JWT Authentication (SELESAI)

### 1.1 Penambalan Kerentanan Kredensial & Database
- [x] **Hapus Bypass Password Universal:** Hapus kondisi `password !== 'password123' && password !== '1'` pada [`dbQueries.authenticateUser`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L597-L617).
- [x] **Implementasi Password Hashing:** Hash seluruh password pengguna menggunakan `node:crypto` (`scryptSync` + `timingSafeEqual`) di [`src/lib/auth.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/auth.ts#L54-L101) saat seed awal & migrasi otomatis di [`initSchema`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L365-L407), [`createUser`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L479-L542), [`updateUser`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L543-L586), dan [`src/lib/seed.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/seed.ts#L235-L250).
- [x] **Sanitasi Respons API (Cegah Kebocoran Password & Secret):**
  - [x] Buat fungsi mapper [`toSafeUser(user)`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L55-L64) di [`src/lib/db.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts) agar properti `password` tidak pernah dikembalikan oleh [`GET /api/users`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/route.ts#L8-L37) maupun [`GET /api/master`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/master/route.ts#L4-L36).
  - [x] Masking/hapus field sensitif (`pg_password`, `google_api_key`, `api_gateway_token`) via [`toSafeDbConfig`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L69-L75) dan [`toSafeIntegrationCredentials`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L80-L87) dari respons [`GET /api/master`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/master/route.ts#L14-L15) dan [`GET /api/system-params`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/system-params/route.ts#L13-L18).
- [x] **Tutup Celah Path Traversal / Arbitrary File Creation:**
  - [x] Kunci lokasi file SQLite & spreadsheet melalui [`sanitizeSafeDataFilePath`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L34-L50) di dalam `./data/`, serta matikan pembuatan direktori sembarang pada [`POST /api/system-params`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/system-params/route.ts#L59-L108) dan [`POST /api/import/drive-sync`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/import/drive-sync/route.ts#L7-L29).

### 1.2 Implementasi Login dengan JWT Authentication
- [x] **Konfigurasi & Penandatanganan JWT (`HS256` RFC 7519):**
  - [x] Buat modul [`src/lib/auth.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/auth.ts) untuk pembuatan (`signJwtToken`) dan verifikasi (`verifyJwtToken`) Access Token & Refresh Token menggunakan algoritma `HS256` dan `process.env.JWT_SECRET`.
  - [x] Sertakan klaim standar pada payload JWT: `sub` (User ID), `nipp`, `role`, `branch_id`, `department_id`, `iat`, `exp`, dan `jti` (Session ID).
- [x] **Penyimpanan Sesi via `HttpOnly` Cookie (Pengganti `localStorage`):**
  - [x] Perbarui [`POST /api/users/login`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/login/route.ts) untuk menerbitkan cookie `portsight_access_token` & `portsight_refresh_token` (`HttpOnly`, `Secure` di production, `SameSite=Lax`, `Path=/`).
  - [x] Buat endpoint [`POST /api/users/logout`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/logout/route.ts) untuk menghapus cookie JWT dan mencabut sesi.
  - [x] Buat endpoint [`GET /api/users/me`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/me/route.ts) untuk memvalidasi cookie JWT aktif saat aplikasi dimuat ulang (menggantikan pembacaan `localStorage.getItem('portsight_auth_user')` di [`src/app/page.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/page.tsx#L88-L138)).
- [x] **Audit Login & Proteksi Brute-Force:**
  - [x] Catat setiap aktivitas `LOGIN` berhasil maupun gagal ke tabel `audit_logs` via [`dbQueries.createAuditLog`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/login/route.ts#L37-L161).
  - [x] Tambahkan *rate-limiter* berbasis IP/NIPP pada [`POST /api/users/login`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/login/route.ts#L34-L61) dan samakan pesan gagal login untuk mencegah enumerasi NIPP.
  - [x] Sembunyikan panel *"Coba Login Cepat"* beserta tampilan password plaintext di [`LoginScreen.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/LoginScreen.tsx#L533-L716) dan [`AuthModal.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/AuthModal.tsx#L418-L534) saat `NODE_ENV === 'production'`.

---

## Fase 2 (P1) — Server-Side RBAC & Attribute-Based Scoping (ABAC) (SELESAI)

- [x] **Matriks Permission Terpusat ([`src/lib/rbac.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/rbac.ts)):**
  - [x] Definisikan pemetaan formal antara `UserRole` (`super_admin`, `admin_regional`, `pic_dept_regional`, `pic_cabang`, `viewer`) dengan *permissions* spesifik (`ROLE_PERMISSIONS`).
  - [x] Hapus deteksi role berbasis nama/NIPP (`String(name).includes('bod')` atau `nipp === '10000'`) di [`src/app/page.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/page.tsx#L300-L305) dan [`PortSightHeader.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/layout/PortSightHeader.tsx#L147-L150); gunakan murni klaim `role` dari sesi JWT.
- [x] **Next.js 16 Proxy & API Route Guard:**
  - [x] Buat [`src/proxy.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/proxy.ts) (konvensi resmi Next.js 16 pengganti `middleware.ts`) untuk memverifikasi JWT & *permission* pada seluruh request ke `/api/*`.
  - [x] Buat helper [`requireAuth(req, options)`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/rbac.ts#L195-L246) untuk seluruh Route Handler:
    - [x] Kunci `PUT / DELETE` pada [`/api/users`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/route.ts) dan [`/api/users/sync-drive`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/sync-drive/route.ts) hanya untuk `super_admin` dan `admin_regional`.
    - [x] Nonaktifkan pemilihan `role` bebas pada registrasi mandiri di [`LoginScreen.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/LoginScreen.tsx#L774-L781) dan kunci ke `pic_cabang` di server.
    - [x] Kunci [`POST /api/system-params`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/system-params/route.ts#L61-L63) hanya untuk `super_admin`.
    - [x] Kunci [`POST /api/verification`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/verification/route.ts#L98-L143) hanya untuk `super_admin` dan `admin_regional` berdasarkan klaim JWT (bukan `body.userRole` dari client), serta cegah *self-approval* (*Four-Eyes Principle*: `record.uploaded_by !== session.nipp`).
- [x] **Penegakan Scope Cabang & Departemen di Server (Row-Level Security):**
  - [x] Pada [`GET /api/modules-data`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/modules-data/route.ts#L64-L74), [`GET /api/records`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/records/route.ts#L5-L13), dan [`GET /api/reports/export`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/reports/export/route.ts#L7-L16): jika `session.role === 'pic_cabang'`, paksa filter cabang ke `session.branch_id` melalui [`enforceBranchFilterForRead`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/rbac.ts#L252-L261).
  - [x] Pada [`POST /api/manual-input`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/manual-input/route.ts#L79-L138) dan [`POST /api/import/commit`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/import/commit/route.ts#L11-L55): tolak (`403 Forbidden`) melalui [`validateBranchWriteAccess`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/rbac.ts#L267-L318) dan [`validateDepartmentWriteAccess`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/rbac.ts#L324-L347) jika `pic_cabang` mengirim data untuk cabang selain `session.branch_id`, atau jika `pic_dept_regional` mengirim data di luar `session.department_id`.

---

## Fase 3 (P1) — Single Source of Truth & Integritas Data

- [x] **Penyatuan Sumber Data (SQLite vs Excel):**
  - [x] Ubah [`GET /api/modules-data`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/modules-data/route.ts) agar membaca dari tabel SQLite terindeks (bukan membaca mentah `data/input_data.xlsx` di setiap request).
  - [x] Pastikan mutasi manual pada [`saveManualInputRecord`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/manualInputService.ts#L38-L558) langsung melakukan `UPSERT` ke tabel database dengan status awal `pending_verification` (untuk PIC) dan tidak langsung menimpa status `verified`.
  - [x] Pada tampilan BOD (`role === 'viewer'`), tampilkan secara default data yang berstatus `verified` atau beri indikator jelas untuk data yang masih `pending_verification`.
- [x] **Eliminasi Angka Fallback Fiktif:**
  - [x] Hapus seluruh *magic numbers* fallback pada [`PortSightBeranda.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/portsight/PortSightBeranda.tsx#L170-L580) (seperti pemaksaan pendapatan `Rp 6,79 T`, beban `0.76 * pendapatan`, atau kesiapan alat sintetis berbasis rumus modulo kode cabang).
  - [x] Bedakan secara eksplisit antara nilai `0` riil dengan status `"Belum Lapor / Tidak Tersedia"` (`null`).

---

## Fase 4 (P2) — Optimasi Performa & Paket Dependensi

- [x] **Optimasi Transaksi & Konfigurasi SQLite:**
  - [x] Aktifkan `PRAGMA journal_mode = WAL;` dan `PRAGMA synchronous = NORMAL;` serta `PRAGMA foreign_keys = ON;` pada saat inisialisasi koneksi di [`getDb()`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L67-L78).
  - [x] Bungkus seluruh operasi *bulk insert/update* di [`ingestInputData.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/ingestInputData.ts#L67-L720), [`dbQueries.insertMonthlyRecords`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L647-L683), dan [`dbQueries.updateRecordVerification`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts#L628-L644) di dalam blok transaksi `BEGIN IMMEDIATE ... COMMIT` (dengan `ROLLBACK` pada blok `catch`).
  - [x] Hentikan pemanggilan ulang `ingestInputData()` penuh setiap kali pengguna menginput 1 baris data manual di [`manualInputService.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/manualInputService.ts#L510-L535).
- [x] **Optimasi Frontend Bundle & Core Web Vitals:**
  - [x] Ganti `@import url('https://fonts.googleapis.com/...')` di [`src/app/globals.css`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/globals.css#L1) dengan `next/font/google` (`Plus_Jakarta_Sans` & `JetBrains_Mono`) di [`src/app/layout.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/layout.tsx).
  - [x] Terapkan `next/dynamic` pada [`src/app/page.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/page.tsx#L6-L23) untuk me-*lazy-load* modul tab non-utama (`PortSightKeuangan`, `PortSightOpkom`, `PortSightKinerja`, `MasterDataView`, `ImportCenter`, `ComparisonModal`, dll.).
  - [x] Gunakan `AbortController` pada `useEffect` *data fetching* di komponen modul untuk membatalkan request yang usang saat pengguna mengganti filter cabang/periode dengan cepat.
- [x] **Modernisasi Library & Keamanan Dependensi:**
  - [x] Migrasikan pemrosesan spreadsheet dari `xlsx` (`0.18.5`) ke `exceljs` atau isolasi penuh pemrosesan file unggahan dengan batas ukuran file maksimal (mis. 5 MB).
  - [x] Tambahkan `zod` untuk validasi skema input di seluruh API route.

---

## Fase 5 (P2) — Clean Code & Arsitektur Modular

- [x] **Pembersihan *Dead Code* & File Duplikat:**
  - [x] Hapus 9 komponen usang di `src/components/menus/` (`SummaryView.tsx`, `HSSEView.tsx`, `KeuanganView.tsx`, `KomersialView.tsx`, `OperasionalView.tsx`, `PelangganView.tsx`, `ProfilCabangView.tsx`, `SDMView.tsx`, `TeknikView.tsx`).
  - [x] Hapus 5 komponen tak terpakai di `src/components/portsight/` (`PortSightHSSE.tsx`, `PortSightOperasional.tsx`, `PortSightPelanggan.tsx`, `PortSightSDM.tsx`, `PortSightTeknik.tsx`) serta `src/components/layout/Header.tsx`.
  - [x] Perbaiki path hardcoded `/Users/chandra/...` pada [`scripts/keep_portdash.js`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/scripts/keep_portdash.js#L1).
- [x] **Dekomposisi *God Components*:**
  - [x] Pecah [`MasterDataView.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/MasterDataView.tsx) (2.233 baris) menjadi sub-komponen modular: [`UsersPicTab.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/master-tabs/UsersPicTab.tsx), [`KpiIndicatorsTab.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/master-tabs/KpiIndicatorsTab.tsx), [`BranchesTab.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/master-tabs/BranchesTab.tsx), [`EquipmentCatalogTab.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/master-tabs/EquipmentCatalogTab.tsx), dan [`SystemParametersTab.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/admin/master-tabs/SystemParametersTab.tsx).
  - [x] Ekstrak logika kalkulasi dan transformasi data grafik dari [`PortSightBeranda.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/portsight/PortSightBeranda.tsx) (2.158 baris) ke dalam *custom hook* / *domain selector* terpisah ([`useBerandaAnalytics.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/hooks/useBerandaAnalytics.ts)).
- [x] **Sinkronisasi State Navigasi dengan URL Search Params:**
  - [x] Sinkronkan `activeTab`, `selectedTerminal`, dan `selectedPeriod` di [`src/app/page.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/page.tsx#L29-L38) dengan URL query (`?tab=...&branch=...&period=...`) agar mendukung *bookmark*, *deep-link* antar-eksekutif, dan tombol *Back/Forward* browser.
- [x] **Eliminasi `catch {}` Kosong & `any` Berlebihan:**
  - [x] Ganti seluruh blok `catch (e) {}` kosong di [`src/lib/db.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/db.ts) dan komponen UI dengan *structured logging* atau *toast error notification*.

---

## Fase 6 (P2) — UI/UX Redesign: Anti-Slop UI, Anti-Slop Copywriting & Impeccable

### 6.1 Anti-Slop UI (Pembersihan Pola Visual Generik AI)
- [x] **Zero Emoji Policy di Seluruh Antarmuka:**
  - [x] Hapus emoji `⚡`, `🔒`, `⏳` pada [`LoginScreen.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/LoginScreen.tsx), [`AuthModal.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/AuthModal.tsx), dan [`PortSightBeranda.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/portsight/PortSightBeranda.tsx); ganti dengan ikon vektor konsisten (`strokeWidth={1.75}`).
- [x] **Color & Theme Consistency Lock:**
  - [x] Bersihkan *rainbow role buttons* dan *radial glow blob* pada [`LoginScreen.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/LoginScreen.tsx). Gunakan 1 aksen korporat utama (Pelindo Maritime Blue `#0284c7`) dan cadangkan warna Hijau/Kuning/Merah murni untuk status pencapaian KPI (*Traffic Light*).
  - [x] Hapus elemen dekoratif palsu `"DATA SIMULASI RESMI"` (beserta dot hijau menyala) dan `"Suite v2.4"` di footer [`Sidebar.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/layout/Sidebar.tsx); ganti dengan informasi faktual waktu sinkronisasi data terakhir.
  - [x] Hapus *inline hex colors* pada Drilldown Modal di [`src/app/page.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/page.tsx) dan komponen lainnya, lalu hapus selector override `[data-theme="light"] [style*="..."]` di [`src/app/globals.css`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/globals.css).

### 6.2 Anti-Slop Copywriting (Bahasa Eksekutif Presisi)
- [x] **Eliminasi Tanda Seru (`!`) & Kalimat Hiperbolis:**
  - [x] Audit dan tulis ulang seluruh pesan notifikasi/API di [`ingestInputData.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/ingestInputData.ts), [`manualInputService.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/lib/manualInputService.ts), [`users/route.ts`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/api/users/route.ts), [`LoginScreen.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/LoginScreen.tsx), dan [`AuthModal.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/auth/AuthModal.tsx) menggunakan kalimat deklaratif, tenang, dan faktual.
  - [x] Sesuaikan klaim teks *"tersinkron ke Spreadsheet My Drive (regdashr@gmail.com)"* agar jujur menjelaskan proses sebenarnya (ekspor file `.xlsx` lokal) kecuali Google Drive API telah terhubung.
- [x] **Konsistensi Bahasa & Tanda Baca:**
  - [x] Seragamkan istilah navigasi dan header ke Bahasa Indonesia korporat baku (mis. `"Kinerja Keuangan"`, `"Operasi & Komersial"`, `"Rekaman Data Kinerja"`).
  - [x] Hapus penggunaan karakter *em-dash* (`—`) dan *en-dash* (`–`) pada [`src/app/layout.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/app/layout.tsx) dan seluruh teks UI; gunakan tanda hubung standar (`-`) atau pemisah vertikal (`|`).

### 6.3 Impeccable Design Polish (Keterbacaan & Interaksi Kelas Atas)
- [x] **Format Angka Eksekutif Ringkas + *Detail-on-Demand*:**
  - [x] Format angka utama pada kartu KPI di [`PortSightBeranda.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/portsight/PortSightBeranda.tsx) ke dalam satuan teragregasi yang mudah dipindai (`Rp 6,79 T` / `Rp 485,41 M`) agar tidak terpotong di layar laptop, sementara nilai penuh hingga satuan Rupiah (`Rp 6.794.956.407.643`) ditampilkan pada *tooltip* dan *Drilldown Modal*.
- [x] **Disiplin Tipografi Numerik (`tabular-nums`):**
  - [x] Terapkan `font-variant-numeric: tabular-nums` dan perataan kanan (`text-align: right`) pada seluruh kolom angka/persentase di tabel data, kartu terminal, dan komponen matriks komparasi.
- [x] **State Siklus Penuh & Dialog Modern:**
  - [x] Tambahkan *skeleton shimmer loader* presisi saat perpindahan periode/tab di [`PortSightBeranda.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/portsight/PortSightBeranda.tsx).
  - [x] Ganti dialog `window.confirm()` pada tombol Logout di [`PortSightHeader.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/layout/PortSightHeader.tsx) dan [`Sidebar.tsx`](file:///Users/rekaskuy/Documents/ChatGPT/Dashboard%20BOD/dashboardR4/src/components/layout/Sidebar.tsx) dengan *in-app confirmation popover/dialog* yang mendukung navigasi keyboard (`Escape` / `Enter`).

---

## Audit Lanjutan (P0–P3) — Hardening Keamanan, Batas Akses, Kualitas Kode & Aksesibilitas (SELESAI)

### P0 — Tutup Celah Keamanan Kritis
- [x] Lindungi `GET /api/master` dengan autentikasi dan izin yang sesuai. Jangan kirim daftar pengguna atau konfigurasi sensitif ke pengguna yang tidak berwenang.
- [x] Lindungi `GET /api/users/export` untuk administrator yang berwenang.
- [x] Lindungi `POST /api/import/sheets-sync` dengan autentikasi, izin impor, dan identitas pengguna dari sesi server.
- [x] Lindungi `GET /api/import/drive-sync` atau hapus endpoint jika tidak diperlukan.
- [x] Tinjau pendaftaran publik di `POST /api/users`: batasi siapa yang boleh mendaftar, tetapkan cabang/departemen melalui aturan server, dan hapus kata sandi bawaan `password123`.
- [x] Hilangkan fallback secret JWT bawaan. Aplikasi harus menolak konfigurasi produksi jika `JWT_SECRET` tidak tersedia atau tidak cukup kuat.

### P1 — Tegakkan Batas Akses dan Lindungi Impor
- [x] Audit semua endpoint baca/tulis agar cakupan cabang dan departemen diterapkan di server.
- [x] Pastikan `viewer` hanya dapat membaca data yang sudah terverifikasi, termasuk saat parameter filter dimanipulasi.
- [x] Pindahkan rate limit login ke penyimpanan bersama yang tahan restart dan mendukung banyak instance.
- [x] Batasi ukuran permintaan dan jumlah baris impor, termasuk impor berbentuk JSON.
- [x] Terapkan validasi skema rinci pada setiap record impor.
- [x] Simpan record, batch, dan audit dalam transaksi yang konsisten.
- [x] Validasi format ID, nama sheet, dan range Google Sheets; tambahkan timeout permintaan.

### P2 — Tingkatkan Arsitektur dan Kualitas Kode
- [x] Samakan pola autentikasi dan otorisasi pada semua route API.
- [x] Terapkan schema validation yang konsisten untuk seluruh request.
- [x] Pisahkan aturan bisnis dan penyimpanan dari handler HTTP.
- [x] Perbaiki temuan ESLint: 261 error dan 117 warning, mulai dari file API dan autentikasi.
- [x] Perbarui `README.md` agar sesuai dengan struktur, konfigurasi, dan alur aplikasi saat ini.
- [x] Jalankan kembali pemeriksaan advisori dependency saat registry npm dapat diakses.

### P3 — Perbaiki Aksesibilitas dan Verifikasi UI
- [x] Ubah header tabel yang dapat diurutkan menjadi kontrol keyboard yang dapat difokuskan; tampilkan arah pengurutan.
- [x] Periksa navigasi keyboard, label kontrol, fokus modal, dan kontras.
- [x] Verifikasi tampilan pada layar desktop dan mobile melalui browser.
- [x] Tambahkan pemeriksaan regresi untuk alur login, izin per role, impor, dan verifikasi data.

### Kriteria Penyelesaian
- [x] Endpoint sensitif menolak permintaan tanpa sesi atau izin yang sesuai.
- [x] Cakupan cabang/departemen dan status verifikasi dipaksakan oleh server.
- [x] Impor memvalidasi input dan tersimpan konsisten sebagai satu operasi.
- [x] `npx tsc --noEmit` dan `npm run lint` selesai tanpa error.
- [x] Alur UI utama dapat digunakan dengan keyboard dan tampil baik di desktop serta mobile.

