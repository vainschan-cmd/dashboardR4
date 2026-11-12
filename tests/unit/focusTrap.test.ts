import { describe, it, expect } from 'vitest';
import { FOCUSABLE_SELECTOR, filterFocusable, nextFocusIndex } from '@/hooks/useFocusTrap';

/**
 * `A11Y-04` — focus containment.
 *
 * The DOM wiring is exercised manually in the browser; the decisions that are
 * easy to get wrong (which elements are reachable, and what happens at the edges)
 * are pure functions and are pinned here.
 */

describe('filterFocusable', () => {
  it('membuang elemen yang tidak dapat menerima fokus', () => {
    const candidates = [
      { id: 'ok' },
      { id: 'disabled', disabled: true },
      { id: 'hidden', hidden: true },
      { id: 'negatif', tabIndex: -1 },
    ];
    expect(filterFocusable(candidates).map((c) => c.id)).toEqual(['ok']);
  });

  it('mempertahankan elemen dengan tabIndex nol atau positif', () => {
    const candidates = [{ id: 'nol', tabIndex: 0 }, { id: 'dua', tabIndex: 2 }];
    expect(filterFocusable(candidates)).toHaveLength(2);
  });

  it('mengembalikan array kosong bila tidak ada yang dapat difokuskan', () => {
    expect(filterFocusable([])).toEqual([]);
    expect(filterFocusable([{ disabled: true }])).toEqual([]);
  });
});

describe('nextFocusIndex', () => {
  it('maju berurutan lalu berputar ke awal', () => {
    expect(nextFocusIndex(0, 3, true)).toBe(1);
    expect(nextFocusIndex(1, 3, true)).toBe(2);
    expect(nextFocusIndex(2, 3, true)).toBe(0);
  });

  it('mundur berurutan lalu berputar ke akhir', () => {
    expect(nextFocusIndex(2, 3, false)).toBe(1);
    expect(nextFocusIndex(0, 3, false)).toBe(2);
  });

  it('memasuki daftar dari luar: maju ke awal, mundur ke akhir', () => {
    // -1 = fokus ada pada kontainer dialog, bukan pada salah satu item.
    expect(nextFocusIndex(-1, 4, true)).toBe(0);
    expect(nextFocusIndex(-1, 4, false)).toBe(3);
  });

  it('menangani daftar satu item dan daftar kosong', () => {
    expect(nextFocusIndex(0, 1, true)).toBe(0);
    expect(nextFocusIndex(0, 1, false)).toBe(0);
    expect(nextFocusIndex(0, 0, true)).toBe(-1);
    expect(nextFocusIndex(-1, 0, false)).toBe(-1);
  });
});

describe('FOCUSABLE_SELECTOR', () => {
  it('mengecualikan kontrol nonaktif dan input tersembunyi', () => {
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('input:not([disabled]):not([type="hidden"])');
    expect(FOCUSABLE_SELECTOR).toContain('a[href]');
  });

  it('mengecualikan elemen dengan tabindex negatif kecuali dinyatakan lain', () => {
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });

  it('tidak mengandung elemen non-interaktif seperti div polos', () => {
    expect(FOCUSABLE_SELECTOR).not.toMatch(/(^|,)div(\[|,|$)/);
  });
});
