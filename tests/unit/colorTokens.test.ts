import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `CODE-06` — text colour comes from a theme token, never from a literal.
 *
 * The bug this prevents is not "a hex value looks ugly". It is that a literal
 * freezes one theme: `color: '#ffffff'` is invisible on the light card and
 * perfectly fine on the dark one, so the defect only shows up when someone
 * switches modes — or when a reader who needs contrast is the first to try.
 * Measured before the migration: 90 of 120 sampled table cells failed WCAG AA,
 * the worst at 1.00:1 (white on white).
 *
 * Chart series colours (`fill=`, `stroke=`) are exempt: a bar is a 2 px shape,
 * not text, and it is allowed to be paler than text ever is. The palette objects
 * are therefore excluded by matching only `color:` declarations.
 */

const SRC = resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const file = join(dir, entry);
    if (statSync(file).isDirectory()) {
      out.push(...walk(file));
      continue;
    }
    if (/\.(tsx?|css)$/.test(entry)) out.push(file);
  }
  return out;
}

/** `color: '#rrggbb'` — a literal text colour in a JSX style or a CSS rule. */
const LITERAL_TEXT_COLOR = /(?<![-\w])color:\s*'(#[0-9a-fA-F]{3,8})'/g;

/** Standalone error pages render without the stylesheet, so they keep literals. */
const STANDALONE_PAGES = ['src/app/global-error.tsx', 'src/app/error.tsx', 'src/app/not-found.tsx'];

describe('warna teks bertoken (CODE-06)', () => {
  it('tidak ada warna teks literal di dalam komponen', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const relative = file.replace(SRC, 'src');
      if (STANDALONE_PAGES.includes(relative)) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(LITERAL_TEXT_COLOR)) {
        offenders.push(`${relative}: color: '${match[1]}'`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('setiap token yang dipakai benar-benar didefinisikan', () => {
    // A typo in `var(--text-on-dark)` resolves to nothing and the browser falls
    // back to the inherited colour — silent, and invisible in review. This found
    // a live one: `--status-warning-text` was referenced but never declared.
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map((m) => m[1]));
    // `next/font` injects these as a class on <html>; they are real but not in CSS.
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    for (const match of layout.matchAll(/variable:\s*['"](--[a-z0-9-]+)['"]/gi)) defined.add(match[1]);

    const used = new Set<string>();
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/var\((--[a-z0-9-]+)/gi)) {
        // `var(--x)` inside a doc comment is an illustrative placeholder.
        if (match[1].length > 3) used.add(match[1]);
      }
    }
    const missing = [...used].filter((token) => !defined.has(token));
    expect(missing).toEqual([]);
  });

  it('token "on-dark" tidak berubah antar tema', () => {
    // The navy BOPO card stays dark in both themes; if these flipped with the
    // theme the card would print #334155 on #0f172a again (1.72:1).
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    const values = [...css.matchAll(/--text-on-dark:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(new Set(values).size, 'nilai --text-on-dark harus sama di kedua tema').toBe(1);
  });

  it('legenda grafik tidak mewarisi warna seri', () => {
    // Recharts paints the legend caption in the series colour; the gold "PSL"
    // series then sat at 1.53:1 on the light card.
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/\.recharts-legend-item-text\s*\{[^}]*color:\s*var\(--text-secondary\)/);
  });
});
