# ADR-0003 — Integrasi Google Sheets/Drive: klaim vs kenyataan

- **Status:** Diterima (sebagai deskripsi keadaan), dengan keputusan menunda integrasi penuh
- **Tanggal:** 2026-11-12
- **Konteks item tasklist:** `CODE-14`, `FEAT-04`, `DEP-05`
- **Pengambil keputusan:** Tim ICT Regional 4

---

## 1. Konteks

Antarmuka menyebut "Google Drive" dan "Google Sheets" di beberapa tempat: label tombol, pesan sukses, dan nama menu `ImportCenter`. Audit menemukan bahwa **tidak ada panggilan HTTP ke API Google sama sekali**. Yang terjadi saat pengguna menekan tombol sinkronisasi:

| Klaim di UI | Yang sebenarnya dijalankan |
|---|---|
| "Sinkronisasi dari Google Drive" | Menyalin berkas dari folder `~/Downloads` lokal ke `data/`. |
| "Ekspor ke Google Drive" | Menulis `.xlsx` ke `data/` lalu menyalinnya ke `~/Downloads`. |
| "Google Sheets" | Membaca berkas Excel lokal dengan SheetJS. |
| `google_api_key` di konfigurasi | Disimpan (kini terenkripsi), tetapi tidak pernah dipakai. |

Ini bukan sekadar fitur yang belum selesai: **label yang menjanjikan integrasi yang tidak ada membuat operator percaya datanya tersimpan di awan padahal hanya ada di satu disk.**

## 2. Keputusan

1. **Menunda integrasi Google yang sebenarnya.** Tidak ada dependensi Google SDK di proyek, tidak ada kredensial OAuth yang tersedia, dan tidak ada pemilik proses yang akan memelihara token.
2. **Menyesuaikan copy agar jujur.** Setiap label yang menyebut Google Drive/Sheets diganti dengan deskripsi yang sesuai perilaku nyata ("berkas lokal", "unduh Excel"). Penyimpanan `google_api_key` dipertahankan sebagai tempat kredensial bila integrasi dikerjakan.
3. **Menjaga `data/` dan `~/Downloads` sebagai mekanisme pertukaran berkas** sampai integrasi nyata ada.

## 3. Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| **Mengimplementasikan Google Sheets API sekarang** | Butuh proyek Google Cloud, kredensial OAuth, dan pemilik yang memperpanjang token. Tidak ada satu pun yang tersedia; hasilnya akan menjadi integrasi setengah jadi yang lebih berbahaya daripada tidak ada. |
| **Menyembunyikan seluruh menu impor** | Kemampuan impor Excel/CSV lokal berfungsi dan dibutuhkan PIC. Yang salah adalah labelnya, bukan fiturnya. |
| **Membiarkan label apa adanya** | Menyesatkan operator dan menyulitkan audit. Lihat §1. |

## 4. Konsekuensi

**Positif**

- Tidak ada lagi klaim yang tidak dapat dibuktikan.
- Operator tahu bahwa berkas berada di server ini dan perlu masuk ke proses backup (`docs/operations/BACKUP-RESTORE.md`).

**Negatif**

- Pertukaran data tetap manual (unduh, edit, unggah).
- `google_api_key` menjadi kredensial yang tersimpan tanpa pemakai. Risikonya kecil (terenkripsi, tidak pernah dikirim) tetapi tetap harus dicatat.

## 5. Aturan implementasi yang mengikat

1. Jangan memberi label "Google" pada operasi yang tidak memanggil API Google.
2. Pesan sukses harus menyebut lokasi berkas yang sebenarnya.
3. Bila integrasi dikerjakan, ganti ADR ini dan tambahkan uji integrasi yang gagal bila kredensial tidak ada.

## 6. Pemicu peninjauan ulang

- Tersedianya kredensial OAuth korporat dan pemilik proses.
- Kebutuhan nyata untuk multi-pengguna menyunting satu spreadsheet bersama.
