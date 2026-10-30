import * as XLSX from 'xlsx';
import { MonthlyRecord, TemplateConfig, Branch, KPIIndicator } from './types';

export function generateTemplateWorkbook(
  template: TemplateConfig,
  sampleBranches: Branch[],
  indicators: KPIIndicator[]
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Data Input Sheet
  const headers = template.columns.map(c => c.column_name);
  const sampleRows: any[][] = [headers];

  const targetBranch = sampleBranches[0] || { code: 'CBG-TGPRK', name: 'Cabang Tanjung Priok' };
  indicators.forEach((ind, idx) => {
    const row = template.columns.map(col => {
      switch (col.field_key) {
        case 'branch_code':
          return targetBranch.code;
        case 'branch_name':
          return targetBranch.name;
        case 'department_code':
          return 'OPS';
        case 'month':
          return 4;
        case 'year':
          return 2026;
        case 'indicator_code':
          return ind.code;
        case 'indicator_name':
          return ind.name;
        case 'target':
          return ind.default_target;
        case 'realization':
          return Number((ind.default_target * (0.95 + idx * 0.02)).toFixed(2));
        case 'unit':
          return ind.unit;
        case 'notes':
          return 'Contoh input data bulanan resmi';
        default:
          return col.sample_value || '';
      }
    });
    sampleRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Input_Kinerja');

  // 2. Reference Sheet for Branches & Indicators (Petunjuk Pengisian)
  const refRows: any[][] = [
    ['PETUNJUK PENGISIAN TEMPLATE SPREADSHEET KINERJA PELABUHAN'],
    ['1. Jangan mengubah nama kolom pada baris pertama (Header).'],
    ['2. Kode Cabang dan Kode Indikator wajib mengacu pada daftar referensi di bawah ini.'],
    ['3. Kolom Target dan Realisasi harus berupa angka numerik tanpa karakter mata uang atau simbol.'],
    ['4. Format bulan: angka 1 - 12 (contoh: 1 untuk Januari, 12 untuk Desember).'],
    [''],
    ['DAFTAR MASTER CABANG RESMI:'],
    ['Kode Cabang', 'Nama Cabang', 'Wilayah / Regional'],
    ...sampleBranches.map(b => [b.code, b.name, b.region]),
    [''],
    ['DAFTAR INDIKATOR TERSEDIA:'],
    ['Kode Indikator', 'Nama Indikator', 'Satuan', 'Arah Target (Higher/Lower is Better)'],
    ...indicators.map(i => [i.code, i.name, i.unit, i.direction === 'higher_is_better' ? 'Semakin Tinggi Semakin Baik' : 'Semakin Rendah Semakin Baik'])
  ];
  const wsRef = XLSX.utils.aoa_to_sheet(refRows);
  XLSX.utils.book_append_sheet(wb, wsRef, 'Petunjuk_&_Referensi');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}

export function exportRecordsToExcel(
  records: MonthlyRecord[],
  title = 'Laporan_Kinerja_Pelabuhan'
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const dataRows = records.map(r => ({
    'ID Record': r.id,
    'Tahun': r.year,
    'Bulan': r.month,
    'Kode Cabang': r.branch_code || r.branch_id,
    'Nama Cabang': r.branch_name || '-',
    'Departemen': r.department_name || r.department_id,
    'Kode Indikator': r.indicator_code || r.indicator_id,
    'Nama Indikator': r.indicator_name || '-',
    'Target': r.target,
    'Realisasi': r.realization,
    'Satuan': r.unit,
    'Capaian (%)': r.achievement_pct,
    'Status Indikator': r.status_color.toUpperCase(),
    'Status Verifikasi': r.verification_status,
    'Catatan Revisi': r.revision_notes || '-',
    'Waktu Upload': r.uploaded_at,
    'Pengunggah': r.uploaded_by,
    'Verifikator': r.verified_by || '-',
    'Waktu Verifikasi': r.verified_at || '-',
    'Klasifikasi Data': r.is_simulated ? 'DATA SIMULASI' : 'DATA RESMI'
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Kinerja');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}
