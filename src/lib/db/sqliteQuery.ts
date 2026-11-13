import type { QueryResultRow } from 'pg';
import { query as pgQuery } from './connection';

const PG_TOKEN =
  /(?:=\s*)?ANY\(\s*\$(\d+)::[a-z_]+\[\]\s*\)|\$(\d+)::[a-z_]+\[\]|([a-z_][a-z0-9_.]*)\s*->>\s*'([A-Za-z0-9_]+)'|\$(\d+)(?:::(?:double\s+precision|[a-z_]+)(?:\[\])?)?/g;

type Bindable = null | number | bigint | string | Uint8Array;

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

export function adaptPostgresSql(text: string, params: readonly unknown[] = []): AdaptedSql {
  const out: Bindable[] = [];

  const paramAt = (index: number): unknown => {
    if (index < 1 || index > params.length) {
      throw new Error(`Parameter $${index} tidak diberikan (ada ${params.length} parameter)`);
    }
    return params[index - 1];
  };

  let sql = text.replace(
    PG_TOKEN,
    (
      _match: string,
      anyIndex?: string,
      arrayIndex?: string,
      jsonColumn?: string,
      jsonKey?: string,
      scalarIndex?: string
    ) => {
      if (anyIndex) {
        const raw = paramAt(Number(anyIndex));
        const values = (Array.isArray(raw) ? raw : []).map(toBindable);
        if (values.length === 0) return 'IN (NULL)';
        out.push(...values);
        return `IN (${values.map(() => '?').join(',')})`;
      }

      if (arrayIndex) {
        const raw = paramAt(Number(arrayIndex));
        out.push(raw === null || raw === undefined ? null : 1);
        return '?';
      }

      if (jsonColumn) {
        return `json_extract(${jsonColumn}, '$.${jsonKey}')`;
      }

      out.push(toBindable(paramAt(Number(scalarIndex))));
      return '?';
    }
  );

  sql = sql.replace(
    /::\s*(?:double precision|numeric|integer|int|bigint|text|varchar|boolean|date|timestamp)\b/gi,
    ''
  );

  sql = sql.replace(/\bILIKE\b/gi, 'LIKE');

  return { sql, params: out };
}

export interface AdaptedResult<T> {
  rows: T[];
}

/**
 * Eksekusi query langsung ke database PostgreSQL ed_dashboard.
 * Jika koneksi PostgreSQL terputus/mati, fungsi ini langsung melempar exception (FAIL-CLOSED)
 * dan TIDAK PERNAH jatuh ke fallback SQLite ataupun dummy data.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<AdaptedResult<T>> {
  const res = await pgQuery<T>(text, params);
  return { rows: res.rows };
}
