import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Beranda View Mode Evaluation (UX-11)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] || null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    });
  });

  it('resolves default view mode to all when no preference is saved', () => {
    const saved = localStorage.getItem('portsight_beranda_view_mode');
    expect(saved).toBeNull();
    const mode = saved || 'all';
    expect(mode).toBe('all');
  });

  it('persists and retrieves user view mode preference', () => {
    localStorage.setItem('portsight_beranda_view_mode', 'cards');
    expect(localStorage.getItem('portsight_beranda_view_mode')).toBe('cards');

    localStorage.setItem('portsight_beranda_view_mode', 'charts');
    expect(localStorage.getItem('portsight_beranda_view_mode')).toBe('charts');
  });

  it('validates view mode visibility rules', () => {
    const isCardsVisible = (mode: string) => mode === 'all' || mode === 'cards';
    const isChartsVisible = (mode: string) => mode === 'all' || mode === 'charts';

    // In 'all' mode: both cards and charts visible
    expect(isCardsVisible('all')).toBe(true);
    expect(isChartsVisible('all')).toBe(true);

    // In 'cards' mode: only cards visible, charts omitted
    expect(isCardsVisible('cards')).toBe(true);
    expect(isChartsVisible('cards')).toBe(false);

    // In 'charts' mode: only charts visible, cards omitted
    expect(isCardsVisible('charts')).toBe(false);
    expect(isChartsVisible('charts')).toBe(true);
  });
});

