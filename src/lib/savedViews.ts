/**
 * Saved Views & Filter Presets (UX-07).
 */

export interface SavedView {
  id: string;
  name: string;
  tab: string;
  branch: string;
  period: string;
}

export const DEFAULT_SAVED_VIEWS: readonly SavedView[] = [
  { id: 'view_konsolidasi', name: 'Konsolidasi Regional (Semua Cabang)', tab: 'beranda', branch: 'ALL', period: 'YTD Sep 2026' },
  { id: 'view_makassar', name: 'Cabang Utama Makassar', tab: 'beranda', branch: 'R01', period: 'YTD Sep 2026' },
  { id: 'view_keuangan', name: 'Kinerja Finansial Regional', tab: 'keuangan', branch: 'ALL', period: 'YTD Sep 2026' },
];

export function addSavedView(views: readonly SavedView[], view: Omit<SavedView, 'id'>): SavedView[] {
  const name = view.name.trim();
  if (!name) return [...views];

  const id = `view_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return [...views, { ...view, id, name }];
}

export function deleteSavedView(views: readonly SavedView[], id: string): SavedView[] {
  return views.filter((v) => v.id !== id);
}

export function findSavedView(views: readonly SavedView[], id: string): SavedView | undefined {
  return views.find((v) => v.id === id);
}

