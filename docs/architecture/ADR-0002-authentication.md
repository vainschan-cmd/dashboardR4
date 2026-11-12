# ADR-0002 — Autentikasi: JWT HS256 buatan sendiri dengan registry sesi di basis data

- **Status:** Diterima
- **Tanggal:** 2026-11-12
- **Konteks item tasklist:** `CODE-14`, `AUTH-01` … `AUTH-09`
- **Pengambil keputusan:** Tim ICT Regional 4

---

## 1. Konteks

Aplikasi harus memenuhi kebutuhan berikut tanpa menambah lapangan penyedia identitas:

| Kebutuhan | Alasan |
|---|---|
| Login dengan NIPP (bukan email) | NIPP adalah identitas yang sudah dipakai seluruh PIC Pelindo. |
| Lima peran dengan cakupan berbeda | `super_admin`, `admin_regional`, `pic_dept_regional`, `pic_cabang`, `viewer`. |
| Pencabutan sesi seketika | Akun dinonaktifkan atau kata sandi direset harus langsung memutus sesi aktif. |
| Tanpa Infrastruktur tambahan | Satu server, satu berkas basis data, di belakang Cloudflare Tunnel. |
| Siap audit | Setiap perubahan kredensial dan setiap sesi harus dapat ditelusuri. |

## 2. Keputusan

**JWT HS256 yang ditandatangani sendiri, dipasangkan dengan tabel `auth_sessions` di SQLite.**

Komponen:

1. **Token akses** umur 15 menit, disimpan di cookie `HttpOnly` (`__Host-` di produksi).
2. **Token refresh** umur lebih panjang, cookie terpisah.
3. **`token_version` per pengguna.** Menaikkan nilai ini (reset sandi, ubah peran, nonaktifkan akun) membuat seluruh token lama tidak valid tanpa perlu menyentuh daftar token.
4. **`auth_sessions`** mencatat `jti`, `user_id`, `token_version`, IP, agen pengguna, dan waktu. Setiap permintaan memverifikasi bahwa sesi masih terdaftar dan belum dicabut.
5. **Idle timeout** dari parameter sistem, diperiksa saat resolusi sesi.
6. **Scrypt** untuk kata sandi (`N=16384`), versi asinkron di jalur permintaan.

## 3. Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| **Sesi di memori proses** | Hilang saat restart; tidak dapat mencabut sesi lintas proses; tidak dapat diaudit. |
| **JWT stateless murni (tanpa registry)** | Tidak ada cara mencabut token sebelum kedaluwarsa. Untuk dashboard keuangan dengan peran sensitif, jendela 15 menit tanpa pencabutan tidak dapat diterima. |
| **NextAuth / Auth.js** | Menambah dependensi dan model sesi sendiri, sementara identitas sumbernya NIPP + tabel `users` lokal. Biaya integrasi lebih besar daripada ~200 baris kode yang sekarang ada dan sudah diuji. |
| **OAuth/OIDC korporat** | Belum tersedia untuk aplikasi internal ini. Bila kelak ada, ADR ini yang perlu diganti — lihat §6. |
| **Basic Auth / API key statis** | Tidak ada peran, tidak ada pencabutan, tidak ada audit per pengguna. |

## 4. Konsekuensi

**Positif**

- Pencabutan seketika: `token_version` naik → semua token lama ditolak pada permintaan berikutnya.
- Setiap sesi punya jejak audit (`auth_sessions`) yang bisa dibaca operator.
- Tidak ada dependensi auth pihak ketiga.

**Negatif / risiko yang diterima**

- Kriptografi ditulis sendiri. Mitigasi: hanya memakai primitif `node:crypto` (`createHmac`, `scrypt`, `timingSafeEqual`), tidak ada implementasi algoritma buatan sendiri, dan perbandingan selalu waktu-konstan.
- Rotasi `JWT_SECRET` memaksa semua pengguna login ulang. Ini disengaja dan didokumentasikan di runbook.
- Skala horizontal terbatas: registry sesi ada di SQLite, jadi dua instance tidak berbagi pencabutan. Selaras dengan ADR-0001 (PostgreSQL sebelum multi-instance).

## 5. Aturan implementasi yang mengikat

1. Perubahan kata sandi **hanya** lewat `POST /api/users/password`, yang menaikkan `token_version` dan mencabut sesi lain.
2. `PUT /api/users` menolak field `password` (400) agar tidak ada jalur perubahan kredensial yang melewati aturan di atas.
3. Keputusan otorisasi **tidak boleh** membandingkan peran dengan literal di route; semuanya lewat `authorize()` di `src/lib/policy.ts`.
4. Cookie hanya `HttpOnly` + `SameSite=Lax`; di produksi wajib `Secure` dengan prefiks `__Host-`.
5. Rate limit login: 5 kegagalan per pasangan IP+NIPP mengunci 15 menit (`auth_rate_limits`).

## 6. Pemicu peninjauan ulang

ADR ini harus ditinjau bila salah satu terjadi:

- Korporat menyediakan OIDC/SSO → ganti penerbitan token, pertahankan `auth_sessions` sebagai cache pencabutan.
- Aplikasi berjalan lebih dari satu instance → pindahkan `auth_sessions` dan `auth_rate_limits` ke penyimpanan bersama (lihat ADR-0001).
- Muncul kebutuhan MFA → lihat catatan `AUTH-10` yang sengaja ditunda.
