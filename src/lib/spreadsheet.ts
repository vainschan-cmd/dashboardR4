import * as XLSX from 'xlsx';

/**
 * Centralised, hardened spreadsheet reading.
 *
 * All workbook parsing in the application goes through `readWorkbookSafe` so a
 * single place enforces the limits that mitigate parser abuse (ReDoS / prototype
 * pollution / memory exhaustion):
 *
 * - `sheetRows`: never materialise more rows than the import limit.
 * - `cellFormula: false`: formulas are not evaluated, only cached values are read.
 * - `cellHTML: false`, `cellStyles: false`: skip markup/styles we never use.
 * - `bookVBA/bookFiles: false`: ignore embedded macros and file references.
 *
 * The SheetJS distribution used here is 0.20.3 from the official CDN tarball,
 * which contains the fixes for GHSA-4r6h-8v6p-xv6w (prototype pollution) and
 * GHSA-5pgg-2g8v-p4x9 (ReDoS); those were never published to the npm registry.
 */

/** Hard ceiling regardless of caller — protects the event loop. */
export const MAX_SPREADSHEET_ROWS = 5000;

export interface SafeReadOptions {
  /** Maximum rows to read per sheet. Clamped to MAX_SPREADSHEET_ROWS. */
  maxRows?: number;
  /** Read only the first sheet (default true). */
  firstSheetOnly?: boolean;
}

export interface SafeWorkbook {
  workbook: XLSX.WorkBook;
  sheetNames: string[];
}

export function clampRowLimit(requested?: number): number {
  if (!requested || !Number.isFinite(requested)) return MAX_SPREADSHEET_ROWS;
  return Math.max(1, Math.min(MAX_SPREADSHEET_ROWS, Math.trunc(requested)));
}

/**
 * Read a workbook buffer with hardened parser options.
 *
 * Throws a user-safe error when the buffer looks like a spreadsheet container but
 * cannot be decoded (e.g. a truncated ZIP). Note that SheetJS happily interprets
 * arbitrary *text* as a single-cell sheet, so a non-spreadsheet upload does NOT
 * throw here — it yields zero data rows, and callers must reject that as an empty
 * file.
 *
 * One row beyond the requested limit is read on purpose so callers can detect
 * truncation with `sheetToRowsChecked` instead of silently importing a subset
 * of the file. `sheetRows` counts physical rows (including the header row that
 * becomes the object keys), hence `+ 2` rather than `+ 1`.
 */
export function readWorkbookSafe(buffer: Buffer, options: SafeReadOptions = {}): SafeWorkbook {
  const rows = clampRowLimit(options.maxRows);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      sheetRows: rows + 2,
      bookVBA: false,
      bookFiles: false,
      bookProps: false,
      bookDeps: false,
      WTF: false,
    });
  } catch {
    throw new Error(
      'Berkas spreadsheet tidak dapat dibaca. Pastikan format .xlsx/.xls/.csv valid dan tidak rusak.'
    );
  }

  const sheetNames = options.firstSheetOnly
    ? workbook.SheetNames.slice(0, 1)
    : workbook.SheetNames;

  if (sheetNames.length === 0) {
    throw new Error('Spreadsheet tidak memiliki lembar (sheet) yang dapat dibaca.');
  }

  return { workbook, sheetNames };
}

export interface SheetRowsResult {
  rows: Array<Record<string, unknown>>;
  /** True when the sheet held more data rows than the applied limit. */
  truncated: boolean;
}

/**
 * Convert a worksheet into plain row objects and report whether the row limit
 * cut the sheet short. Callers that ingest financial data must treat
 * `truncated === true` as an error rather than importing a partial file.
 */
export function sheetToRowsChecked(
  workbook: XLSX.WorkBook,
  sheetName: string,
  maxRows?: number
): SheetRowsResult {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], truncated: false };

  const limit = clampRowLimit(maxRows);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

/**
 * Convert a worksheet into plain row objects.
 * Rows beyond the limit are dropped and empty rows are removed.
 */
export function sheetToRows(
  workbook: XLSX.WorkBook,
  sheetName: string,
  maxRows?: number
): Array<Record<string, unknown>> {
  return sheetToRowsChecked(workbook, sheetName, maxRows).rows;
}
