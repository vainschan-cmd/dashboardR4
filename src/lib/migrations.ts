import type { DatabaseSync } from 'node:sqlite';
import { buildEntitasViewSql, hasFinansialTable } from './db/entitasView';

/**
 * Numbered schema migrations (`CODE-12`).
 *
 * Before this module, schema changes were a list of `execSafeMigration(db, sql)`
 * calls that swallowed every error except `duplicate column name`. That had three
 * consequences:
 *
 * 1. **No record of what ran.** A failed statement left the schema in an unknown
 *    state and nothing could tell you which.
 * 2. **No ordering guarantee.** Migrations were "whatever order the lines happen
 *    to be in", so a data change could execute before the column it needed.
 * 3. **No rollback.** There was no `down`, so recovering meant editing the
 *    database by hand.
 *
 * Each migration now has a number, a name, an `up`, and (where it is losslessly
 * reversible) a `down`. Applied migrations are recorded in `schema_migrations`,
 * and `migrationStatus()` answers "what is applied, what is pending" for the
 * operator.
 */

export interface Migration {
  /** Monotonic; ties are a bug, not a preference. */
  id: number;
  name: string;
  up: (db: DatabaseSync) => void;
  /** Omitted when the change cannot be undone without data loss. */
  down?: (db: DatabaseSync) => void;
}

const MIGRATION_TABLE = 'schema_migrations';

function tableExists(db: DatabaseSync, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { name: string } | undefined;
  return Boolean(row);
}

function columnExists(db: DatabaseSync, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return columns.some((c) => c.name === column);
}

/**
 * Idempotent `ALTER TABLE … ADD COLUMN`.
 *
 * A fresh database creates every column in `initSchema`, so on a clean install the
 * migration is a no-op; on an old database it is the actual change. Both paths are
 * correct, which is what makes `up` safe to run against any existing file.
 */
function addColumn(db: DatabaseSync, table: string, column: string, definition: string): void {
  if (!tableExists(db, table)) return;
  if (columnExists(db, table, column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

/**
 * The migration list. Append only — never renumber or edit an applied migration,
 * because existing databases have already recorded it.
 */
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'branches_order_seq',
    up: (db) => addColumn(db, 'branches', 'order_seq', 'INTEGER DEFAULT 99'),
    down: (db) => {
      if (columnExists(db, 'branches', 'order_seq')) {
        db.exec('ALTER TABLE branches DROP COLUMN order_seq;');
      }
    },
  },
  {
    id: 2,
    name: 'rename_branch_term_new_makassar',
    up: (db) => {
      if (!tableExists(db, 'monthly_records')) return;
      db.exec("UPDATE monthly_records SET branch_id = 'term_makassar' WHERE branch_id = 'term_new_makassar';");
      db.exec("DELETE FROM branches WHERE id = 'term_new_makassar' OR code = 'TRM-NMK';");
    },
    // Deliberately irreversible: the pre-rename identifier cannot be recovered
    // from the merged rows without guessing.
  },
  {
    id: 3,
    name: 'users_profile_columns',
    up: (db) => {
      addColumn(db, 'users', 'nipp', 'TEXT');
      addColumn(db, 'users', 'divisi', 'TEXT');
      addColumn(db, 'users', 'departemen', 'TEXT');
      addColumn(db, 'users', 'password', 'TEXT');
      addColumn(db, 'users', 'created_at', 'TEXT');
    },
  },
  {
    id: 4,
    name: 'users_session_columns',
    up: (db) => {
      addColumn(db, 'users', 'token_version', 'INTEGER DEFAULT 0');
      addColumn(db, 'users', 'must_change_password', 'INTEGER DEFAULT 0');
      addColumn(db, 'users', 'password_updated_at', 'TEXT');
    },
  },
  {
    id: 5,
    name: 'drop_legacy_seed_users',
    up: (db) => {
      if (!tableExists(db, 'users')) return;
      db.exec(
        "DELETE FROM users WHERE id IN ('usr_pic_nmk', 'usr_viewer', 'usr_super', 'usr_pic_ops', 'usr_adminreg') " +
          "OR username IN ('pic_nmk', 'bod_regional', 'superadmin', 'pic_ops', 'adminreg');"
      );
    },
  },
  {
    id: 6,
    name: 'clear_dangling_module_record_links',
    /**
     * `DATA-10`: 886 of ~1.900 module rows referenced a `monthly_record_id` that
     * does not exist. The ingest scripts wrote `rec_fin_2025_9_r01_beban`, while
     * `monthly_records` uses a different scheme (`rec_2026_1_term_ambon_cargo`),
     * so the link never resolved.
     *
     * A dangling pointer is worse than no pointer: it asserts a relationship that
     * is not there, and `updateRecordVerification` (which cascades on
     * `monthly_record_id`) silently matches nothing. Clearing it makes the absence
     * visible and lets the integrity audit pass.
     *
     * Reversible in the sense that it only nulls values that resolved to nothing.
     */
    up: (db) => {
      for (const table of [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ]) {
        if (!tableExists(db, table) || !columnExists(db, table, 'monthly_record_id')) continue;
        if (!tableExists(db, 'monthly_records')) continue;
        db.exec(`
          UPDATE ${table}
             SET monthly_record_id = NULL
           WHERE monthly_record_id IS NOT NULL
             AND monthly_record_id != ''
             AND NOT EXISTS (
               SELECT 1 FROM monthly_records r WHERE r.id = ${table}.monthly_record_id
             );
        `);
      }
    },
  },
  {
    id: 7,
    name: 'module_lineage_columns',
    /**
     * `DATA-05`: a module row could not answer "where did this number come from?".
     * It had `uploaded_by`/`uploaded_at` but no file, sheet, row, or batch, so an
     * operator investigating a figure had to guess which upload produced it.
     *
     * The columns are nullable: rows written before this migration genuinely have
     * no recorded origin, and inventing one would defeat the purpose.
     */
    up: (db) => {
      for (const table of [
        'module_finansial',
        'module_opkom',
        'module_kinerja',
        'module_utilisasi',
        'module_peralatan',
        'module_fasilitas',
      ]) {
        addColumn(db, table, 'source_file', 'TEXT');
        addColumn(db, table, 'source_sheet', 'TEXT');
        addColumn(db, table, 'source_row', 'INTEGER');
        addColumn(db, table, 'batch_id', 'TEXT');
      }
    },
  },
  {
    id: 8,
    name: 'entitas_bridge_view',
    /**
     * Bridge between this project's wide financial table and the tall shape the
     * ported aggregation services expect.
     *
     * `module_finansial` keeps the entity split in columns (`cabang_rp`, `pjm_rp`,
     * …); the aggregation SQL that came with the UI overhaul was authored against
     * a PostgreSQL schema with one row per entity and a single `realisasi`
     * column. Reshaping the table would break ingest, lineage, four-eyes, and the
     * verification workflow, so the tall shape is exposed as a view instead.
     *
     * It is a projection of the same rows, so the two representations cannot
     * disagree. `down` is safe: dropping a view destroys no data.
     */
    up: (db) => {
      // A partially built schema may not have the source table yet; creating a
      // view that references a missing table would make every later schema
      // operation on this database fail while SQLite tries to reparse it.
      if (!hasFinansialTable(db)) return;
      db.exec(buildEntitasViewSql());
    },
    down: (db) => {
      db.exec('DROP VIEW IF EXISTS v_module_finansial_entitas');
    },
  },
];

/** `schema_migrations` must exist before anything can be recorded. */
export function ensureMigrationTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export interface AppliedMigration {
  id: number;
  name: string;
  applied_at: string;
}

export function appliedMigrations(db: DatabaseSync): AppliedMigration[] {
  ensureMigrationTable(db);
  return db
    .prepare(`SELECT id, name, applied_at FROM ${MIGRATION_TABLE} ORDER BY id ASC`)
    .all() as unknown as AppliedMigration[];
}

export interface MigrationStatus {
  applied: AppliedMigration[];
  pending: Array<{ id: number; name: string }>;
  /** Highest migration number known to the codebase. */
  latest: number;
}

/** Operator-facing answer to "where is this database in the migration history?" */
export function migrationStatus(db: DatabaseSync): MigrationStatus {
  const applied = appliedMigrations(db);
  const appliedIds = new Set(applied.map((m) => m.id));
  return {
    applied,
    pending: MIGRATIONS.filter((m) => !appliedIds.has(m.id)).map((m) => ({ id: m.id, name: m.name })),
    latest: MIGRATIONS.reduce((max, m) => Math.max(max, m.id), 0),
  };
}

export interface RunMigrationsResult {
  appliedIds: number[];
  skippedIds: number[];
}

/**
 * Apply every pending migration in ascending order, recording each one in its own
 * transaction. A failing migration aborts the run and leaves the database at the
 * last successfully applied step — a partially migrated schema is worse than an
 * old one.
 */
export function runMigrations(
  db: DatabaseSync,
  options: { onError?: (error: unknown, migration: Migration) => void } = {}
): RunMigrationsResult {
  ensureMigrationTable(db);
  const appliedIds = new Set(appliedMigrations(db).map((m) => m.id));
  const result: RunMigrationsResult = { appliedIds: [], skippedIds: [] };

  for (const migration of [...MIGRATIONS].sort((a, b) => a.id - b.id)) {
    if (appliedIds.has(migration.id)) {
      result.skippedIds.push(migration.id);
      continue;
    }
    db.exec('BEGIN');
    try {
      migration.up(db);
      db.prepare(`INSERT INTO ${MIGRATION_TABLE} (id, name, applied_at) VALUES (?, ?, ?)`).run(
        migration.id,
        migration.name,
        new Date().toISOString()
      );
      db.exec('COMMIT');
      result.appliedIds.push(migration.id);
    } catch (error) {
      db.exec('ROLLBACK');
      options.onError?.(error, migration);
      throw error;
    }
  }

  return result;
}

export interface RollbackResult {
  reverted: { id: number; name: string };
  reason?: undefined;
}

/**
 * Revert the most recently applied migration. Throws when that migration has no
 * `down`, rather than silently claiming success and leaving the schema unchanged.
 */
export function rollbackLastMigration(db: DatabaseSync): RollbackResult {
  const applied = appliedMigrations(db);
  const last = applied[applied.length - 1];
  if (!last) throw new Error('Tidak ada migrasi yang dapat dibatalkan.');

  const migration = MIGRATIONS.find((m) => m.id === last.id);
  if (!migration) {
    throw new Error(
      `Migrasi #${last.id} (${last.name}) tercatat di basis data tetapi tidak ada di kode. ` +
        'Tidak dapat dibatalkan otomatis.'
    );
  }
  if (!migration.down) {
    throw new Error(
      `Migrasi #${migration.id} (${migration.name}) tidak menyediakan rollback karena bersifat merusak data. ` +
        'Pulihkan dari cadangan bila perlu dibatalkan.'
    );
  }

  db.exec('BEGIN');
  try {
    migration.down(db);
    db.prepare(`DELETE FROM ${MIGRATION_TABLE} WHERE id = ?`).run(migration.id);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { reverted: { id: migration.id, name: migration.name } };
}
