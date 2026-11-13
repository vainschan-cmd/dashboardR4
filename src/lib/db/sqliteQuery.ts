import type { QueryResultRow } from 'pg';
import { query as pgQuery } from './connection';

export interface AdaptedResult<T> {
  rows: T[];
}

export function adaptPostgresSql(sql: string): string {
  return sql;
}

/**
 * Eksekusi query langsung ke database PostgreSQL ed_dashboard.
 * Jika koneksi PostgreSQL terputus/mati, fungsi ini langsung melempar exception (FAIL-CLOSED)
 * dan TIDAK PERNAH jatuh ke fallback SQLite ataupun dummy data.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params: readonly unknown[] = []
): Promise<AdaptedResult<T>> {
  const res = await pgQuery<T>(text, params);
  return { rows: res.rows };
}
