import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SAVED_VIEWS,
  addSavedView,
  deleteSavedView,
  findSavedView,
} from '@/lib/savedViews';

describe('Saved Views & Filter Consolidation (UX-07)', () => {
  it('provides sensible default saved views presets for BOD and regional', () => {
    expect(DEFAULT_SAVED_VIEWS.length).toBeGreaterThan(0);
    expect(DEFAULT_SAVED_VIEWS[0].name).toContain('Konsolidasi Regional');
  });

  it('adds a new saved view properly and ignores empty names', () => {
    const initial = [...DEFAULT_SAVED_VIEWS];
    const withNew = addSavedView(initial, {
      name: 'Cabang Bitung Pantau',
      tab: 'beranda',
      branch: 'R04',
      period: 'YTD Sep 2026',
    });

    expect(withNew.length).toBe(initial.length + 1);
    const created = withNew[withNew.length - 1];
    expect(created.name).toBe('Cabang Bitung Pantau');
    expect(created.branch).toBe('R04');

    // Empty name should not add
    const unchanged = addSavedView(withNew, {
      name: '   ',
      tab: 'beranda',
      branch: 'R01',
      period: '2026',
    });
    expect(unchanged.length).toBe(withNew.length);
  });

  it('deletes a saved view by id', () => {
    const initial = [...DEFAULT_SAVED_VIEWS];
    const target = initial[0];
    const afterDelete = deleteSavedView(initial, target.id);

    expect(afterDelete.length).toBe(initial.length - 1);
    expect(afterDelete.find((v) => v.id === target.id)).toBeUndefined();
  });

  it('finds a saved view by id', () => {
    const found = findSavedView(DEFAULT_SAVED_VIEWS, 'view_makassar');
    expect(found).toBeDefined();
    expect(found?.branch).toBe('R01');

    const notFound = findSavedView(DEFAULT_SAVED_VIEWS, 'non_existent');
    expect(notFound).toBeUndefined();
  });
});
