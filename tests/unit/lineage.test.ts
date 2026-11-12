import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  buildLineage,
  describeLineage,
  hasRestorableSnapshot,
  restoreVerifiedSnapshot,
} from '@/lib/lineage';

/**
 * `DATA-05` — lineage and verified-snapshot recovery.
 *
 * Two claims under test:
 * 1. A row can say where it came from (file/sheet/row/batch/uploader).
 * 2. An approved figure that was overwritten can be brought back — proven with a
 *    real round-trip, not by asserting that a column exists.
 */

describe('buildLineage', () => {
  it('menandai baris dapat dilacak hanya jika berkas dan baris diketahui', () => {
    expect(buildLineage({ sourceFile: 'laporan.xlsx', sourceRow: 12 }).isTraceable).toBe(true);
    expect(buildLineage({ sourceFile: 'laporan.xlsx' }).isTraceable).toBe(false);
    expect(buildLineage({ sourceRow: 12 }).isTraceable).toBe(false);
    expect(buildLineage({ batchId: 'batch_1' }).isTraceable).toBe(false);
  });

  it('menormalkan nilai kosong menjadi null, bukan string kosong', () => {
    const lineage = buildLineage({ sourceFile: '   ', sourceSheet: '', sourceRow: NaN, batchId: null });
    expect(lineage.sourceFile).toBeNull();
    expect(lineage.sourceSheet).toBeNull();
    expect(lineage.sourceRow).toBeNull();
    expect(lineage.batchId).toBeNull();
  });

  it('menolak nomor baris yang tidak masuk akal', () => {
    expect(buildLineage({ sourceRow: 0 }).sourceRow).toBeNull();
    expect(buildLineage({ sourceRow: -3 }).sourceRow).toBeNull();
    expect(buildLineage({ sourceRow: 4.7 }).sourceRow).toBe(4);
  });
});

describe('describeLineage', () => {
  it('menyebut berkas, sheet, dan baris', () => {
    const text = describeLineage({
      sourceFile: 'laporan.xlsx',
      sourceSheet: 'LAPKEU',
      sourceRow: 12,
      uploadedBy: '10004',
      batchId: 'batch_abc',
    });
    expect(text).toContain('laporan.xlsx');
    expect(text).toContain('sheet LAPKEU');
    expect(text).toContain('baris 12');
    expect(text).toContain('10004');
    expect(text).toContain('batch_abc');
  });

  it('menjelaskan input manual tanpa berkas', () => {
    expect(describeLineage({ sourceType: 'manual_input', uploadedBy: '10002' })).toContain('input manual');
  });

  it('mengembalikan null ketika tidak ada yang diketahui', () => {
    // Better to print nothing than "tidak diketahui" on every row.
    expect(describeLineage({})).toBeNull();
  });
});

describe('restoreVerifiedSnapshot', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE module_opkom (
        id TEXT PRIMARY KEY,
        branch_code TEXT,
        layanan TEXT,
        jumlah_rp REAL,
        verification_status TEXT,
        uploaded_by TEXT,
        verified_by TEXT,
        verified_at TEXT,
        verified_snapshot_json TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  function insertRow(overrides: Record<string, unknown> = {}) {
    const row = {
      id: 'mod_1',
      branch_code: 'R01',
      layanan: 'KAPAL',
      jumlah_rp: 1500,
      verification_status: 'pending_verification',
      uploaded_by: '10004',
      verified_by: null,
      verified_at: null,
      verified_snapshot_json: JSON.stringify({ jumlah_rp: 1000 }),
      ...overrides,
    };
    db.prepare(
      `INSERT INTO module_opkom (id, branch_code, layanan, jumlah_rp, verification_status, uploaded_by, verified_by, verified_at, verified_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row.id,
      row.branch_code,
      row.layanan,
      row.jumlah_rp,
      row.verification_status,
      row.uploaded_by,
      row.verified_by,
      row.verified_at,
      row.verified_snapshot_json
    );
  }

  function readRow() {
    return db.prepare('SELECT * FROM module_opkom WHERE id = ?').get('mod_1') as Record<string, unknown>;
  }

  it('mengembalikan nilai yang dulu disetujui', () => {
    insertRow({ jumlah_rp: 1500 }); // edited value
    const result = restoreVerifiedSnapshot(db, {
      table: 'module_opkom',
      id: 'mod_1',
      actorNipp: '10002',
    });

    expect(result.restored).toBe(true);
    expect(result.fields).toContain('jumlah_rp');
    const row = readRow();
    expect(row.jumlah_rp).toBe(1000); // the approved figure is back
    expect(row.verification_status).toBe('verified');
  });

  it('mencatat siapa yang memulihkan dan kapan', () => {
    insertRow();
    restoreVerifiedSnapshot(db, { table: 'module_opkom', id: 'mod_1', actorNipp: '10002' });
    const row = readRow();
    expect(row.verified_by).toBe('10002');
    expect(Number.isNaN(new Date(String(row.verified_at)).getTime())).toBe(false);
  });

  it('mengosongkan snapshot setelah dipulihkan agar tidak dipakai dua kali', () => {
    insertRow();
    restoreVerifiedSnapshot(db, { table: 'module_opkom', id: 'mod_1', actorNipp: '10002' });
    expect(readRow().verified_snapshot_json).toBeNull();
  });

  it('menolak baris tanpa snapshot, dengan alasan yang jelas', () => {
    insertRow({ verified_snapshot_json: null });
    const result = restoreVerifiedSnapshot(db, {
      table: 'module_opkom',
      id: 'mod_1',
      actorNipp: '10002',
    });
    expect(result.restored).toBe(false);
    expect(result.reason).toContain('tidak memiliki snapshot');
    // And nothing changed.
    expect(readRow().jumlah_rp).toBe(1500);
  });

  it('menolak snapshot yang rusak alih-alih menulis nilai acak', () => {
    insertRow({ verified_snapshot_json: '{bukan json' });
    const result = restoreVerifiedSnapshot(db, {
      table: 'module_opkom',
      id: 'mod_1',
      actorNipp: '10002',
    });
    expect(result.restored).toBe(false);
    expect(result.reason).toContain('rusak');
  });

  it('mengabaikan kolom snapshot yang tidak lagi ada pada tabel', () => {
    // Snapshots outlive schema changes; restoring a dropped column would throw.
    insertRow({ verified_snapshot_json: JSON.stringify({ jumlah_rp: 1000, kolom_lama: 'x' }) });
    const result = restoreVerifiedSnapshot(db, {
      table: 'module_opkom',
      id: 'mod_1',
      actorNipp: '10002',
    });
    expect(result.restored).toBe(true);
    expect(result.fields).toEqual(['jumlah_rp']);
  });

  it('menolak baris yang tidak ditemukan', () => {
    const result = restoreVerifiedSnapshot(db, {
      table: 'module_opkom',
      id: 'tidak_ada',
      actorNipp: '10002',
    });
    expect(result.restored).toBe(false);
    expect(result.reason).toContain('tidak ditemukan');
  });
});

describe('hasRestorableSnapshot', () => {
  it('benar hanya untuk snapshot JSON yang berisi kolom', () => {
    expect(hasRestorableSnapshot({ verified_snapshot_json: JSON.stringify({ a: 1 }) })).toBe(true);
    expect(hasRestorableSnapshot({ verified_snapshot_json: '{}' })).toBe(false);
    expect(hasRestorableSnapshot({ verified_snapshot_json: null })).toBe(false);
    expect(hasRestorableSnapshot({ verified_snapshot_json: '{rusak' })).toBe(false);
  });
});
