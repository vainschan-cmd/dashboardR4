# P1 — Data Governance & Integritas Angka
**Pelindo Regional 4 (R4 PortDash Enterprise)**

Dokumen ini mendokumentasikan implementasi tata kelola data (Data Governance), aturan bisnis, alur persetujuan (approval lifecycle), serta integritas pelaporan numerik pada sistem PortDash Regional 4.

---

## 1. Database sebagai Sumber Resmi Tunggal (Single Source of Truth)
- Spreadsheet (Excel `.xlsx` / `.csv` / Google Sheets) hanya berfungsi sebagai media input atau ekspor laporan.
- Seluruh metrik kinerja dihitung, divalidasi, dan diagregasi langsung dari tabel database transaksi (`monthly_records`, `kpi_indicators`, `branches`).
- **Tidak ada fallback tersembunyi**: Angka yang tidak dilaporkan atau belum tersedia tidak digantikan secara otomatis oleh periode sebelumnya atau nominal perkiraan statis.
- Perbedaan status nilai:
  - **Nilai 0 (Nol)**: Kinerja bernilai riil 0 (misalnya: 0 kecelakaan kerja, atau tidak ada call kapal).
  - **Belum Tersedia (`null` / `-`)**: Data periode bersangkutan belum diinput atau belum disubmit oleh PIC cabang.
  - **Gagal Dimuat**: Kesalahan komunikasi server atau integritas data yang dilaporkan secara eksplisit ke pengguna.
  - **Data Simulasi (`is_simulated = 1`)**: Ditandai secara eksplisit dengan visual badge "DATA SIMULASI RESMI" agar tidak tercampur dengan audit data riil operasional.

---

## 2. Alur Approval Kinerja (Lifecycle Status)

```
[ DRAFT ]  --(Submit oleh PIC)-->  [ PENDING_VERIFICATION ]
                                            │
                     ┌──────────────────────┴──────────────────────┐
                     ▼                                             ▼
            [ REVISION_NEEDED ]                             [ VERIFIED ]
         (Dikembalikan ke PIC dgn                           (Data Resmi Regional,
          catatan perbaikan spesifik)                        Terkunci / Locked)
```

1. **Draft**: Data baru diinput oleh PIC Cabang atau Departemen. Belum masuk ke perhitungan agregat resmi BOD.
2. **Pending Verification (Submitted)**: Telah diajukan oleh PIC untuk diperiksa oleh Administrator Regional.
3. **Revision Needed**: Ditolak/dikembalikan oleh Admin Regional disertai catatan revisi (`revision_notes`) yang wajib diperbaiki oleh PIC.
4. **Verified**: Disahkan oleh Admin Regional / Departemen. Angka menjadi data konsolidasi resmi yang dibaca oleh BOD/Direksi.
5. **Self-Approval Prevention**: PIC tidak dapat mengesahkan (approve) data yang diunggah oleh dirinya sendiri.

---

## 3. RBAC (Role-Based Access Control) & Scoping

| Role | Scope Akses | Hak Input / Upload | Hak Approval / Verifikasi | Hak Ekspor & Laporan |
|---|---|---|---|---|
| **Super Admin** | Seluruh Regional (28 Cabang) | Ya (Semua) | Ya | Ya (Penuh) |
| **Admin Regional** | Seluruh Regional (28 Cabang) | Ya (Monitoring) | Ya (Mengesahkan Data) | Ya (Konsolidasi Resmi) |
| **BOD / Direksi** | Seluruh Regional (28 Cabang) | **Tidak (Hidden)** | Tidak (Read-Only) | Ya (Laporan Eksekutif) |
| **PIC Departemen** | Terkunci pada Departemen | Ya (Dept Terkait) | Ya (Review awal dept) | Ya (Dept Terkait) |
| **PIC Cabang** | Terkunci pada Cabang & NIPP | Ya (Cabang Terkait) | **Tidak** | Ya (Cabang Terkait) |

- **BOD Role Privacy**: Menu "Input Manual" dan "Tata Kelola Data" disembunyikan secara menyeluruh dari antarmuka pengguna ber-role BOD (`role === 'viewer'` atau `bod_regional`).
- **Branch Scope Lock**: PIC Cabang Makassar hanya dapat mengunggah atau mengubah record milik Makassar (`branch_id = 'term_makassar'`).

---

## 4. Formula & Aturan Agregasi

- **Pencapaian RKAP**:
  $$\text{Pencapaian (\%)} = \begin{cases} \left(\frac{\text{Realisasi}}{\text{Target RKAP}}\right) \times 100\% & \text{jika higher is better} \\ \left(2 - \frac{\text{Realisasi}}{\text{Target RKAP}}\right) \times 100\% & \text{jika lower is better (cth: kecelakaan/downtime)} \end{cases}$$
- **Pertumbuhan YoY (Year-over-Year)**:
  $$\Delta \text{YoY (\%)} = \frac{\text{Realisasi } t - \text{Realisasi } (t-1)}{\text{Realisasi } (t-1)} \times 100\%$$
- **Laba Usaha**:
  $$\text{Laba Usaha} = \text{Total Pendapatan Usaha} - \text{Total Beban Biaya}$$
- **Agregasi Regional**:
  - Untuk indikator volume (Call Kapal, TEUs, Ton, Penumpang, Rupiah Pendapatan/Beban): **Penjumlahan Total (Sum)** seluruh cabang terverifikasi.
  - Untuk indikator rasio/persentase (BOR, RFU Alat, CSAT): **Rata-rata Terbobot (Weighted Average)** terhadap kapasitas dermaga/jumlah unit alat.

---

## 5. Audit Trail & Idempotency
- Setiap operasi mutasi (Create, Update, Delete, Import, Approve, Reject) mencatat log ke tabel `audit_logs`:
  - `user_id`, `user_name`, `user_role`
  - `action`, `entity`, `entity_id`
  - `details` (JSON perubahan data sebelum dan sesudah)
  - `timestamp` (ISO UTC)
  - `ip_address`
- Batch import menggunakan transaksi atomik (`BEGIN TRANSACTION` ... `COMMIT`). Apabila terdapat kesalahan validasi pada satu baris, seluruh batch dibatalkan (`ROLLBACK`) guna mencegah data setengah tersimpan.
