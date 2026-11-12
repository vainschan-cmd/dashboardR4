import path from 'path';
import fs from 'fs';
import os from 'os';
import * as xlsx from 'xlsx';
import { User, UserRole } from './types';
import { OFFICIAL_BRANCHES } from './constants';
import { resolveBootstrapPassword } from './bootstrap';
import { readWorkbookSafe, sheetToRows } from './spreadsheet';
import { dbQueries } from './db';
// `FEAT-10`: file-imported roles are parsed strictly, never fuzzy-matched.
import { canGrantRole, describeAllowedRoles, parseRoleStrict } from './roleMapping';
// `CODE-04`: the seed data lives in a dependency-free module so `db.ts` can read
// it without importing this file (which imports `db.ts`).
import { INITIAL_OFFICIAL_PICS, type InitialPicSeed } from './userSeed';

export { INITIAL_OFFICIAL_PICS };
export type { InitialPicSeed };

export const MASTER_USER_FILE = 'master_user_pic.xlsx';
export const DRIVE_ACCOUNT = 'regdashr@gmail.com';

/**
 * @deprecated Fuzzy role matching is a privilege-escalation path (`FEAT-10`):
 * `"Supervisor Operasi"` contains "super" and used to become `super_admin`, and
 * `"PIC Dept Regional 4"` contains "regional 4" and used to become
 * `admin_regional`. Use `parseRoleStrict()` from `roleMapping.ts`, which returns
 * `null` for anything it does not recognise instead of guessing.
 */
export function normalizeRole(raw: unknown): UserRole {
  const parsed = parseRoleStrict(raw);
  if (parsed) return parsed;
  // Unrecognised values are reported by the caller; this fallback only exists to
  // keep the old signature compiling for any external caller.
  return 'pic_cabang';
}

export function normalizeBranch(raw: unknown): string {
  if (!raw) return 'R99';
  const str = String(raw).trim();
  const codeMatch = str.match(/\b(R\d{2})\b/i);
  if (codeMatch) {
    return codeMatch[1].toUpperCase();
  }
  const lower = str.toLowerCase();
  for (const b of OFFICIAL_BRANCHES) {
    if (lower.includes(b.name.toLowerCase())) {
      return b.code;
    }
  }
  if (lower.includes('regional') || lower.includes('pusat')) {
    return 'R99';
  }
  return 'R99';
}

export function getMasterUserSpreadsheetPath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, MASTER_USER_FILE);
}

/**
 * Find the latest master_user_pic.xlsx between Downloads folder and data folder
 */
export function findLatestMasterUserSpreadsheet(): { path: string; source: 'downloads' | 'data'; mtime: Date } | null {
  const downloadsPath = path.join(os.homedir(), 'Downloads', MASTER_USER_FILE);
  const dataPath = path.join(process.cwd(), 'data', MASTER_USER_FILE);

  let downloadsStat: fs.Stats | null = null;
  let dataStat: fs.Stats | null = null;

  if (fs.existsSync(downloadsPath)) {
    try { downloadsStat = fs.statSync(downloadsPath); } catch {}
  }
  if (fs.existsSync(dataPath)) {
    try { dataStat = fs.statSync(dataPath); } catch {}
  }

  if (downloadsStat && dataStat) {
    if (downloadsStat.mtimeMs >= dataStat.mtimeMs) {
      return { path: downloadsPath, source: 'downloads', mtime: downloadsStat.mtime };
    } else {
      return { path: dataPath, source: 'data', mtime: dataStat.mtime };
    }
  } else if (downloadsStat) {
    return { path: downloadsPath, source: 'downloads', mtime: downloadsStat.mtime };
  } else if (dataStat) {
    return { path: dataPath, source: 'data', mtime: dataStat.mtime };
  }

  return null;
}

/**
 * Export a list of users to the official Excel spreadsheet
 */
export function exportUsersToSpreadsheet(users: User[]): string {
  const filePath = getMasterUserSpreadsheetPath();

  const rows = users.map((u, idx) => ({
    'NO': idx + 1,
    'NIPP (USERNAME)': u.nipp || u.username,
    'NAMA LENGKAP': u.name,
    'DIVISI': u.divisi || '-',
    'DEPARTEMEN': u.departemen || '-',
    'HAK AKSES (ROLE)': u.role,
    'CABANG': u.branch_id || 'R99',
    'EMAIL': u.email || `${(u.nipp || u.username)}@pelindo.co.id`,
    'STATUS': u.active ? 'AKTIF' : 'NONAKTIF',
    'TANGGAL TERDAFTAR': u.created_at || new Date().toISOString().split('T')[0],
  }));

  const wb = xlsx.utils.book_new();

  // Sheet 1: Master Data PIC / User
  const ws = xlsx.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },   // NO
    { wch: 18 },  // NIPP (USERNAME)
    { wch: 32 },  // NAMA LENGKAP
    { wch: 38 },  // DIVISI
    { wch: 38 },  // DEPARTEMEN
    { wch: 20 },  // HAK AKSES
    { wch: 22 },  // CABANG
    { wch: 32 },  // EMAIL
    { wch: 12 },  // STATUS
    { wch: 22 },  // TANGGAL TERDAFTAR
  ];
  xlsx.utils.book_append_sheet(wb, ws, 'MASTER_USER_PIC');

  // Sheet 2: Metadata Google Drive Sync
  const wsMeta = xlsx.utils.json_to_sheet([
    {
      'METADATA': 'Akun Google Drive',
      'NILAI': DRIVE_ACCOUNT,
    },
    {
      'METADATA': 'File Name',
      'NILAI': MASTER_USER_FILE,
    },
    {
      'METADATA': 'Deskripsi',
      'NILAI': 'Master Data Pengguna, NIPP, Divisi, Departemen dan Hak Akses Pelindo Regional 4',
    },
    {
      'METADATA': 'Terakhir Disinkronkan',
      'NILAI': new Date().toISOString(),
    },
    {
      'METADATA': 'Total PIC Terdaftar',
      'NILAI': users.length,
    },
  ]);
  wsMeta['!cols'] = [{ wch: 26 }, { wch: 60 }];
  xlsx.utils.book_append_sheet(wb, wsMeta, 'INFO_GOOGLE_DRIVE');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(filePath, buf);

  // Otomatis salin ke folder Downloads pengguna agar langsung siap di-upload ke Google Drive
  try {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    if (fs.existsSync(downloadsDir)) {
      const downloadsFile = path.join(downloadsDir, MASTER_USER_FILE);
      fs.writeFileSync(downloadsFile, buf);
      console.log(`[UserSync] Spreadsheet master user juga disalin ke: ${downloadsFile}`);
    }
  } catch (err) {
    console.error('[UserSync] Gagal menyalin ke folder Downloads:', err);
  }

  console.log(`[UserSync] Spreadsheet master user tersimpan di: ${filePath} (${users.length} akun, akun drive: ${DRIVE_ACCOUNT})`);
  return filePath;
}

/**
 * Ensure master_user_pic.xlsx exists, creating it from defaults if missing
 */
export function ensureMasterUserSpreadsheet(): string {
  const filePath = getMasterUserSpreadsheetPath();
  if (!fs.existsSync(filePath)) {
    console.log(`[UserSync] File ${MASTER_USER_FILE} belum ada, membuat baru dengan PIC default...`);
    const initialUsers: User[] = INITIAL_OFFICIAL_PICS.map((u, i) => ({
      ...u,
      id: `usr_${u.nipp}_${i + 1}`,
    }));
    exportUsersToSpreadsheet(initialUsers);
  }
  return filePath;
}

export interface ImportUserResult {
  totalInSheet: number;
  createdCount: number;
  updatedCount: number;
  rejectedCount: number;
  rejected: Array<{ nipp: string; reason: string }>;
  sourcePath: string;
  sourceType: 'downloads' | 'data' | 'buffer' | 'fallback';
  users: User[];
}

export interface ImportUserOptions {
  /** Role of the authenticated actor performing the import. Defaults to least privilege. */
  actorRole?: UserRole;
  /** NIPP of the actor, so self-modification through a file can be refused. */
  actorNipp?: string;
}

/** Rows beyond this are refused rather than partially imported. */
export const MAX_IMPORTED_USERS = 1000;

/** A NIPP is a numeric employee id; anything else is a spreadsheet typo. */
const NIPP_PATTERN = /^[0-9]{4,20}$/;

/**
 * Read and import users from spreadsheet into database (Pull from My Drive)
 *
 * Every row is an authorisation decision, not just a data transform (`FEAT-10`):
 *
 * - The role cell must match a known name exactly; unknown values are rejected
 *   instead of being guessed into a role.
 * - An actor may only grant roles strictly below its own rank.
 * - An existing Super Admin account may not be modified by anyone else, so a file
 *   cannot be used to demote or deactivate the account that guards the system.
 * - The importing account itself may not be changed, which would otherwise let an
 *   actor rewrite their own role or NIPP through an upload.
 */
export function importUsersFromSpreadsheet(
  customInput?: string | Buffer,
  options: ImportUserOptions = {}
): ImportUserResult {

  let wb: xlsx.WorkBook;
  let sourcePath = '';
  let sourceType: 'downloads' | 'data' | 'buffer' | 'fallback' = 'data';

  if (Buffer.isBuffer(customInput)) {
    wb = readWorkbookSafe(customInput).workbook;
    sourceType = 'buffer';
    sourcePath = 'Uploaded Buffer';
  } else if (typeof customInput === 'string' && fs.existsSync(customInput)) {
    sourcePath = customInput;
    sourceType = customInput.includes('Downloads') ? 'downloads' : 'data';
    const buf = fs.readFileSync(customInput);
    wb = readWorkbookSafe(buf).workbook;
  } else {
    const latest = findLatestMasterUserSpreadsheet();
    if (latest && fs.existsSync(latest.path)) {
      sourcePath = latest.path;
      sourceType = latest.source;
      const buf = fs.readFileSync(latest.path);
      wb = readWorkbookSafe(buf).workbook;
    } else {
      const defaultPath = ensureMasterUserSpreadsheet();
      sourcePath = defaultPath;
      sourceType = 'fallback';
      const buf = fs.readFileSync(defaultPath);
      wb = readWorkbookSafe(buf).workbook;
    }
  }

  const sheetName = wb.SheetNames.includes('MASTER_USER_PIC') ? 'MASTER_USER_PIC' : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} tidak ditemukan dalam file spreadsheet.`);
  }

  const rawRows: Record<string, unknown>[] = xlsx.utils.sheet_to_json(sheet);
  if (!rawRows || rawRows.length === 0) {
    throw new Error('Spreadsheet kosong atau tidak memiliki data pengguna pada sheet pertama.');
  }
  if (rawRows.length > MAX_IMPORTED_USERS) {
    // Refuse outright: a partially applied import is harder to reason about than a
    // rejected one, and a file this large is usually the wrong file.
    throw new Error(
      `Spreadsheet memuat ${rawRows.length} baris, melebihi batas ${MAX_IMPORTED_USERS} akun per impor. ` +
        'Pecah berkas menjadi beberapa bagian.'
    );
  }

  let createdCount = 0;
  let updatedCount = 0;
  const rejected: Array<{ nipp: string; reason: string }> = [];
  const actorNipp = options.actorNipp ? String(options.actorNipp).trim() : null;

  for (const row of rawRows) {
    const rawNipp = row['NIPP (USERNAME)'] || row['NIPP'] || row['nipp'] || row['Username'] || row['username'] || row['NIP'] || row['nip'];
    if (!rawNipp) continue;

    const nipp = String(rawNipp).trim();

    // A malformed NIPP would create an account nobody can log in with, or silently
    // collide with an existing one after trailing characters are stripped.
    if (!NIPP_PATTERN.test(nipp)) {
      rejected.push({
        nipp,
        reason: `NIPP tidak valid: "${nipp}". NIPP harus berupa angka 4–20 digit.`,
      });
      continue;
    }

    if (actorNipp && nipp === actorNipp) {
      rejected.push({
        nipp,
        reason: 'Akun Anda sendiri tidak dapat diubah melalui impor berkas.',
      });
      continue;
    }

    const rawName = row['NAMA LENGKAP'] || row['NAMA PEGAWAI'] || row['Nama'] || row['name'] || row['NAMA'];
    const name = rawName ? String(rawName).trim() : `Pegawai ${nipp}`;
    const divisi = String(row['DIVISI'] || row['divisi'] || row['Divisi'] || '-').trim();
    const departemen = String(row['DEPARTEMEN'] || row['departemen'] || row['Departemen'] || '-').trim();

    // Strict parse. An unrecognised cell is a rejection, never a default: silently
    // falling back to `pic_cabang` would hide a typo, and silently fuzzy-matching
    // ("Supervisor" → super_admin) would hand out access nobody intended.
    const rawRole = row['HAK AKSES (ROLE)'] || row['HAK AKSES'] || row['ROLE'] || row['role'] || row['Role'];
    const role = parseRoleStrict(rawRole);
    if (!role) {
      rejected.push({
        nipp,
        reason:
          `Role "${String(rawRole ?? '').trim() || '(kosong)'}" tidak dikenali. ` +
          `Nilai yang diterima: ${describeAllowedRoles()}.`,
      });
      continue;
    }

    if (!canGrantRole(options.actorRole, role)) {
      rejected.push({
        nipp,
        reason:
          `Role ${role} berada di atas kewenangan Anda` +
          (options.actorRole ? ` (${options.actorRole})` : '') +
          '. Hanya Super Admin yang dapat menetapkan role setingkat atau lebih tinggi.',
      });
      continue;
    }

    const rawBranch = row['CABANG'] || row['PENUGASAN CABANG'] || row['cabang'] || row['branch_id'];
    const branch_id = normalizeBranch(rawBranch);
    const rawEmail = row['EMAIL'] || row['email'];
    const email = rawEmail ? String(rawEmail).trim() : `${nipp}@pelindo.co.id`;

    const rawStatus = row['STATUS'] || row['status'];
    let active = true;
    if (typeof rawStatus === 'boolean') {
      active = rawStatus;
    } else if (rawStatus !== undefined && rawStatus !== null) {
      const s = String(rawStatus).trim().toUpperCase();
      if (s.includes('NON') || s === '0' || s === 'FALSE' || s === 'INACTIVE' || s === 'TIDAK') {
        active = false;
      } else {
        active = true;
      }
    }

    const existing = dbQueries.getUserByNipp(nipp);
    if (existing) {
      // A file must not be able to rewrite a Super Admin account (demote it, rename
      // it, or deactivate it) on behalf of a lesser administrator.
      if (existing.role === 'super_admin' && options.actorRole !== 'super_admin') {
        rejected.push({
          nipp,
          reason: 'Akun Super Admin hanya dapat diubah oleh Super Admin lain.',
        });
        continue;
      }

      dbQueries.updateUser(existing.id, {
        name,
        nipp,
        divisi,
        departemen,
        role,
        branch_id,
        email,
        active,
      });
      updatedCount++;
    } else {
      dbQueries.createUser({
        nipp,
        name,
        divisi,
        departemen,
        role,
        branch_id,
        email,
        password: resolveBootstrapPassword(nipp),
        // Imported accounts always start with a temporary password.
        mustChangePassword: true,
      });
      createdCount++;
    }
  }

  const allUsers: User[] = dbQueries.getUsers();
  exportUsersToSpreadsheet(allUsers);

  return {
    totalInSheet: rawRows.length,
    createdCount,
    updatedCount,
    rejectedCount: rejected.length,
    rejected,
    sourcePath,
    sourceType,
    users: allUsers,
  };
}

/**
 * Read users from spreadsheet
 */
export function readUsersFromSpreadsheet(): Record<string, unknown>[] {
  const filePath = ensureMasterUserSpreadsheet();
  const fileBuffer = fs.readFileSync(filePath);
  const { workbook, sheetNames } = readWorkbookSafe(fileBuffer, { firstSheetOnly: true });
  return sheetToRows(workbook, sheetNames[0]);
}
