import { dbQueries } from './db';
import {
  GOOGLE_SPREADSHEET_ID_REGEX,
  GOOGLE_SHEET_NAME_REGEX,
  GOOGLE_SHEET_RANGE_REGEX,
  MAX_IMPORT_ROWS,
} from './validation';

const GOOGLE_SHEETS_FETCH_TIMEOUT_MS = 10_000; // 10 detik timeout permintaan

export interface SheetFetchResult {
  success: boolean;
  spreadsheetId: string;
  sheetName: string;
  data: Array<Record<string, unknown>>;
  message: string;
  isSimulatedAdapter: boolean;
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = String(input || '').trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export function validateGoogleSheetsTarget(
  spreadsheetUrlOrId: string,
  sheetName: string,
  range: string
): { valid: true; spreadsheetId: string; sheetName: string; range: string } | { valid: false; error: string } {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  const cleanSheetName = String(sheetName || '').trim();
  const cleanRange = String(range || '').trim().toUpperCase();

  if (!spreadsheetId || !GOOGLE_SPREADSHEET_ID_REGEX.test(spreadsheetId)) {
    return {
      valid: false,
      error: 'ID Spreadsheet tidak valid. Harap masukkan URL lengkap atau Spreadsheet ID (10–120 karakter alfanumerik) yang valid.',
    };
  }

  if (!cleanSheetName || !GOOGLE_SHEET_NAME_REGEX.test(cleanSheetName)) {
    return {
      valid: false,
      error: 'Nama sheet tidak valid. Hindari karakter khusus terlarang seperti [, ], *, ?, :, /, atau \\.',
    };
  }

  if (!cleanRange || !GOOGLE_SHEET_RANGE_REGEX.test(cleanRange)) {
    return {
      valid: false,
      error: 'Format range A1 Google Sheets tidak valid (contoh: A2:L200).',
    };
  }

  return {
    valid: true,
    spreadsheetId,
    sheetName: cleanSheetName,
    range: cleanRange,
  };
}

export async function fetchGoogleSheetData(
  spreadsheetUrlOrId: string,
  sheetName = 'Input_Kinerja_Bulanan',
  range = 'A1:K100'
): Promise<SheetFetchResult> {
  const targetValidation = validateGoogleSheetsTarget(spreadsheetUrlOrId, sheetName, range);
  if (!targetValidation.valid) {
    return {
      success: false,
      spreadsheetId: extractSpreadsheetId(spreadsheetUrlOrId),
      sheetName,
      data: [],
      message: targetValidation.error,
      isSimulatedAdapter: false,
    };
  }

  const { spreadsheetId, sheetName: validSheetName, range: validRange } = targetValidation;
  const storedCreds = dbQueries.getIntegrationCredentials();
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY?.trim() || storedCreds.google_api_key?.trim() || '';

  // If real API key is configured, perform real Google Sheets API v4 fetch with timeout
  if (apiKey) {
    try {
      const encodedRange = `${encodeURIComponent(validSheetName)}!${encodeURIComponent(validRange)}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(GOOGLE_SHEETS_FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        return {
          success: false,
          spreadsheetId,
          sheetName: validSheetName,
          data: [],
          message: `Google Sheets API Error: ${errJson.error?.message || response.statusText}`,
          isSimulatedAdapter: false,
        };
      }

      const json = (await response.json()) as { values?: string[][] };
      const rawValues = json.values;

      if (!rawValues || rawValues.length < 2) {
        return {
          success: false,
          spreadsheetId,
          sheetName: validSheetName,
          data: [],
          message: 'Sheet ditemukan namun tidak memiliki baris data (hanya header atau kosong).',
          isSimulatedAdapter: false,
        };
      }

      const headers = rawValues[0];
      const rawDataRows = rawValues.slice(1, MAX_IMPORT_ROWS + 1);
      const dataRows = rawDataRows.map(row => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] !== undefined ? row[i] : '';
        });
        return obj;
      });

      return {
        success: true,
        spreadsheetId,
        sheetName: validSheetName,
        data: dataRows,
        message: `Berhasil mengambil ${dataRows.length} baris data dari Google Sheets API v4.`,
        isSimulatedAdapter: false,
      };
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      const errMessage = isTimeout
        ? `Permintaan ke Google Sheets API melewati batas waktu (${GOOGLE_SHEETS_FETCH_TIMEOUT_MS / 1000} detik).`
        : err instanceof Error
          ? err.message
          : 'Kesalahan jaringan tidak diketahui.';
      return {
        success: false,
        spreadsheetId,
        sheetName: validSheetName,
        data: [],
        message: `Koneksi ke Google Sheets API gagal: ${errMessage}`,
        isSimulatedAdapter: false,
      };
    }
  }

  // When API key is not yet configured, return adapter test simulation rows
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
      'Keterangan': 'Hasil Sinkronisasi Google Sheets Adapter (Simulasi Terkoneksi)',
    }));
  });

  return {
    success: true,
    spreadsheetId,
    sheetName: validSheetName,
    data: demoDataRows,
    message: 'Google Sheets Adapter Mode: Kredensial produksi belum disetel di .env (GOOGLE_SHEETS_API_KEY). Sistem menggunakan data uji konektor Google Sheets.',
    isSimulatedAdapter: true,
  };
}
