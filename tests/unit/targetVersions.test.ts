import { describe, it, expect, vi } from 'vitest';
import {
  createTargetVersion,
  getTargetVersions,
  getActiveTarget,
} from '@/lib/targetVersions';
import * as dbConn from '@/lib/db/connection';

describe('KPI Target Versioning (DATA-06 & FEAT-08)', () => {
  it('creates target version and increments version counter', async () => {
    const mockRows = [
      {
        id: 'tgt_ver_kpi_teus_v1_123',
        indicator_id: 'kpi_teus',
        version: 1,
        target_value: '1050000',
        effective_from: '2026-01-01',
        notes: 'Target awal RKAP 2026',
        created_by: '10002',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ];

    vi.spyOn(dbConn, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) {
        return { rows: [] };
      }
      if (sql.includes('COALESCE(MAX(version)')) {
        return { rows: [{ max_ver: 0 }] };
      }
      if (sql.includes('INSERT INTO kpi_target_versions')) {
        return { rows: mockRows };
      }
      return { rows: [] };
    });

    const res = await createTargetVersion({
      indicator_id: 'kpi_teus',
      target_value: 1050000,
      effective_from: '2026-01-01',
      notes: 'Target awal RKAP 2026',
      created_by: '10002',
    });

    expect(res.version).toBe(1);
    expect(res.target_value).toBe(1050000);
    expect(res.created_by).toBe('10002');
  });

  it('retrieves target versions in descending order', async () => {
    vi.spyOn(dbConn, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('FROM kpi_target_versions') && sql.includes('ORDER BY version DESC')) {
        return {
          rows: [
            {
              id: 'tgt_ver_kpi_teus_v2_456',
              indicator_id: 'kpi_teus',
              version: 2,
              target_value: '1100000',
              effective_from: '2026-07-01',
              notes: 'Revisi RKAP Semester 2',
              created_by: '10002',
              created_at: '2026-07-01T00:00:00.000Z',
            },
            {
              id: 'tgt_ver_kpi_teus_v1_123',
              indicator_id: 'kpi_teus',
              version: 1,
              target_value: '1050000',
              effective_from: '2026-01-01',
              notes: 'Target awal RKAP 2026',
              created_by: '10002',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const list = await getTargetVersions('kpi_teus');
    expect(list.length).toBe(2);
    expect(list[0].version).toBe(2);
    expect(list[1].version).toBe(1);
  });

  it('resolves active target based on effective date', async () => {
    vi.spyOn(dbConn, 'query').mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.includes('WHERE indicator_id = $1 AND effective_from <= $2')) {
        return {
          rows: [
            {
              id: 'tgt_ver_kpi_teus_v1_123',
              indicator_id: 'kpi_teus',
              version: 1,
              target_value: '1050000',
              effective_from: '2026-01-01',
              notes: 'Target awal RKAP 2026',
              created_by: '10002',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      }
      return { rows: [] };
    });

    const active = await getActiveTarget('kpi_teus', '2026-03-15');
    expect(active).not.toBeNull();
    expect(active?.version).toBe(1);
    expect(active?.target_value).toBe(1050000);
  });
});
