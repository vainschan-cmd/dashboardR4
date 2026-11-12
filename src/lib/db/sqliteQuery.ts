import { getDb } from './connection';

/**
 * Adapter for SQL written against PostgreSQL.
 *
 * Two aggregation services (`berandaSummaryService`, `finansialConsolidationService`)
 * arrived with the UI overhaul and were authored for the PostgreSQL branch:
 * positional `$1` placeholders, `ANY($n::text[])` array filters, `x->>'key'` JSON
 * access, and `::type` casts. This project's source of truth is SQLite, and
 * re-writing ~1,000 lines of proven aggregation SQL by hand would be a bigger
 * risk than translating four well-understood constructs.
 *
 * So: translate at call time, in one place, with tests. New code should NOT use
 * this — write plain `?` against `getDb()` as everywhere else. This exists so
 * ported SQL runs unchanged and stays diffable against its origin.
 *
 * Supported translations
 * ----------------------
 * 1. `$n` → `?`, repeating the value for every occurrence (PostgreSQL numbers
 *    parameters, SQLite consumes them positionally).
 * 2. `$n::text[]` inside `= ANY(...)` → `IN (?,?,…)` with the array spread out.
 *    PG's `ANY` has no SQLite equivalent; an empty array becomes `IN (NULL)`,
 *    which matches nothing, matching PG semantics.
 * 3. A bare `$n::text[]` (the `IS NULL` half of the usual
 *    `($n::text[] IS NULL OR col = ANY($n::text[]))` guard) → `? IS NULL`, with a
 *    non-null sentinel when the array is present so the guard evaluates false.
 * 4. `x->>'key'` → `json_extract(x, '$.key')`.
 * 5. Remaining `::type` casts are dropped. SQLite is dynamically typed and the
 *    cast was only ever there to make PostgreSQL's planner happy.
 *
 * Value coercion: `node:sqlite` binds only null, number, bigint, string, and
 * Uint8Array. Booleans and `undefined` throw, so both are normalised here — a
 * PostgreSQL boolean `false` becomes `0`, which compares correctly against the
 * 0/1 integers SQLite stores.
 */


/**
 * One left-to-right pass over the SQL.
 *
 * Ordering is not cosmetic. SQLite binds `?` positionally, so the parameter list
 * must follow the order the placeholders appear in the SQL text. Translating
 * construct-by-construct in separate passes pushed them in *pass* order, which
 * silently swapped `year` with the array guard — the query still ran, it just
 * filtered on the wrong values. `String.replace` with a global regex walks the
 * string in order, so one combined pattern is the only correct shape.
 *
 * Alternation order matters too: `ANY($4::text[])` contains `$4::text[]`, so the
 * `ANY(...)` branch has to come first or the array would be bound as one value.
 */
const PG_TOKEN =
  /(?:=\s*)?ANY\(\s*\$(\d+)::[a-z_]+\[\]\s*\)|\$(\d+)::[a-z_]+\[\]|([a-z_][a-z0-9_.]*)\s*->>\s*'([A-Za-z0-9_]+)'|\$(\d+)(?:::(?:double\s+precision|[a-z_]+)(?:\[\])?)?/g;

/** SQLite bindable value. */
type Bindable = null | number | bigint | string | Uint8Array;

/** `node:sqlite` rejects booleans, `undefined`, and objects. */
function toBindable(value: unknown): Bindable {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint' || typeof value === 'string') return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) throw new Error('Array must be expanded by the adapter, not bound');
  return String(value);
}

export interface AdaptedSql {
  sql: string;
  params: Bindable[];
}

/**
 * Translate PostgreSQL-flavoured SQL into SQLite SQL plus a positional param list.
 *
 * Exported for unit testing: the translation is where a silent bug would hurt
 * most (a filter that stops filtering still returns rows).
 */
export function adaptPostgresSql(text: string, params: readonly unknown[] = []): AdaptedSql {
  const out: Bindable[] = [];

  const paramAt = (index: number): unknown => {
    if (index < 1 || index > params.length) {
      throw new Error(`Parameter $${index} tidak diberikan (ada ${params.length} parameter)`);
    }
    return params[index - 1];
  };

  // Single ordered pass: see PG_TOKEN for why the order must be textual.
  let sql = text.replace(
    PG_TOKEN,
    (
      match: string,
      anyIndex?: string,
      arrayIndex?: string,
      jsonColumn?: string,
      jsonKey?: string,
      scalarIndex?: string
    ) => {
      // (2) `ANY($n::text[])` → `IN (?,?,…)`.
      if (anyIndex) {
        const raw = paramAt(Number(anyIndex));
        const values = (Array.isArray(raw) ? raw : []).map(toBindable);
        // An empty array must match nothing, like PostgreSQL; `IN ()` is a syntax
        // error, so bind a literal NULL comparison instead.
        if (values.length === 0) return 'IN (NULL)';
        out.push(...values);
        return `IN (${values.map(() => '?').join(',')})`;
      }

      // (3) Bare `$n::text[]` in an `IS NULL` guard → non-null sentinel when set.
      if (arrayIndex) {
        const raw = paramAt(Number(arrayIndex));
        out.push(raw === null || raw === undefined ? null : 1);
        return '?';
      }

      // (4) `x->>'key'` → `json_extract(x, '$.key')`.
      if (jsonColumn) {
        return `json_extract(${jsonColumn}, '$.${jsonKey}')`;
      }

      // (1) Scalar `$n::type` / `$n` → `?`.
      out.push(toBindable(paramAt(Number(scalarIndex))));
      return '?';
    }
  );

  // (5) Drop leftover casts on identifiers, e.g. `COUNT(*)::int` → `COUNT(*)`.
  sql = sql.replace(
    /::\s*(?:double precision|numeric|integer|int|bigint|text|varchar|boolean|date|timestamp)\b/gi,
    ''
  );

  // (6) `ILIKE` → `LIKE`. SQLite's LIKE is already case-insensitive for ASCII,
  // which is exactly what these search filters need.
  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');

  return { sql, params: out };
}

/** Result envelope identical to the PostgreSQL client's, so ported code reads the same. */
export interface AdaptedResult<T> {
  rows: T[];
}

/** Run PostgreSQL-flavoured SQL against the SQLite database. */
export function query<T = Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = []
): AdaptedResult<T> {
  const adapted = adaptPostgresSql(text, params);
  const rows = getDb()
    .prepare(adapted.sql)
    .all(...adapted.params) as T[];
  return { rows };
}
