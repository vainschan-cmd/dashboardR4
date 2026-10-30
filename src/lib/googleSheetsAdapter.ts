import { GoogleSheetsConfig } from './types';
import { dbQueries } from './db';

export interface SheetFetchResult {
  success: boolean;
  spreadsheetId: string;
  sheetName: string;
  data: Array<Record<string, any>>;
  message: string;
  isSimulatedAdapter: boolean;
}

export function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input.trim();
}

export async function fetchGoogleSheetData(
  spreadsheetUrlOrId: string,
  sheetName = 'Input_Kinerja_Bulanan',
  range = 'A1:K100'
): Promise<SheetFetchResult> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  if (!spreadsheetId) {
    return {
      success: false,
      spreadsheetId: '',
      sheetName,
      data: [],
      message: 'ID Spreadsheet tidak valid. Harap masukkan URL lengkap atau Spreadsheet ID yang valid.',
      isSimulatedAdapter: false
    };
  }

  // If real API key is configured, perform real Google Sheets API v4 fetch
  if (apiKey) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!${range}?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errJson = await response.json();
        return {
          success: false,
          spreadsheetId,
          sheetName,
          data: [],
          message: `Google Sheets API Error: ${errJson.error?.message || response.statusText}`,
          isSimulatedAdapter: false
        };
      }

      const json = await response.json();
      const rawValues = json.values as string[][];

      if (!rawValues || rawValues.length < 2) {
        return {
          success: false,
          spreadsheetId,
          sheetName,
          data: [],
          message: 'Sheet ditemukan namun tidak memiliki baris data (hanya header atau kosong).',
          isSimulatedAdapter: false
        };
      }

      const headers = rawValues[0];
      const dataRows = rawValues.slice(1).map(row => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });

      return {
        success: true,
        spreadsheetId,
        sheetName,
        data: dataRows,
        message: `Berhasil mengambil ${dataRows.length} baris data dari Google Sheets API v4.`,
        isSimulatedAdapter: false
      };
    } catch (err: any) {
      return {
        success: false,
        spreadsheetId,
        sheetName,
        data: [],
        message: `Koneksi ke Google Sheets API gagal: ${err.message}`,
        isSimulatedAdapter: false
      };
    }
  }

  // When API key is not yet configured, return adapter test simulation rows
  // explicitly marked as Adapter Test Demo
  const branches = dbQueries.getBranches();
  const indicators = dbQueries.getIndicators('dept_ops');

  const demoDataRows = branches.slice(0, 3).flatMap(b => {
    return indicators.slice(0, 4).map(ind => ({
      'Kode Cabang': b.code,
      'Nama Cabang': b.name,
      'Departemen': 'OPS',
      'Bulan': 3,
      'Tahun': 2026,
      'Kode Indikator': ind.code,
      'Nama Indikator': ind.name,
      'Target': ind.default_target,
      'Realisasi': Number((ind.default_target * (0.95 + Math.random() * 0.12)).toFixed(2)),
      'Satuan': ind.unit,
      'Keterangan': 'Hasil Sinkronisasi Google Sheets Adapter (Simulasi Terkoneksi)'
    }));
  });

  return {
    success: true,
    spreadsheetId,
    sheetName,
    data: demoDataRows,
    message: 'Google Sheets Adapter Mode: Kredensial produksi belum disetel di .env (GOOGLE_SHEETS_API_KEY). Sistem menggunakan data uji konektor Google Sheets.',
    isSimulatedAdapter: true
  };
}
