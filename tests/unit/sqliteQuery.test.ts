import { describe, it, expect } from 'vitest';
import { adaptPostgresSql } from '@/lib/db/sqliteQuery';

/**
 * Tests for the PostgreSQL → SQLite translation layer.
 *
 * This translation is the highest-risk part of the merge: a filter that stops
 * filtering still returns rows, so a bug here produces plausible-but-wrong
 * executive figures rather than an error. The cases below are the exact shapes
 * the ported aggregation services use.
 *
 * The parameter-order assertion is the important one — the first implementation
 * translated construct-by-construct in separate passes, which pushed parameters
 * in *pass* order instead of *textual* order and silently bound `year` to the
 * array guard.
 */

describe('adaptPostgresSql', () => {
  it('mengubah $n menjadi ? dan mengulang nilai per kemunculan', () => {
    const { sql, params } = adaptPostgresSql('SELECT * FROM t WHERE a = $1 AND b = $1 AND c = $2', [
      'x',
      7,
    ]);
    expect(sql).toBe('SELECT * FROM t WHERE a = ? AND b = ? AND c = ?');
    expect(params).toEqual(['x', 'x', 7]);
  });

  it('menjaga URUTAN PARAMETER sesuai urutan tekstual SQL', () => {
    // The regression this guards: parameters pushed in pass-order produced
    // `["Makassar", 1, 2026, 0]` against an SQL expecting `[2026, 0, 1, …]`.
    const text = `WHERE year = $2::int
        AND ($1::boolean = false OR verification_status = 'verified')
        AND ($4::text[] IS NULL OR branch_name = ANY($4::text[]))`;
    const { sql, params } = adaptPostgresSql(text, [false, 2026, 8, ['Makassar', 'Bitung']]);

    expect(sql).toContain('year = ?');
    expect(sql).toContain('? = false');
    expect(sql).toContain('? IS NULL');
    expect(sql).toContain('branch_name IN (?,?)');
    // Textual order: year, verifiedOnly, array-guard sentinel, then the two names.
    expect(params).toEqual([2026, 0, 1, 'Makassar', 'Bitung']);
  });

  it('mengubah boolean menjadi 0/1 karena node:sqlite menolak boolean', () => {
    const { params } = adaptPostgresSql('SELECT 1 WHERE $1::boolean = true', [true]);
    expect(params).toEqual([1]);
    expect(typeof params[0]).toBe('number');
  });

  it('mengubah array kosong menjadi IN (NULL) yang tidak pernah cocok', () => {
    const { sql, params } = adaptPostgresSql(
      'SELECT 1 WHERE ($1::text[] IS NULL OR x = ANY($1::text[]))',
      [[]]
    );
    expect(sql).toContain('IN (NULL)');
    expect(params).toEqual([1]);
  });

  it('array NULL membuat guard IS NULL bernilai benar', () => {
    const { params } = adaptPostgresSql('SELECT 1 WHERE ($1::text[] IS NULL OR x = ANY($1::text[]))', [
      null,
    ]);
    expect(params[0]).toBeNull();
  });

  it('mengubah x->>key menjadi json_extract', () => {
    const { sql } = adaptPostgresSql(
      `SELECT COALESCE(NULLIF(verified_snapshot_json->>'realisasi','')::double precision, realisasi) FROM t`,
      []
    );
    expect(sql).toContain("json_extract(verified_snapshot_json, '$.realisasi')");
    expect(sql).not.toContain('->>');
    expect(sql).not.toContain('::double precision');
  });

  it('membuang seluruh cast ::type', () => {
    const { sql } = adaptPostgresSql(
      'SELECT COUNT(*)::int AS c, SUM(x)::double precision AS s, name::text AS n FROM t',
      []
    );
    expect(sql).toBe('SELECT COUNT(*) AS c, SUM(x) AS s, name AS n FROM t');
  });

  it('melempar galat bila parameter kurang (bukan diam-diam menggeser)', () => {
    expect(() => adaptPostgresSql('SELECT $3', [1, 2])).toThrow(/Parameter \$3/);
  });

  it('mempertahankan FILTER (WHERE …) yang didukung SQLite 3.30+', () => {
    const { sql } = adaptPostgresSql(
      'SELECT SUM(x) FILTER (WHERE year = $1)::double precision AS v FROM t',
      [2026]
    );
    expect(sql).toContain('FILTER (WHERE year = ?)');
  });

  it('mengubah ILIKE menjadi LIKE', () => {
    // SQLite's LIKE is case-insensitive for ASCII, so the PostgreSQL-only
    // operator has an exact equivalent; leaving it would be a syntax error.
    const { sql } = adaptPostgresSql("SELECT 1 FROM t WHERE rekening ILIKE '%beban%'", []);
    expect(sql).toContain("rekening LIKE '%beban%'");
    expect(sql.toUpperCase()).not.toContain('ILIKE');
  });

  it('tidak menyentuh SQL yang sudah murni SQLite', () => {
    const plain = 'SELECT branch_code, COUNT(*) AS c FROM module_finansial GROUP BY branch_code';
    const { sql, params } = adaptPostgresSql(plain, []);
    expect(sql).toBe(plain);
    expect(params).toEqual([]);
  });
});
