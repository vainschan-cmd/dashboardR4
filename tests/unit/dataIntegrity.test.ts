import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_YEAR,
  MIN_YEAR,
  MODULE_TABLES,
  ModuleScopeError,
  assertModuleScope,
  auditModuleTables,
  isKnownBranchCode,
  validateModuleScope,
} from '@/lib/dataIntegrity';

/**
 * `DATA-10` — no orphan rows in the `module_*` tables.
 *
 * These tables carry a `branch_code` with no foreign key (SQLite cannot add one
 * to an existing table), so the guarantee has to be enforced by validation at the
 * write boundary and made observable by an audit. Both halves are tested here.
 */

describe('isKnownBranchCode', () => {
  it('menerima kode resmi tanpa membedakan huruf besar/kecil', () => {
    expect(isKnownBranchCode('R01')).toBe(true);
    expect(isKnownBranchCode('r01')).toBe(true);
    expect(isKnownBranchCode('  R99 ')).toBe(true);
  });

  it('menolak kode yang tidak ada di daftar cabang resmi', () => {
    for (const code of ['R1', 'MAKASSAR', 'R01X', '', null, undefined, 1]) {
      expect(isKnownBranchCode(code), String(code)).toBe(false);
    }
  });
});

describe('validateModuleScope', () => {
  it('menerima cabang dan periode yang sah', () => {
    const result = validateModuleScope({ branchCode: 'R01', month: 9, year: 2026 });
    expect(result.ok).toBe(true);
    expect(result.scope).toEqual({ branchCode: 'R01', month: 9, year: 2026 });
    expect(result.issues).toEqual([]);
  });

  it('menormalkan kode cabang huruf kecil menjadi kanonis', () => {
    // `r01` and `R01` must not become two different branches in the database.
    expect(validateModuleScope({ branchCode: 'r01', month: 9, year: 2026 }).scope?.branchCode).toBe('R01');
    expect(validateModuleScope({ branchCode: ' r19 ', month: 9, year: 2026 }).scope?.branchCode).toBe('R19');
  });

  it('menolak cabang kosong alih-alih memakai default', () => {
    // The old code silently defaulted to R01, attributing data to Makassar.
    const result = validateModuleScope({ branchCode: '', month: 9, year: 2026 });
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('wajib diisi');
    expect(result.scope).toBeUndefined();
  });

  it('menolak cabang yang tidak dikenal', () => {
    const result = validateModuleScope({ branchCode: 'MAKASSAR', month: 9, year: 2026 });
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('tidak dikenal');
  });

  it('menolak bulan di luar 1–12, termasuk pecahan', () => {
    for (const month of [0, 13, -1, 9.5, 'sembilan', null]) {
      const result = validateModuleScope({ branchCode: 'R01', month, year: 2026 });
      expect(result.ok, String(month)).toBe(false);
    }
  });

  it('menolak tahun di luar jendela yang masuk akal', () => {
    for (const year of [MIN_YEAR - 1, MAX_YEAR + 1, 0, 'dua ribu', null]) {
      expect(validateModuleScope({ branchCode: 'R01', month: 1, year }).ok, String(year)).toBe(false);
    }
    expect(validateModuleScope({ branchCode: 'R01', month: 1, year: MIN_YEAR }).ok).toBe(true);
    expect(validateModuleScope({ branchCode: 'R01', month: 12, year: MAX_YEAR }).ok).toBe(true);
  });

  it('melaporkan seluruh masalah sekaligus, bukan satu per percobaan', () => {
    const result = validateModuleScope({ branchCode: 'XX', month: 0, year: 1800 });
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(3);
  });
});

describe('assertModuleScope', () => {
  it('mengembalikan scope yang sudah dinormalkan', () => {
    expect(assertModuleScope({ branchCode: 'r04', month: '3', year: '2026' })).toEqual({
      branchCode: 'R04',
      month: 3,
      year: 2026,
    });
  });

  it('melempar ModuleScopeError yang membawa daftar masalah', () => {
    try {
      assertModuleScope({ branchCode: '', month: 9, year: 2026 });
      throw new Error('seharusnya melempar');
    } catch (error) {
      expect(error).toBeInstanceOf(ModuleScopeError);
      const scopeError = error as ModuleScopeError;
      expect(scopeError.issues.length).toBeGreaterThan(0);
      // The message must be usable in a 400 response as-is.
      expect(scopeError.message.length).toBeGreaterThan(10);
    }
  });
});

describe('auditModuleTables', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE branches (id TEXT PRIMARY KEY, code TEXT, name TEXT);
      CREATE TABLE monthly_records (id TEXT PRIMARY KEY);
      CREATE TABLE module_opkom (
        id TEXT PRIMARY KEY,
        monthly_record_id TEXT,
        branch_code TEXT,
        year INTEGER,
        month INTEGER
      );
    `);
    db.exec("INSERT INTO branches (id, code, name) VALUES ('b1','R01','Makassar');");
    db.exec("INSERT INTO monthly_records (id) VALUES ('rec_1');");
  });

  afterEach(() => {
    db.close();
  });

  it('melaporkan bersih ketika semua baris valid', () => {
    db.exec(
      "INSERT INTO module_opkom (id, monthly_record_id, branch_code, year, month) VALUES ('a','rec_1','R01',2026,9);"
    );
    const audit = auditModuleTables(db);
    expect(audit.ok).toBe(true);
    expect(audit.totalProblems).toBe(0);
    const opkom = audit.tables.find((t) => t.table === 'module_opkom');
    expect(opkom?.totalRows).toBe(1);
  });

  it('menemukan baris dengan cabang yang tidak dikenal', () => {
    db.exec(
      "INSERT INTO module_opkom (id, monthly_record_id, branch_code, year, month) VALUES ('b','rec_1','MAKASSAR',2026,9);"
    );
    const audit = auditModuleTables(db);
    expect(audit.ok).toBe(false);
    const opkom = audit.tables.find((t) => t.table === 'module_opkom');
    expect(opkom?.orphanBranchRows).toBe(1);
    expect(opkom?.sampleIds).toContain('b');
  });

  it('menemukan periode tidak valid', () => {
    db.exec(
      "INSERT INTO module_opkom (id, monthly_record_id, branch_code, year, month) VALUES ('c','rec_1','R01',2026,13),('d','rec_1','R01',1800,1);"
    );
    const opkom = auditModuleTables(db).tables.find((t) => t.table === 'module_opkom');
    expect(opkom?.invalidPeriodRows).toBe(2);
  });

  it('menemukan baris yang menunjuk record bulanan yang sudah tidak ada', () => {
    db.exec(
      "INSERT INTO module_opkom (id, monthly_record_id, branch_code, year, month) VALUES ('e','rec_hilang','R01',2026,9);"
    );
    const opkom = auditModuleTables(db).tables.find((t) => t.table === 'module_opkom');
    expect(opkom?.danglingRecordRows).toBe(1);
  });

  it('tidak melempar ketika sebagian tabel modul belum ada', () => {
    // A fresh install has no module tables yet; the audit must still answer.
    const audit = auditModuleTables(db);
    expect(audit.tables).toHaveLength(MODULE_TABLES.length);
    expect(audit.tables.find((t) => t.table === 'module_fasilitas')?.totalRows).toBe(0);
  });

  it('menghitung total masalah dari seluruh tabel', () => {
    db.exec(
      "INSERT INTO module_opkom (id, monthly_record_id, branch_code, year, month) VALUES ('f','rec_1','XXX',2026,9),('g','rec_1','R01',2026,0);"
    );
    const audit = auditModuleTables(db);
    expect(audit.totalProblems).toBe(2);
    expect(audit.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

/**
 * The real database, when it is present.
 *
 * A validator only protects future writes; the rows already stored are the ones
 * an operator will be asked about. Auditing the actual file makes "tidak ada baris
 * yatim" a check rather than a claim. Skipped in a clean checkout where the data
 * file has not been created yet.
 */
const REAL_DB = resolve(__dirname, '../../data/ed_dashboard.db');

describe.skipIf(!existsSync(REAL_DB))('audit basis data nyata', () => {
  it('tidak ada baris yatim pada data yang tersimpan', () => {
    const db = new DatabaseSync(REAL_DB, { readOnly: true });
    try {
      const audit = auditModuleTables(db);
      const detail = audit.tables
        .filter((t) => t.orphanBranchRows + t.invalidPeriodRows + t.danglingRecordRows > 0)
        .map(
          (t) =>
            `${t.table}: cabang=${t.orphanBranchRows} periode=${t.invalidPeriodRows} record=${t.danglingRecordRows} (${t.sampleIds.join(', ')})`
        )
        .join(' | ');
      expect(audit.totalProblems, detail).toBe(0);
      expect(audit.ok).toBe(true);
    } finally {
      db.close();
    }
  });
});
