import path from 'path';
import fs from 'fs';
import os from 'os';
import * as xlsx from 'xlsx';
import { User, UserRole } from './types';
import { OFFICIAL_BRANCHES } from './constants';

export const MASTER_USER_FILE = 'master_user_pic.xlsx';
export const DRIVE_ACCOUNT = 'regdashr@gmail.com';

export const INITIAL_OFFICIAL_PICS: Omit<User, 'id'>[] = [
  {
    username: '10001',
    nipp: '10001',
    name: 'Budi Santoso, S.T., M.M.',
    email: 'budi.santoso@pelindo.co.id',
    divisi: 'Divisi Teknologi Informasi & Digitalisasi',
    departemen: 'Departemen Tata Kelola & Solusi TI',
    role: 'super_admin',
    branch_id: 'R99',
    department_id: 'dept_tek',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10002',
    nipp: '10002',
    name: 'Hendra Wijaya, S.E., M.B.A.',
    email: 'hendra.wijaya@pelindo.co.id',
    divisi: 'Divisi Strategi & Manajemen Kinerja Regional',
    departemen: 'Departemen Monitoring & Evaluasi Regional 4',
    role: 'admin_regional',
    branch_id: 'R99',
    department_id: 'dept_ops',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10003',
    nipp: '10003',
    name: 'Capt. Rudi Hartono, M.Mar.',
    email: 'rudi.hartono@pelindo.co.id',
    divisi: 'Divisi Operasi & Pelayanan Kapal',
    departemen: 'Departemen Pelayanan Kapal & Barang',
    role: 'pic_dept_regional',
    branch_id: 'R99',
    department_id: 'dept_ops',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10004',
    nipp: '10004',
    name: 'Ahmad Dahlan, S.T.',
    email: 'ahmad.dahlan@pelindo.co.id',
    divisi: 'Divisi Operasional Terminal Cabang',
    departemen: 'Departemen Operasi Cabang Makassar',
    role: 'pic_cabang',
    branch_id: 'R01',
    department_id: 'dept_ops',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10005',
    nipp: '10005',
    name: 'Siti Rahma, S.E., Ak., CA.',
    email: 'siti.rahma@pelindo.co.id',
    divisi: 'Divisi Keuangan & Manajemen Risiko',
    departemen: 'Departemen Akuntansi & Perpajakan',
    role: 'pic_dept_regional',
    branch_id: 'R99',
    department_id: 'dept_keu',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10006',
    nipp: '10006',
    name: 'Dewi Kartika, S.Psi., M.M.',
    email: 'dewi.kartika@pelindo.co.id',
    divisi: 'Divisi Sumber Daya Manusia & Umum',
    departemen: 'Departemen SDM & Organisasi',
    role: 'pic_dept_regional',
    branch_id: 'R99',
    department_id: 'dept_sdm',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10007',
    nipp: '10007',
    name: 'Ir. Agus Santoso, M.T.',
    email: 'agus.santoso@pelindo.co.id',
    divisi: 'Divisi Fasilitas & Peralatan Pelabuhan',
    departemen: 'Departemen Pemeliharaan & Teknik',
    role: 'pic_dept_regional',
    branch_id: 'R99',
    department_id: 'dept_tek',
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    username: '10008',
    nipp: '10008',
    name: 'Faisal Ramadhan, S.Tr.Pel.',
    email: 'faisal.ramadhan@pelindo.co.id',
    divisi: 'Divisi Operasional Terminal Cabang',
    departemen: 'Departemen Operasi Cabang Balikpapan',
    role: 'pic_cabang',
    branch_id: 'R04',
    department_id: 'dept_ops',
    password: 'password123',
    active: true,
    created_at: '2026-01-12T08:00:00Z',
  },
  {
    username: '10009',
    nipp: '10009',
    name: 'Nur Aini, S.Kom.',
    email: 'nur.aini@pelindo.co.id',
    divisi: 'Divisi Operasional Terminal Cabang',
    departemen: 'Departemen Operasi Cabang Bitung',
    role: 'pic_cabang',
    branch_id: 'R05',
    department_id: 'dept_ops',
    password: 'password123',
    active: true,
    created_at: '2026-01-12T08:00:00Z',
  },
  {
    username: '10000',
    nipp: '10000',
    name: 'Board of Directors (BOD)',
    email: 'bod.r4@pelindo.co.id',
    divisi: 'Direksi Pelindo Regional 4',
    departemen: 'Kantor Regional 4',
    role: 'viewer',
    branch_id: 'R99',
    department_id: null,
    password: 'password123',
    active: true,
    created_at: '2026-01-10T08:00:00Z',
  },
];

export function normalizeRole(raw: any): UserRole {
  if (!raw) return 'pic_cabang';
  const str = String(raw).trim().toLowerCase();
  if (str.includes('super') || str === 'super_admin' || str === 'superadmin') return 'super_admin';
  if (str.includes('regional 4') || str.includes('admin regional') || str === 'admin_regional') return 'admin_regional';
  if (str.includes('dept') || str.includes('regional') || str === 'pic_dept_regional') return 'pic_dept_regional';
  if (str.includes('viewer') || str.includes('bod') || str === 'viewer') return 'viewer';
  if (str.includes('cabang') || str === 'pic_cabang') return 'pic_cabang';
  return 'pic_cabang';
}

export function normalizeBranch(raw: any): string {
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
  sourcePath: string;
  sourceType: 'downloads' | 'data' | 'buffer' | 'fallback';
  users: User[];
}

/**
 * Read and import users from spreadsheet into database (Pull from My Drive)
 */
export function importUsersFromSpreadsheet(customInput?: string | Buffer): ImportUserResult {
  let wb: xlsx.WorkBook;
  let sourcePath = '';
  let sourceType: 'downloads' | 'data' | 'buffer' | 'fallback' = 'data';

  if (Buffer.isBuffer(customInput)) {
    wb = xlsx.read(customInput, { type: 'buffer' });
    sourceType = 'buffer';
    sourcePath = 'Uploaded Buffer';
  } else if (typeof customInput === 'string' && fs.existsSync(customInput)) {
    sourcePath = customInput;
    sourceType = customInput.includes('Downloads') ? 'downloads' : 'data';
    const buf = fs.readFileSync(customInput);
    wb = xlsx.read(buf, { type: 'buffer' });
  } else {
    const latest = findLatestMasterUserSpreadsheet();
    if (latest && fs.existsSync(latest.path)) {
      sourcePath = latest.path;
      sourceType = latest.source;
      const buf = fs.readFileSync(latest.path);
      wb = xlsx.read(buf, { type: 'buffer' });
    } else {
      const defaultPath = ensureMasterUserSpreadsheet();
      sourcePath = defaultPath;
      sourceType = 'fallback';
      const buf = fs.readFileSync(defaultPath);
      wb = xlsx.read(buf, { type: 'buffer' });
    }
  }

  const sheetName = wb.SheetNames.includes('MASTER_USER_PIC') ? 'MASTER_USER_PIC' : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet ${sheetName} tidak ditemukan dalam file spreadsheet.`);
  }

  const rawRows: any[] = xlsx.utils.sheet_to_json(sheet);
  if (!rawRows || rawRows.length === 0) {
    throw new Error('Spreadsheet kosong atau tidak memiliki data pengguna pada sheet pertama.');
  }

  const { dbQueries } = require('./db');
  let createdCount = 0;
  let updatedCount = 0;

  for (const row of rawRows) {
    const rawNipp = row['NIPP (USERNAME)'] || row['NIPP'] || row['nipp'] || row['Username'] || row['username'] || row['NIP'] || row['nip'];
    if (!rawNipp) continue;

    const nipp = String(rawNipp).trim();
    const rawName = row['NAMA LENGKAP'] || row['NAMA PEGAWAI'] || row['Nama'] || row['name'] || row['NAMA'];
    const name = rawName ? String(rawName).trim() : `Pegawai ${nipp}`;
    const divisi = String(row['DIVISI'] || row['divisi'] || row['Divisi'] || '-').trim();
    const departemen = String(row['DEPARTEMEN'] || row['departemen'] || row['Departemen'] || '-').trim();
    const rawRole = row['HAK AKSES (ROLE)'] || row['HAK AKSES'] || row['ROLE'] || row['role'] || row['Role'];
    const role = normalizeRole(rawRole);
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
        password: 'password123',
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
    sourcePath,
    sourceType,
    users: allUsers,
  };
}

/**
 * Read users from spreadsheet
 */
export function readUsersFromSpreadsheet(): any[] {
  const filePath = ensureMasterUserSpreadsheet();
  const fileBuffer = fs.readFileSync(filePath);
  const wb = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}
