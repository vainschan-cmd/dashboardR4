import * as XLSX from 'xlsx';
import { MonthlyRecord, TemplateConfig, Branch, KPIIndicator } from './types';

/**
 * Neutralize spreadsheet formula-prefix characters (`=`, `+`, `-`, `@`, `\t`, `\r`)
 * so exported strings cannot be evaluated as formulas if re-saved or pasted (`SA-28`).
 */
export function neutralizeFormulaCell(value: unknown): string {
  const str = String(value ?? '');
  if (/^[\s\t\r]*[=+\-@]/.test(str) || str.startsWith('\t') || str.startsWith('\r')) {
    return `'${str}`;
  }
  return str;
}

export function generateTemplateWorkbook(
  template: TemplateConfig,
  sampleBranches: Branch[],
  indicators: KPIIndicator[]
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Data Input Sheet
  const headers = template.columns.map(c => neutralizeFormulaCell(c.column_name));
  const sampleRows: Array<Array<string | number>> = [headers];

  const targetBranch = sampleBranches[0] || { code: 'CBG-TGPRK', name: 'Cabang Tanjung Priok' };
  indicators.forEach((ind, idx) => {
    const row = template.columns.map(col => {
      switch (col.field_key) {
        case 'branch_code':
          return neutralizeFormulaCell(targetBranch.code);
        case 'branch_name':
          return neutralizeFormulaCell(targetBranch.name);
        case 'department_code':
          return 'OPS';
        case 'month':
          return 4;
        case 'year':
          return 2026;
        case 'indicator_code':
          return neutralizeFormulaCell(ind.code);
        case 'indicator_name':
          return neutralizeFormulaCell(ind.name);
        case 'target':
          return ind.default_target;
        case 'realization':
          return Number((ind.default_target * (0.95 + idx * 0.02)).toFixed(2));
        case 'unit':
          return neutralizeFormulaCell(ind.unit);
        case 'notes':
          return 'Contoh input data bulanan resmi';
        default:
          return typeof col.sample_value === 'number'
            ? col.sample_value
            : neutralizeFormulaCell(col.sample_value || '');
      }
    });
    sampleRows.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Input_Kinerja');

  // 2. Reference Sheet for Branches & Indicators (Petunjuk Pengisian)
  const refRows: Array<Array<string | number>> = [
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
  _title = 'Laporan_Kinerja_Pelabuhan'
): Uint8Array {
  void _title;
  const wb = XLSX.utils.book_new();

  const dataRows = records.map(r => ({
    'ID Record': neutralizeFormulaCell(r.id),
    'Tahun': r.year,
    'Bulan': r.month,
    'Kode Cabang': neutralizeFormulaCell(r.branch_code || r.branch_id),
    'Nama Cabang': neutralizeFormulaCell(r.branch_name || '-'),
    'Departemen': neutralizeFormulaCell(r.department_name || r.department_id),
    'Kode Indikator': neutralizeFormulaCell(r.indicator_code || r.indicator_id),
    'Nama Indikator': neutralizeFormulaCell(r.indicator_name || '-'),
    'Target': r.target,
    'Realisasi': r.realization,
    'Satuan': neutralizeFormulaCell(r.unit),
    'Capaian (%)': r.achievement_pct,
    'Status Indikator': neutralizeFormulaCell(r.status_color.toUpperCase()),
    'Status Verifikasi': neutralizeFormulaCell(r.verification_status),
    'Catatan Revisi': neutralizeFormulaCell(r.revision_notes || '-'),
    'Waktu Upload': neutralizeFormulaCell(r.uploaded_at),
    'Pengunggah': neutralizeFormulaCell(r.uploaded_by),
    'Verifikator': neutralizeFormulaCell(r.verified_by || '-'),
    'Waktu Verifikasi': neutralizeFormulaCell(r.verified_at || '-'),
    'Klasifikasi Data': r.is_simulated ? 'DATA SIMULASI' : 'DATA RESMI'
  }));

  const ws = XLSX.utils.json_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Data_Kinerja');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}
