import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  WCAG_AA_LARGE_TEXT,
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
  extractBlock,
  flatten,
  meetsAa,
  parseColor,
  parseCssVariables,
  relativeLuminance,
  resolveVariable,
  type Rgb,
} from '@/lib/contrast';

/**
 * `A11Y-08` / `UX-09` — contrast audit for both themes.
 *
 * The tokens are read from the real `globals.css`, so changing a colour to
 * something pretty but unreadable fails here instead of shipping. Pairs are
 * limited to combinations the UI actually renders; auditing every combination
 * would flag decorative borders that WCAG explicitly exempts.
 *
 * The audit found five failing pairs in the light theme when it was written:
 * body-muted text, all three status texts, and orange-as-text (2.80:1).
 */

const css = readFileSync(resolve(__dirname, '../../src/app/globals.css'), 'utf8');

function themeVariables(selector: string): Map<string, string> {
  const block = extractBlock(css, selector);
  expect(block.length, `Blok ${selector} tidak ditemukan di globals.css`).toBeGreaterThan(0);
  return parseCssVariables(block);
}

const darkVars = themeVariables(':root');
const lightVars = themeVariables('[data-theme="light"]');

function colorOf(name: string, vars: Map<string, string>): Rgb {
  const raw = resolveVariable(name, vars);
  const parsed = parseColor(raw);
  expect(parsed, `Token --${name} tidak terdefinisi atau bukan warna (nilai: ${raw})`).not.toBeNull();
  return parsed as Rgb;
}

function ratioOf(fg: string, bg: string, vars: Map<string, string>): number {
  return contrastRatio(colorOf(fg, vars), colorOf(bg, vars));
}

const themes: Array<[string, Map<string, string>]> = [
  ['gelap', darkVars],
  ['terang', lightVars],
];

describe('palet tema', () => {
  it.each(themes)('tema %s mendefinisikan setiap token alias', (_name, vars) => {
    // `A11Y-01` guarantee, re-asserted: an alias pointing at nothing renders as
    // an empty colour, which is invisible rather than merely wrong.
    const aliases = ['bg-surface', 'blue-primary', 'blue-500', 'blue-soft', 'navy-900', 'navy-800'];
    for (const alias of aliases) {
      expect(resolveVariable(alias, vars), `--${alias}`).toBeTruthy();
    }
  });

  it.each(themes)('tema %s mendefinisikan aksen teks terpisah dari aksen isian', (_name, vars) => {
    // A single token cannot serve both roles: `--accent-blue` is a filled-surface
    // colour, `--accent-blue-text` is for glyphs. Keeping them separate is what
    // lets both pass AA at the same time.
    expect(resolveVariable('accent-blue-text', vars)).toBeTruthy();
    expect(resolveVariable('accent-orange-text', vars)).toBeTruthy();
  });
});

describe('kontras teks utama (AA 4.5:1)', () => {
  const bodyPairs: Array<[string, string]> = [
    ['text-main', 'bg-app'],
    ['text-main', 'bg-card'],
    ['text-main', 'bg-inner'],
    ['text-title', 'bg-card'],
    ['text-secondary', 'bg-app'],
    ['text-secondary', 'bg-card'],
    ['text-muted', 'bg-app'],
    ['text-muted', 'bg-card'],
    ['text-muted', 'bg-inner'],
  ];

  for (const [themeName, vars] of themes) {
    for (const [fg, bg] of bodyPairs) {
      it(`tema ${themeName}: ${fg} di atas ${bg} ≥ 4.5:1`, () => {
        const ratio = ratioOf(fg, bg, vars);
        expect(
          meetsAa(ratio, 'normal'),
          `${fg} di atas ${bg} hanya ${ratio}:1 (minimum ${WCAG_AA_NORMAL_TEXT})`
        ).toBe(true);
      });
    }
  }
});

describe('kontras teks status pada latar tint-nya (AA 4.5:1)', () => {
  const statusPairs: Array<[string, string]> = [
    ['status-good-text', 'status-good-bg'],
    ['status-alert-text', 'status-alert-bg'],
    ['status-danger-text', 'status-danger-bg'],
  ];

  for (const [themeName, vars] of themes) {
    for (const [fg, bg] of statusPairs) {
      it(`tema ${themeName}: ${fg} di atas ${bg} ≥ 4.5:1`, () => {
        const ratio = ratioOf(fg, bg, vars);
        expect(
          meetsAa(ratio, 'normal'),
          `${fg} di atas ${bg} hanya ${ratio}:1 (minimum ${WCAG_AA_NORMAL_TEXT})`
        ).toBe(true);
      });
    }
  }
});

describe('kontras aksen', () => {
  for (const [themeName, vars] of themes) {
    it(`tema ${themeName}: aksen teks aman dipakai pada kartu`, () => {
      for (const token of ['accent-blue-text', 'accent-orange-text', 'accent-cyan']) {
        const ratio = ratioOf(token, 'bg-card', vars);
        expect(meetsAa(ratio, 'normal'), `${token} hanya ${ratio}:1`).toBe(true);
      }
    });

    it(`tema ${themeName}: label putih pada tombol berisi tetap terbaca`, () => {
      const white = parseColor('#ffffff') as Rgb;
      // `accent-blue` and `accent-orange-fill` are the two tokens used as filled
      // button backgrounds. Both must carry a white label at AA or higher.
      for (const token of ['accent-blue', 'accent-orange-fill']) {
        const ratio = contrastRatio(white, colorOf(token, vars));
        expect(meetsAa(ratio, 'normal'), `putih di atas ${token} hanya ${ratio}:1`).toBe(true);
      }
    });

    it(`tema ${themeName}: token aksen yang dipakai sebagai teks memenuhi AA`, () => {
      // `--accent-orange` is sprinkled through the UI as a text/icon colour
      // (`LoginScreen` banner, `Calendar` glyphs), so it needs text-grade contrast
      // even though the filled variant has its own token.
      for (const token of ['accent-orange']) {
        const ratio = ratioOf(token, 'bg-card', vars);
        expect(meetsAa(ratio, 'normal'), `${token} hanya ${ratio}:1`).toBe(true);
      }
    });

    it(`tema ${themeName}: cincin fokus terlihat di atas latar aplikasi`, () => {
      const ratio = ratioOf('border-focus', 'bg-app', vars);
      // `A11Y-05` added a visible focus ring; a ring that blends into the page
      // defeats the purpose. Non-text threshold applies.
      expect(meetsAa(ratio, 'non-text'), `border-focus hanya ${ratio}:1`).toBe(true);
    });
  }
});

describe('aritmetika kontras', () => {
  it('hitam di atas putih adalah 21:1', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(21);
  });

  it('warna yang sama selalu 1:1 dan tidak bergantung urutan', () => {
    const grey = { r: 120, g: 120, b: 120 };
    expect(contrastRatio(grey, grey)).toBe(1);
    expect(contrastRatio(grey, { r: 255, g: 255, b: 255 })).toBe(
      contrastRatio({ r: 255, g: 255, b: 255 }, grey)
    );
  });

  it('luminans relatif monoton naik terhadap kecerahan', () => {
    const luminances = [0, 64, 128, 192, 255].map((v) => relativeLuminance({ r: v, g: v, b: v }));
    for (let i = 1; i < luminances.length; i++) {
      expect(luminances[i]).toBeGreaterThan(luminances[i - 1]);
    }
  });

  it('mem-parsing hex 3, 6, dan 8 digit sama-sama', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#ffffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseColor('#0e1b2e')).toEqual({ r: 14, g: 27, b: 46 });
  });

  it('mem-parsing rgb() dan rgba()', () => {
    expect(parseColor('rgb(14, 27, 46)')).toEqual({ r: 14, g: 27, b: 46 });
    expect(parseColor('rgba(14, 27, 46, 0.5)')).toEqual({ r: 14, g: 27, b: 46 });
    expect(parseColor('rgb(14 27 46)')).toEqual({ r: 14, g: 27, b: 46 });
  });

  it('menolak nilai yang bukan warna', () => {
    for (const value of ['', 'transparent', 'var(--x)', '#12345', 'rgb(a, b, c)']) {
      expect(parseColor(value), value).toBeNull();
    }
  });

  it('mengurai alias var() secara rekursif dan berhenti pada siklus', () => {
    const vars = parseCssVariables('--a: var(--b); --b: var(--c); --c: #010203; --loop: var(--loop);');
    expect(resolveVariable('a', vars)).toBe('#010203');
    expect(resolveVariable('loop', vars)).toBeNull();
    expect(resolveVariable('tidak-ada', vars)).toBeNull();
  });

  it('menggabungkan warna transparan ke latar opak', () => {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    // Alpha 0 = latar sepenuhnya, alpha 1 = warna depan sepenuhnya.
    expect(flatten(black, 0, white)).toEqual(white);
    expect(flatten(black, 1, white)).toEqual(black);
    expect(flatten(black, 0.5, white)).toEqual({ r: 128, g: 128, b: 128 });
  });

  it('menerapkan ambang AA yang berbeda untuk teks normal, besar, dan non-teks', () => {
    expect(meetsAa(4.5, 'normal')).toBe(true);
    expect(meetsAa(4.49, 'normal')).toBe(false);
    expect(meetsAa(3, 'large')).toBe(true);
    expect(meetsAa(2.99, 'large')).toBe(false);
    expect(meetsAa(WCAG_AA_NON_TEXT, 'non-text')).toBe(true);
    expect(WCAG_AA_LARGE_TEXT).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it('mengambil hanya isi blok selektor yang diminta', () => {
    const block = extractBlock('[data-theme="light"]', 'x');
    expect(block).toBe('');
    const dark = extractBlock(css, ':root');
    expect(dark).not.toContain('[data-theme');
    expect(dark).toContain('--bg-app');
  });
});
