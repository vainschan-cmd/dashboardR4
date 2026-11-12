import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  MIGRATIONS,
  appliedMigrations,
  migrationStatus,
  rollbackLastMigration,
  runMigrations,
} from '@/lib/migrations';

/**
 * `CODE-12` — numbered migrations.
 *
 * These run against a real in-memory SQLite database. The previous
 * `execSafeMigration` swallowed every error except "duplicate column name", so the
 * only honest way to show that migrations are now recorded, ordered, and
 * reversible is to execute them.
 */

let db: DatabaseSync;

/** Minimal pre-migration schema: no `order_seq`, no profile columns. */
function legacySchema(target: DatabaseSync): void {
  target.exec(`
    CREATE TABLE branches (id TEXT PRIMARY KEY, code TEXT, name TEXT);
    CREATE TABLE monthly_records (id TEXT PRIMARY KEY, branch_id TEXT);
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, name TEXT);
  `);
  target.exec("INSERT INTO branches (id, code, name) VALUES ('term_makassar','R01','Makassar');");
  target.exec("INSERT INTO monthly_records (id, branch_id) VALUES ('rec_1','term_new_makassar');");
  target.exec("INSERT INTO users (id, username, name) VALUES ('usr_viewer','bod_regional','Lama');");
  target.exec("INSERT INTO users (id, username, name) VALUES ('usr_bagus','10010','Bagus');");
}

function columnsOf(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  legacySchema(db);
});

afterEach(() => {
  db.close();
});

describe('runMigrations', () => {
  it('menerapkan seluruh migrasi berurutan pada basis data lama', () => {
    const result = runMigrations(db);
    const expected = MIGRATIONS.map((m) => m.id);
    expect(result.appliedIds).toEqual(expected);
    expect(result.skippedIds).toEqual([]);
  });

  it('membuat kolom yang dibutuhkan migrasi', () => {
    runMigrations(db);
    expect(columnsOf('branches')).toContain('order_seq');
    for (const column of [
      'nipp',
      'divisi',
      'departemen',
      'password',
      'created_at',
      'token_version',
      'must_change_password',
      'password_updated_at',
    ]) {
      expect(columnsOf('users'), column).toContain(column);
    }
  });

  it('menjalankan perubahan data, bukan hanya DDL', () => {
    runMigrations(db);
    const record = db.prepare("SELECT branch_id FROM monthly_records WHERE id = 'rec_1'").get() as {
      branch_id: string;
    };
    expect(record.branch_id).toBe('term_makassar');

    const legacy = db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = 'usr_viewer'").get() as { n: number };
    expect(legacy.n).toBe(0);
    const kept = db.prepare("SELECT COUNT(*) AS n FROM users WHERE id = 'usr_bagus'").get() as { n: number };
    expect(kept.n).toBe(1);
  });

  it('mencatat setiap migrasi yang diterapkan', () => {
    runMigrations(db);
    const applied = appliedMigrations(db);
    expect(applied.map((m) => m.id)).toEqual(MIGRATIONS.map((m) => m.id));
    for (const row of applied) {
      expect(row.name.length).toBeGreaterThan(0);
      expect(Number.isNaN(new Date(row.applied_at).getTime())).toBe(false);
    }
  });

  it('idempoten: menjalankan ulang tidak menerapkan apa pun', () => {
    runMigrations(db);
    const second = runMigrations(db);
    expect(second.appliedIds).toEqual([]);
    expect(second.skippedIds).toEqual(MIGRATIONS.map((m) => m.id));
    // The destructive data migration must not run twice either.
    expect(appliedMigrations(db)).toHaveLength(MIGRATIONS.length);
  });

  it('aman pada basis data yang sudah memiliki kolomnya', () => {
    db.exec('ALTER TABLE branches ADD COLUMN order_seq INTEGER DEFAULT 99;');
    const result = runMigrations(db);
    expect(result.appliedIds).toContain(1);
    expect(columnsOf('branches').filter((c) => c === 'order_seq')).toHaveLength(1);
  });

  it('tidak menyentuh tabel yang tidak ada', () => {
    const bare = new DatabaseSync(':memory:');
    // A brand-new file has no `branches`/`users` yet; migrations must not throw.
    expect(() => runMigrations(bare)).not.toThrow();
    bare.close();
  });

  it('membatalkan langkah yang gagal dan berhenti di situ', () => {
    // Force a genuine failure: pre-create `schema_migrations` with a constraint that
    // rejects the recording insert for migration 1. `ensureMigrationTable` uses
    // CREATE TABLE IF NOT EXISTS, so this table survives.
    db.exec(`
      CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL CHECK (name <> 'branches_order_seq'),
        applied_at TEXT NOT NULL
      );
    `);

    const failures: Array<{ id: number; name: string }> = [];
    expect(() =>
      runMigrations(db, { onError: (_error, migration) => failures.push({ id: migration.id, name: migration.name }) })
    ).toThrow();

    // The callback saw the failure and identified the migration.
    expect(failures).toEqual([{ id: 1, name: 'branches_order_seq' }]);

    // SQLite DDL is transactional, so the ALTER TABLE was rolled back with the
    // failed insert — that is the property worth proving: a failed migration leaves
    // the schema exactly as it was, not half-migrated.
    expect(columnsOf('branches')).not.toContain('order_seq');

    // Nothing was recorded, so the run can be retried after the cause is fixed.
    expect(appliedMigrations(db)).toEqual([]);
  });

  it('tidak melempar pada basis data yang belum punya tabel aplikasi', () => {
    const bare = new DatabaseSync(':memory:');
    // A brand-new file has no `branches`/`users` yet; migrations must not throw.
    expect(() => runMigrations(bare)).not.toThrow();
    expect(appliedMigrations(bare).map((m) => m.id)).toEqual(MIGRATIONS.map((m) => m.id));
    bare.close();
  });
});

describe('migrationStatus', () => {
  it('melaporkan semua migrasi sebagai pending pada basis data baru', () => {
    const status = migrationStatus(db);
    expect(status.applied).toEqual([]);
    expect(status.pending.map((m) => m.id)).toEqual(MIGRATIONS.map((m) => m.id));
    expect(status.latest).toBe(MIGRATIONS[MIGRATIONS.length - 1].id);
  });

  it('melaporkan tidak ada pending setelah migrasi dijalankan', () => {
    runMigrations(db);
    const status = migrationStatus(db);
    expect(status.pending).toEqual([]);
    expect(status.applied).toHaveLength(MIGRATIONS.length);
  });

  it('nomor migrasi unik dan menaik', () => {
    const ids = MIGRATIONS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
  });
});

describe('rollbackLastMigration', () => {
  it('membatalkan migrasi terakhir yang punya down', () => {
    db.exec('ALTER TABLE branches ADD COLUMN order_seq INTEGER DEFAULT 99;');
    runMigrations(db);
    // The guard must fire for a migration that has NO rollback path, whichever
    // one happens to be last. Migration 2 renames a branch and is deliberately
    // irreversible, so target it explicitly instead of relying on the list order
    // (`CODE-12` added #8, which IS reversible, and the old form of this test
    // silently stopped exercising the guard).
    db.exec('DELETE FROM schema_migrations WHERE id > 2;');
    expect(() => rollbackLastMigration(db)).toThrow(/tidak menyediakan rollback/);

    db.exec('DELETE FROM schema_migrations WHERE id > 1;');
    const result = rollbackLastMigration(db);
    expect(result.reverted.id).toBe(1);
    expect(columnsOf('branches')).not.toContain('order_seq');
    expect(appliedMigrations(db)).toEqual([]);
  });

  it('migrasi view entitas dapat dibatalkan', () => {
    // The bridge view is a projection, so dropping it destroys no data — that is
    // exactly why it is allowed to have a `down`.
    //
    // The shared fixture deliberately omits `module_finansial` (migration 8 must
    // no-op on a partial schema), so create it here for this one case.
    db.exec(`CREATE TABLE module_finansial (
      id TEXT PRIMARY KEY, monthly_record_id TEXT, year INTEGER, month INTEGER,
      branch_code TEXT, branch_name TEXT, rekening TEXT,
      cabang_rp REAL, pmt_rp REAL, ptp_rp REAL, psl_rp REAL, pjm_rp REAL,
      eliminasi_rp REAL, konsolidasi_rp REAL, yoy REAL, rka REAL, source_type TEXT,
      verification_status TEXT, uploaded_by TEXT, uploaded_at TEXT, verified_by TEXT,
      verified_at TEXT, revision_notes TEXT, verified_snapshot_json TEXT
    );`);
    runMigrations(db);
    const viewExists = () =>
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'v_module_finansial_entitas'")
        .get();
    expect(viewExists()).toBeTruthy();

    const result = rollbackLastMigration(db);
    expect(result.reverted.id).toBe(8);
    expect(viewExists()).toBeFalsy();
  });

  it('migrasi view entitas tidak dibuat bila tabel sumber belum ada', () => {
    // Guard against creating a view that references a missing table: SQLite would
    // then fail to reparse the schema on the next ALTER TABLE, taking the whole
    // database with it.
    runMigrations(db);
    const view = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'view' AND name = 'v_module_finansial_entitas'")
      .get();
    expect(view).toBeFalsy();
    // And the schema stays usable afterwards.
    expect(() => db.exec('ALTER TABLE branches ADD COLUMN probe INTEGER;')).not.toThrow();
  });

  it('menolak rollback saat tidak ada migrasi tercatat', () => {
    expect(() => rollbackLastMigration(db)).toThrow(/Tidak ada migrasi/);
  });

  it('menolak rollback untuk migrasi yang tidak dikenal kode', () => {
    runMigrations(db);
    db.prepare("INSERT INTO schema_migrations (id, name, applied_at) VALUES (999, 'masa_depan', ?)").run(
      new Date().toISOString()
    );
    expect(() => rollbackLastMigration(db)).toThrow(/tidak ada di kode/);
  });
});
