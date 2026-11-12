import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  clampRowLimit,
  readWorkbookSafe,
  sheetToRows,
  sheetToRowsChecked,
  MAX_SPREADSHEET_ROWS,
} from '@/lib/spreadsheet';

function makeWorkbook(dataRows: number): Buffer {
  const header = ['Tanggal', 'Cabang', 'Pendapatan'];
  const body = Array.from({ length: dataRows }, (_, i) => ['2026-09-01', 'R01', String(i)]);
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('clampRowLimit', () => {
  it('memakai batas maksimum ketika tidak ditentukan', () => {
    expect(clampRowLimit()).toBe(MAX_SPREADSHEET_ROWS);
    expect(clampRowLimit(0)).toBe(MAX_SPREADSHEET_ROWS);
  });

  it('membatasi permintaan yang melebihi maksimum', () => {
    expect(clampRowLimit(999_999)).toBe(MAX_SPREADSHEET_ROWS);
  });

  it('menjaga batas tetap minimal 1', () => {
    expect(clampRowLimit(-5)).toBe(1);
    expect(clampRowLimit(1)).toBe(1);
  });

  it('mengabaikan nilai bukan angka', () => {
    expect(clampRowLimit(Number.NaN)).toBe(MAX_SPREADSHEET_ROWS);
    expect(clampRowLimit(Number.POSITIVE_INFINITY)).toBe(MAX_SPREADSHEET_ROWS);
  });

  it('membulatkan nilai pecahan', () => {
    expect(clampRowLimit(10.9)).toBe(10);
  });
});

describe('readWorkbookSafe', () => {
  it('membaca workbook yang valid', () => {
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(3));
    expect(sheetNames).toEqual(['Data']);
    expect(workbook.Sheets.Data).toBeTruthy();
  });

  it('melempar pesan ramah untuk arsip terpotong', () => {
    expect(() => readWorkbookSafe(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toThrow(
      /tidak dapat dibaca/i
    );
  });

  it('teks biasa tidak melempar, tetapi menghasilkan nol baris data', () => {
    // SheetJS menafsirkan teks sebagai sheet satu sel; pemanggil (route impor)
    // yang wajib menolaknya sebagai "berkas kosong".
    const { workbook, sheetNames } = readWorkbookSafe(Buffer.from('bukan spreadsheet'));
    expect(sheetNames).toHaveLength(1);
    expect(sheetToRows(workbook, sheetNames[0])).toHaveLength(0);
  });

  it('biner acak tidak melempar, tetapi menghasilkan nol baris data', () => {
    const garbage = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x88, 0x00, 0x42]);
    const { workbook, sheetNames } = readWorkbookSafe(garbage);
    expect(sheetToRows(workbook, sheetNames[0])).toHaveLength(0);
  });

  it('firstSheetOnly hanya mengembalikan satu nama sheet', () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['a'], [1]]), 'Satu');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['b'], [2]]), 'Dua');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    expect(readWorkbookSafe(buffer, { firstSheetOnly: true }).sheetNames).toHaveLength(1);
    expect(readWorkbookSafe(buffer, { firstSheetOnly: false }).sheetNames).toHaveLength(2);
  });

  it('tidak mengevaluasi formula (hanya membaca nilai tersimpan)', () => {
    const sheet = XLSX.utils.aoa_to_sheet([['Nilai'], [{ f: 'SUM(1,2)' }]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'F');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const parsed = readWorkbookSafe(buffer);
    const cell = parsed.workbook.Sheets.F.A2 as XLSX.CellObject | undefined;
    // Formula tidak boleh ikut terkirim ke pemanggil.
    expect(cell?.f).toBeUndefined();
  });
});

describe('sheetToRowsChecked', () => {
  it('mengembalikan seluruh baris ketika di bawah batas', () => {
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(5));
    const result = sheetToRowsChecked(workbook, sheetNames[0], 100);
    expect(result.rows).toHaveLength(5);
    expect(result.truncated).toBe(false);
  });

  it('menandai truncated ketika data melebihi batas', () => {
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(50), { maxRows: 100 });
    const result = sheetToRowsChecked(workbook, sheetNames[0], 10);
    expect(result.rows).toHaveLength(10);
    expect(result.truncated).toBe(true);
  });

  it('tidak menandai truncated ketika jumlah baris tepat sama dengan batas', () => {
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(10), { maxRows: 100 });
    const result = sheetToRowsChecked(workbook, sheetNames[0], 10);
    expect(result.rows).toHaveLength(10);
    expect(result.truncated).toBe(false);
  });

  it('mengembalikan hasil kosong untuk nama sheet yang tidak ada', () => {
    const { workbook } = readWorkbookSafe(makeWorkbook(2));
    expect(sheetToRowsChecked(workbook, 'TidakAda')).toEqual({ rows: [], truncated: false });
    expect(sheetToRows(workbook, 'TidakAda')).toEqual([]);
  });

  it('sheetToRows adalah pembungkus yang membuang flag truncated', () => {
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(20), { maxRows: 100 });
    const rows = sheetToRows(workbook, sheetNames[0], 5);
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(5);
  });
});

describe('integrasi batas impor', () => {
  it('berkas jauh di atas batas tetap terdeteksi (tidak dipotong diam-diam)', () => {
    // 2000 = MAX_IMPORT_ROWS pada lapisan API.
    const limit = 2000;
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(limit + 1), { maxRows: limit });
    const result = sheetToRowsChecked(workbook, sheetNames[0], limit);
    expect(result.truncated).toBe(true);
    expect(result.rows).toHaveLength(limit);
  });

  it('berkas tepat pada batas diterima utuh', () => {
    const limit = 2000;
    const { workbook, sheetNames } = readWorkbookSafe(makeWorkbook(limit), { maxRows: limit });
    const result = sheetToRowsChecked(workbook, sheetNames[0], limit);
    expect(result.truncated).toBe(false);
    expect(result.rows).toHaveLength(limit);
  });
});
