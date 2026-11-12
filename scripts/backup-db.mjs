#!/usr/bin/env node
/**
 * scripts/backup-db.mjs
 *
 * Consistent SQLite backup + restore for PortDash R4.
 *
 * Why not `cp data/ed_dashboard.db`? The database runs in WAL mode, so a plain
 * file copy can miss committed pages still sitting in the `-wal` file, producing
 * a backup that silently loses recent transactions. `VACUUM INTO` writes a
 * consistent snapshot of the live database into a single file.
 *
 * Usage:
 *   node scripts/backup-db.mjs                       # backup into ./backups
 *   node scripts/backup-db.mjs --out /secure/path    # custom destination
 *   node scripts/backup-db.mjs --list                # list existing backups
 *   node scripts/backup-db.mjs --restore <file>      # restore a snapshot
 *   node scripts/backup-db.mjs --restore <file> --force
 *
 * Restore refuses to overwrite a live database unless --force is given, and it
 * moves the current database aside as `<name>.pre-restore-<timestamp>` so the
 * operation is reversible.
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = { out: null, restore: null, list: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--restore') args.restore = argv[++i];
    else if (arg === '--list') args.list = true;
    else if (arg === '--force') args.force = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function resolveDbPath() {
  if (process.env.DATABASE_PATH) return path.resolve(ROOT, process.env.DATABASE_PATH);
  const configPath = path.join(ROOT, 'data', 'db_config.json');
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.sqlite_path) return path.resolve(ROOT, cfg.sqlite_path);
    } catch {
      // fall through to the default location
    }
  }
  return path.join(ROOT, 'data', 'ed_dashboard.db');
}

function shortStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function usage() {
  console.log(`Penggunaan:
  node scripts/backup-db.mjs [--out <folder>]     buat snapshot konsisten
  node scripts/backup-db.mjs --list               tampilkan daftar backup
  node scripts/backup-db.mjs --restore <berkas>   pulihkan dari snapshot
  node scripts/backup-db.mjs --restore <berkas> --force   timpa tanpa konfirmasi
`);
}

function doBackup(outDir) {
  const dbPath = resolveDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error(`[backup] Basis data tidak ditemukan: ${dbPath}`);
    process.exit(1);
  }

  const targetDir = path.resolve(ROOT, outDir || 'backups');
  fs.mkdirSync(targetDir, { recursive: true });

  const stamp = shortStamp();
  const snapshotPath = path.join(targetDir, `ed_dashboard-${stamp}.db`);

  const db = new DatabaseSync(dbPath);
  try {
    // Single-statement, transactionally consistent copy that includes WAL content.
    db.exec(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
    const integrity = db.prepare('PRAGMA integrity_check').get();
    const integrityValue = integrity ? Object.values(integrity)[0] : 'unknown';
    if (String(integrityValue).toLowerCase() !== 'ok') {
      console.error(`[backup] Pemeriksaan integritas gagal: ${integrityValue}`);
      process.exit(1);
    }
  } finally {
    db.close();
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceDatabase: dbPath,
    snapshot: path.basename(snapshotPath),
    sizeBytes: fs.statSync(snapshotPath).size,
    sha256: sha256(snapshotPath),
  };
  fs.writeFileSync(
    path.join(targetDir, `ed_dashboard-${stamp}.manifest.json`),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(`[backup] Snapshot dibuat: ${snapshotPath}`);
  console.log(`[backup] Ukuran: ${(manifest.sizeBytes / 1024).toFixed(1)} KB`);
  console.log(`[backup] SHA-256: ${manifest.sha256}`);
}

function doList(outDir) {
  const targetDir = path.resolve(ROOT, outDir || 'backups');
  if (!fs.existsSync(targetDir)) {
    console.log('[backup] Belum ada direktori backup.');
    return;
  }
  const files = fs
    .readdirSync(targetDir)
    .filter((name) => name.endsWith('.db'))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.log('[backup] Belum ada berkas backup.');
    return;
  }
  for (const name of files) {
    const full = path.join(targetDir, name);
    const stat = fs.statSync(full);
    console.log(`${stat.mtime.toISOString()}  ${(stat.size / 1024).toFixed(1).padStart(9)} KB  ${name}`);
  }
}

function doRestore(file, force) {
  const dbPath = resolveDbPath();
  const source = path.resolve(ROOT, file);
  if (!fs.existsSync(source)) {
    console.error(`[restore] Berkas backup tidak ditemukan: ${source}`);
    process.exit(1);
  }

  // Validate the snapshot before touching the live database.
  const probe = new DatabaseSync(source, { readOnly: true });
  try {
    const integrity = probe.prepare('PRAGMA integrity_check').get();
    const value = integrity ? Object.values(integrity)[0] : 'unknown';
    if (String(value).toLowerCase() !== 'ok') {
      console.error(`[restore] Snapshot rusak (integrity_check: ${value}); restore dibatalkan.`);
      process.exit(1);
    }
    const users = probe.prepare('SELECT COUNT(*) AS c FROM users').get();
    console.log(`[restore] Snapshot valid. Akun terbaca: ${users ? users.c : 'n/a'}`);
  } catch (error) {
    console.error(`[restore] Snapshot tidak dapat dibaca: ${error.message}`);
    process.exit(1);
  } finally {
    probe.close();
  }

  const sidecar = `${dbPath}.pre-restore-${shortStamp()}`;
  if (fs.existsSync(dbPath)) {
    if (!force) {
      fs.copyFileSync(dbPath, sidecar);
      console.log(`[restore] Basis data saat ini disalin ke ${path.basename(sidecar)}`);
    }
    // WAL/SHM files belong to the old database and must not survive the swap.
    for (const suffix of ['-wal', '-shm']) {
      const file2 = `${dbPath}${suffix}`;
      if (fs.existsSync(file2)) fs.rmSync(file2);
    }
  }

  fs.copyFileSync(source, dbPath);
  console.log(`[restore] Snapshot dipulihkan ke ${dbPath}`);
  console.log('[restore] Jalankan ulang aplikasi, lalu verifikasi login dan satu laporan.');
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  usage();
} else if (args.restore) {
  doRestore(args.restore, args.force);
} else if (args.list) {
  doList(args.out);
} else {
  doBackup(args.out);
}
