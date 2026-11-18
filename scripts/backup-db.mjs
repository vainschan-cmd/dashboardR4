#!/usr/bin/env node
/**
 * scripts/backup-db.mjs
 *
 * PostgreSQL backup + restore utility for PortDash R4 (`SA-27`).
 *
 * Uses `pg_dump` / `psql` against `DATABASE_URL` (or falls back to the local
 * `ed_dashboard-postgres` Docker container when `pg_dump` is not installed on
 * the host). Every backup writes a SHA-256 checksum sidecar (`.sha256`).
 *
 * Usage:
 *   node scripts/backup-db.mjs                       # backup into ./backups
 *   node scripts/backup-db.mjs --out /secure/path    # custom destination
 *   node scripts/backup-db.mjs --list                # list existing backups
 *   node scripts/backup-db.mjs --restore <file> --force
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_BACKUP_DIR = path.join(ROOT, 'backups');
const DOCKER_CONTAINER = process.env.PG_DOCKER_CONTAINER || 'ed_dashboard-postgres';

function parseArgs(argv) {
  const args = { out: null, restore: null, list: false, force: false, help: false };
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

function shortStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function hasCommand(cmd) {
  const res = spawnSync('which', [cmd], { encoding: 'utf8' });
  return res.status === 0;
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function listBackups(dir) {
  if (!fs.existsSync(dir)) {
    console.log('Belum ada direktori backup.');
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('Belum ada berkas backup PostgreSQL (.sql) di', dir);
    return;
  }
  console.log(`Daftar backup PostgreSQL (${dir}):`);
  for (const f of files) {
    const stat = fs.statSync(path.join(dir, f));
    console.log(`  - ${f} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  }
}

function runBackup(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const targetFile = path.join(outDir, `backup_ed_dashboard_${shortStamp()}.sql`);
  const databaseUrl = process.env.DATABASE_URL?.trim();

  let result;
  if (databaseUrl && hasCommand('pg_dump')) {
    result = spawnSync('pg_dump', ['--clean', '--if-exists', databaseUrl], {
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
    });
  } else if (hasCommand('docker')) {
    const pgUser = process.env.PGUSER || 'postgres';
    const pgDb = process.env.PGDATABASE || 'ed_dashboard';
    result = spawnSync(
      'docker',
      ['exec', DOCKER_CONTAINER, 'pg_dump', '--clean', '--if-exists', '-U', pgUser, pgDb],
      { maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }
    );
  } else {
    console.error('Error: pg_dump maupun docker tidak tersedia untuk membuat backup PostgreSQL.');
    process.exit(1);
  }

  if (result.status !== 0 || !result.stdout) {
    console.error('Backup PostgreSQL gagal:', result.stderr || 'Tidak ada output dari pg_dump.');
    process.exit(1);
  }

  fs.writeFileSync(targetFile, result.stdout, { mode: 0o600 });
  const digest = sha256File(targetFile);
  fs.writeFileSync(`${targetFile}.sha256`, `${digest}  ${path.basename(targetFile)}\n`, {
    mode: 0o600,
  });

  console.log(`✔ Backup PostgreSQL tersimpan di: ${targetFile}`);
  console.log(`  SHA-256: ${digest}`);
}

function runRestore(filePath, force) {
  if (!force) {
    console.error('Error: --restore memerlukan flag --force untuk menimpa database PostgreSQL.');
    process.exit(1);
  }
  const resolved = path.resolve(ROOT, filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: Berkas backup tidak ditemukan: ${resolved}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(resolved, 'utf8');
  const databaseUrl = process.env.DATABASE_URL?.trim();

  let result;
  if (databaseUrl && hasCommand('psql')) {
    result = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', databaseUrl], {
      input: sql,
      encoding: 'utf8',
    });
  } else if (hasCommand('docker')) {
    const pgUser = process.env.PGUSER || 'postgres';
    const pgDb = process.env.PGDATABASE || 'ed_dashboard';
    result = spawnSync(
      'docker',
      ['exec', '-i', DOCKER_CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', pgUser, '-d', pgDb],
      { input: sql, encoding: 'utf8' }
    );
  } else {
    console.error('Error: psql maupun docker tidak tersedia untuk memulihkan backup PostgreSQL.');
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('Restore PostgreSQL gagal:', result.stderr);
    process.exit(1);
  }

  console.log(`✔ Restore PostgreSQL berhasil dari: ${resolved}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log('Usage: node scripts/backup-db.mjs [--out <dir>] [--list] [--restore <file> --force]');
  process.exit(0);
}

const outDir = args.out ? path.resolve(ROOT, args.out) : DEFAULT_BACKUP_DIR;
if (args.list) {
  listBackups(outDir);
} else if (args.restore) {
  runRestore(args.restore, args.force);
} else {
  runBackup(outDir);
}
