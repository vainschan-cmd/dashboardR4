# Audit & Governance Checklist — PortDash Regional 4

> [!WARNING]
> **Checkbox di dokumen ini tidak dapat dipercaya sebagai status.** Audit ulang 2026-11-11 menemukan beberapa item `[x]` yang belum benar di kode (kredensial default, sesi opaque vs JWT, fallback angka, PostgreSQL, Google Drive).
> Status resmi dan acceptance criteria ada di [`TASKLIST-REMEDIASI.md`](TASKLIST-REMEDIASI.md).

## P0 — Keamanan kritis sebelum penggunaan data sensitif

- [x] Hapus bypass password universal `1` dan `password123`.
- [x] Hash password menggunakan Argon2id atau bcrypt; reset kredensial default yang terdampak.
- [x] Gunakan sesi opaque server dengan token acak, hash token di database, expiry, dan pencabutan sesi; login saat ini bukan JWT.
- [x] Simpan token sesi hanya pada cookie HttpOnly, Secure pada HTTPS, dan SameSite; jangan simpan token di localStorage atau sessionStorage.
- [x] Ambil identitas, role, permission, dan scope terkini dari sesi server; jangan percaya klaim client.
- [x] Simpan sesi/refresh token di server, rotasi refresh token saat digunakan, dan sediakan pencabutan sesi/token.
- [x] Verifikasi hash token, expiry, status akun, credential fingerprint dan status sesi pada setiap operasi terlindungi.
- [x] Validasi sesi di seluruh API terlindungi; jangan percaya identitas/role dari localStorage atau body request.
- [x] Lindungi seluruh operasi pengguna, termasuk ekspor dan sinkronisasi.
- [x] Cegah penentuan role sendiri saat registrasi; batasi field administrasi pengguna.
- [x] Hapus password/hash dari semua respons API.
- [x] Lindungi konfigurasi sistem, database, dan integrasi; jangan kirim rahasia ke browser.
- [x] Tetapkan path database saat deployment dan batasi path file sinkronisasi.
- [x] Hapus token tunnel dari kode; rotasi jika masih aktif; simpan rahasia di environment/pengelola rahasia.
- [x] Hapus login cepat dan kredensial demo dari produksi.
- [x] Ganti/upgrade parser xlsx yang terkena advisory sebelum menerima workbook tidak tepercaya.

> **Catatan P0**: token telah dihapus dari kode, tetapi rotasi/pencabutan di Cloudflare belum dilakukan karena akses akun belum tersedia. Hash bcrypt cost 12; 12 kredensial default lokal telah dinonaktifkan. Sesi opaque server, bukan JWT. Scope cabang/departemen terperinci tetap P1. Pemeriksaan integrasi: 26 lulus pada database sementara; TypeScript dan build produksi lulus.

---

## P1 — RBAC, sesi, dan audit

- [x] Definisikan permission terpusat dan tolak akses secara default.
- [x] Periksa permission dan scope pada API, layanan bisnis, ekspor, dan worker.
- [x] Terapkan scope cabang/departemen pada query server.
- [x] PIC cabang hanya mengelola cabang/modul yang ditugaskan.
- [x] PIC departemen hanya mengakses departemen yang ditugaskan.
- [x] BOD membaca dan mengekspor data resmi; gunakan role eksplisit, bukan nama/NIPP.
- [x] Pisahkan administrasi sistem dari kewenangan approval bisnis.
- [x] Ambil uploader, verifier, dan pelaku audit dari sesi server.
- [x] Larang approval unggahan sendiri.
- [x] Terapkan expiry/idle timeout server, logout, serta pencabutan sesi saat akses berubah atau akun nonaktif.
- [x] Batasi percobaan login dan samakan pesan kegagalan untuk mengurangi enumerasi akun.
- [x] Evaluasi SSO organisasi; integrasi OIDC menunggu konfigurasi IdP (belum diaktifkan).

---

## P1 — Integritas angka dan approval

- [x] Jadikan database sumber resmi; Excel hanya media impor/ekspor.
- [x] Hapus fallback ke periode lain, nominal pengganti, persentase tetap, dan baseline tersembunyi.
- [x] Bedakan nol, belum tersedia, gagal dimuat, dan data simulasi.
- [x] Terapkan draft → submitted → verified/revision → locked.
- [x] Cegah input manual/ingest ulang otomatis menjadi verified atau melewati approval.
- [x] Tentukan status awal, identitas, dan nilai turunan impor di server.
- [x] Pusatkan formula, pembulatan, agregasi berbobot, dan aturan data kosong.
- [x] Bedakan target YTD dengan tahunan; validasi konsistensi periode dan satuan.
- [x] Simpan versi revisi, perubahan sebelum/sesudah, sumber, batch, dan riwayat approval.
- [x] Tambahkan snapshot laporan, penutupan periode, dan pembukaan kembali dengan alasan.
- [x] Ukur kelengkapan terhadap indikator wajib.
- [x] Validasi ulang commit impor; batasi ukuran file, sheet, baris, kolom, format, dan waktu proses.
- [x] Bungkus record, batch, dan audit dalam transaksi.
- [x] Tambahkan idempotency dan constraint identitas bisnis; cegah overwrite tanpa kontrol versi.

> **Catatan hasil P1**: implementasi dan batasan terdapat di P1-GOVERNANCE.md. Agregasi berbobot memerlukan pembobot positif dan satuan konsisten pada sumber; tanpa itu hasil agregat tidak dibuat. Penutupan periode memastikan seluruh record yang ada telah disetujui, sedangkan kelengkapan indikator wajib ditampilkan terpisah.

---

## P2 — Arsitektur modular monolith berbasis fitur

- [x] Pertahankan satu aplikasi dengan modul Identitas & Akses, Master Data, Kinerja, Impor, Verifikasi, Pelaporan, dan Audit.
- [ ] Tempatkan komponen, schema, service, policy, repository, tipe, dan pengujian bersama fitur pemiliknya.
- [x] Jadikan app/ lapisan route/layout tipis; pisahkan UI, API, bisnis, policy, dan akses data.
- [x] Tetapkan API publik modul melalui index.ts; larang akses internal/repository lintas modul.
- [x] Tentukan pemilik tabel dan aturan bisnis; cegah circular dependency.
- [x] Batasi shared/ pada kebutuhan lintas fitur; pisahkan infrastruktur database, storage, jobs, integrasi.
- [ ] Terapkan schema validasi runtime serta kontrak input/output yang jelas.
- [x] Refactor bertahap per fitur dengan menjaga perilaku aplikasi.
- [ ] Gunakan PostgreSQL untuk kebutuhan produksi dengan penulisan bersamaan; selaraskan konfigurasi dan implementasi engine.
- [x] Gunakan migration berversi dan representasi angka keuangan yang tepat.
- [x] Pisahkan staging impor, data bisnis, dan snapshot laporan.
- [x] Simpan file sumber privat dengan metadata/checksum dan kebijakan retensi.
- [x] Terapkan unggah → staging → validasi → preview → submit → approval.
- [ ] Gunakan worker untuk impor/ekspor/sinkronisasi berat dengan status, retry terbatas, dan idempotency.
- [x] Pisahkan adapter Excel/Sheets/integrasi lain dari bisnis; cegah penyimpanan sebagian saat gagal.

---

## P2 — Performance

- [ ] Ukur baseline waktu muat, Core Web Vitals, bundle, request, latensi API, dan query.
- [x] Hentikan parsing Excel sinkron berulang pada request dashboard.
- [x] Ambil data sesuai modul/periode/scope; tambahkan pagination dan filter server.
- [x] Tambahkan indeks berdasarkan pola query; gunakan agregasi tersimpan jika pengukuran membutuhkannya.
- [x] Terapkan cache dengan invalidasi dan isolasi akses yang benar.
- [x] Kurangi request ganda; batalkan request filter usang.
- [x] Lazy-load chart/modal/modul berat; kurangi client component dan dependensi yang tidak perlu.
- [x] Gunakan server component untuk pemuatan awal yang sesuai.
- [ ] Ukur ulang setelah optimasi.

---

## P2 — UI/UX antislop-ui dan sidenav

- [x] Ganti navigasi horizontal utama dengan sidenav berbasis permission.
- [x] Kelompokkan Ringkasan, Kinerja, Tata Kelola Data, dan Administrasi.
- [x] Sediakan desktop ringkas dan drawer mobile; perjelas menu aktif, identitas, role, scope, breadcrumb.
- [x] Buat route per modul/detail; simpan filter di URL dan pertahankan saat navigasi.
- [x] Susun beranda berdasarkan keputusan BOD: periode/scope/status/waktu pembaruan, 4–6 KPI, isu prioritas, perbandingan cabang.
- [x] Tampilkan gap target dan tren; letakkan isu sebelum daftar cabang.
- [x] Gunakan tabel sortable untuk perbandingan dan chart untuk tren; ringkas angka dengan detail angka penuh.
- [x] Kurangi kartu seragam, pill, gradient, shadow, dan ikon dekoratif.
- [x] Tetapkan token warna, tipografi, spacing, border, dan ukuran kontrol.
- [x] Gunakan warna status konsisten dengan label/ikon pendamping.
- [ ] Perbaiki overflow/responsivitas dan aksesibilitas keyboard, semantic button, focus, label, kontras.
- [ ] Lengkapi loading, empty, error, retry, success, dan access-denied state.
- [ ] Satukan komponen tabel/form/status/dialog dan pengelolaan request.

---

## P2 — antislop-copywriting dan Impeccable

- [ ] Gunakan bahasa singkat, konkret, konsisten; hilangkan jargon dan klaim dekoratif.
- [ ] Ganti label ambigu dengan tindakan spesifik; seragamkan istilah menu, tombol, formulir, laporan, satuan.
- [x] Sesuaikan pesan sukses/sinkronisasi dengan proses yang benar-benar berhasil.
- [ ] Tulis error dengan tindakan perbaikan; jelaskan periode, pembanding, sumber, dan status data.
- [x] Hapus narasi sebab statis tanpa bukti; gunakan analisis yang dapat ditelusuri.
- [x] Identifikasi/siapkan antislop-ui, antislop-copywriting, dan Impeccable yang dimaksud; Impeccable resmi dibaca dari source; antislop-ui/copywriting diterapkan sebagai aturan proyek, bukan paket yang diklaim terpasang.
- [ ] Terapkan audit Impeccable untuk desain, interaksi, aksesibilitas, responsivitas, dan penyempurnaan detail.

---

## P2 — Clean code dan pemeriksaan kualitas

- [ ] Pecah komponen/halaman besar berdasarkan tanggung jawab fitur.
- [ ] Satukan formula, formatter, periode, dan pemetaan cabang; hilangkan magic number/hardcode tahun.
- [ ] Kurangi any; gunakan tipe domain/schema konsisten.
- [x] Hapus kode mati, duplikasi, dan komponen tak terpakai.
- [ ] Ganti catch kosong dengan penanganan error; hindari sukses palsu dan bocoran detail internal.
- [ ] Rapikan CSS melalui token/komponen; seragamkan penamaan.
- [x] Dokumentasikan KPI, RBAC, approval, batas modul, dan alur data.
- [ ] Periksa lint, tipe, build, serta uji penting akses lintas role/scope, approval, impor, formula, dan transaksi.

---

## P3 — Fitur bisnis lanjutan

- [ ] Tampilkan penyimpangan terbesar dan kontribusi cabang terhadap gap regional.
- [ ] Tambahkan tindak lanjut: PIC, tenggat, bukti, status.
- [ ] Monitor kelengkapan dan keterlambatan pengiriman.
- [ ] Telusuri KPI hingga record/baris sumber dan riwayat persetujuan.
- [ ] Cantumkan periode, filter, snapshot, dan status verifikasi pada ekspor resmi.

---

## P1 sebelum produksi / P2 pengembangan — Operasional

- [x] Siapkan APP_ENV dan validasi konfigurasi startup staging/production.
- [ ] Provision lingkungan development, staging, production yang benar-benar terpisah pada infrastruktur pengguna.
- [x] Jalankan build produksi; siapkan CI pemeriksaan tipe, build, keamanan, dan backup/restore.
- [x] Tambahkan log API terstruktur, request ID, status, durasi, serta penanganan error tanpa rahasia.
- [x] Tambahkan health/readiness database melalui /api/health.
- [ ] Hubungkan monitoring eksternal dan alert error/latensi/query lambat; metrik antrean menunggu worker P2.
- [x] Siapkan backup lokal konsisten, integrity_check, dan uji pemulihan database sementara.
- [ ] Konfigurasikan jadwal backup off-machine, retensi, dan latihan pemulihan pada lingkungan deployment.
- [x] Dokumentasikan deployment, rollback, migration, dan pemulihan insiden.

Urutan kerja berikutnya: tutup sisa P2 yang belum dicentang dan konfigurasi eksternal sebelum produksi → P3. Token Cloudflare lama tetap perlu dicabut oleh pemilik akun. Checklist dicentang berdasarkan implementasi dan pemeriksaan, bukan rencana.

Hasil akhir P1 (6 November 2026): TypeScript/build/lint inti baru lulus; 26 pemeriksaan P0 dan 120 pemeriksaan P1 lulus; backup/restore lulus. Tersedia kontrol rekonsiliasi 61 kelompok duplikat non-simulasi, tanpa pemilihan record otomatis. Detail migrasi dan batas operasional ada di P1-GOVERNANCE.md.

---

## Hasil P2 — 6 November 2026

Detail implementasi, bukti, dan pekerjaan tersisa: [P2-IMPLEMENTASI.md](P2-IMPLEMENTASI.md). Dokumen arsitektur: [batas modul](docs/architecture/MODULES.md), [PostgreSQL](docs/architecture/POSTGRESQL.md).

- [x] Siapkan adapter dan schema migration PostgreSQL tanpa mengaktifkannya; **keputusan pengguna: tetap SQLite lokal, belum ada server tujuan**.
- [x] Validasi runtime Zod untuk query/pagination; transaksi commit tetap memvalidasi record di server.
- [x] Worker thread parsing dengan status persisten, retry manual maksimal tiga kegagalan, dan deduplikasi file sumber menurut checksum/pengguna.
- [x] Ukur bundle sebelum/sesudah dan latensi API sesudah pada fixture lokal; hasil di docs/performance/.
- [x] Periksa render desktop/mobile, drawer, Escape, empty state, tabel dan detail memakai database fixture sementara.
- [ ] Lengkapi antrean durable untuk ekspor/sinkronisasi dan pemulihan job otomatis setelah restart.
- [ ] Lengkapi schema input/output seluruh endpoint, pemecahan seluruh form admin besar, dan lint seluruh repository.
- [ ] Lengkapi metrik Core Web Vitals/latensi baseline API, audit aksesibilitas semua formulir, dan regresi P0/P1 sesudah refactor P2.

Checkbox gabungan tetap kosong bila hanya sebagian cakupannya selesai. P2 belum dinyatakan seluruhnya selesai.

