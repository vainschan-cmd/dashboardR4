# ADR-0004 — Batas modul: dari `db.ts` monolitik menuju repository

- **Status:** Diterima sebagian (langkah 1–2 selesai, langkah 3 belum)
- **Tanggal:** 2026-11-12
- **Konteks item tasklist:** `CODE-14`, `CODE-03`, `CODE-04`
- **Pengambil keputusan:** Tim ICT Regional 4

---

## 1. Konteks

`src/lib/db.ts` berisi ±1.900 baris dan memegang seluruh tanggung jawab berikut sekaligus:

| Tanggung jawab | Contoh isi |
|---|---|
| Definisi skema | 30+ `CREATE TABLE`, seluruh indeks |
| Migrasi | sekarang ditangani `migrations.ts` (lihat di bawah) |
| Query pengguna | `getUserByNipp`, `createUser`, `updateUser`, `toSafeUser` |
| Query modul | `getMonthlyRecords`, `getMonthlyRecordsByIds`, enam tabel `module_*` |
| Pengaturan | `integration_settings`, `system_params`, enkripsi kredensial |
| Housekeeping | pembersihan sesi, rate limit, `purgeStaleAuthData` |
| Seeding | pengguna awal, cabang resmi, data simulasi |

Akibatnya:
- Setiap perubahan kecil menyentuh berkas yang sama → konflik merge terus-menerus.
- Tidak ada batas yang jelas antara "akses data" dan "aturan domain".
- `CODE-04` (siklus `db.ts` ↔ `userPicSync.ts`) dan siklus `db.ts` ↔ `auth.ts` muncul justru karena semua hal ada di satu tempat.

## 2. Keputusan

Menuju pemisahan bertahap, **bukan** penulisan ulang sekaligus.

**Langkah yang sudah selesai:**

1. Data seed pengguna dipindah ke `src/lib/userSeed.ts` — modul tanpa dependensi (hanya tipe), sehingga `db.ts` dan `userPicSync.ts` tidak lagi saling impor.
2. Hashing kata sandi dipindah ke `src/lib/passwordHash.ts` — hanya bergantung pada `node:crypto`, memutus siklus `db.ts` ↔ `auth.ts`.
3. Migrasi skema dipindah ke `src/lib/migrations.ts` — bernomor, tercatat di `schema_migrations`, dengan `up`/`down` dan status.
4. Grafik dependensi `src/lib` dijaga bebas siklus oleh `tests/unit/moduleGraph.test.ts`, yang gagal bila ada impor melingkar baru.

**Langkah berikutnya (belum dikerjakan, dicatat agar tidak hilang):**

5. `src/lib/repositories/{users,records,modules,audit,settings}.ts` — pindahkan `dbQueries` ke berkas per-domain; `db.ts` hanya menyisakan `getDb`, `initSchema`, dan re-export.
6. Setelah itu, `db.ts` di bawah 250 baris dan tidak ada nama tabel yang muncul di lebih dari satu repository.

## 3. Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| **Penulisan ulang penuh sekaligus** | Tidak ada uji integrasi yang cukup untuk menahan regresi pada 1.900 baris yang dipakai seluruh aplikasi. Risiko kehilangan data lebih besar daripada manfaat kerapian. |
| **Membiarkan satu berkas** | Siklus impor dan konflik merge adalah gejala, bukan masalah kosmetik; keduanya sudah menghasilkan bug nyata (`CODE-04`). |
| **ORM (Prisma/Drizzle)** | Menambah toolchain dan langkah generate ke proses build, sementara query sekarang ditulis tangan dan sudah dioptimasi lewat `EXPLAIN QUERY PLAN`. Lihat ADR-0001. |

## 4. Konsekuensi

**Positif**

- Tiga siklus/ketergantungan gelap hilang tanpa mengubah perilaku.
- Migrasi kini dapat diaudit (`migrationStatus()`) dan dibatalkan.
- Batas modul yang sudah ada menjadi preseden untuk langkah berikutnya.

**Negatif**

- `db.ts` masih besar; pemisahan repository adalah pekerjaan `L` yang belum dijadwalkan.
- Sementara `dbQueries` masih menjadi satu objek, "modul" hanya ditandai komentar, bukan dipaksakan oleh tipe.

## 5. Aturan implementasi yang mengikat

1. Modul baru di `src/lib` tidak boleh membentuk siklus; `tests/unit/moduleGraph.test.ts` adalah gate-nya.
2. Data statis (seed, konstanta) tidak boleh mengimpor lapisan akses data.
3. Perubahan skema **wajib** lewat `migrations.ts` dengan nomor baru; jangan menambah `ALTER TABLE` ad-hoc.
4. Migrasi yang sudah tercatat tidak boleh diubah isinya — tambahkan migrasi baru.

## 6. Pemicu peninjauan ulang

- `db.ts` melewati 2.500 baris, atau
- dua orang perlu menyunting berkas itu pada pekan yang sama, atau
- muncul kebutuhan multi-instance yang memaksa lapisan repository terpisah.
