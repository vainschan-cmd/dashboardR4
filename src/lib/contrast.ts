/**
 * WCAG 2.1 contrast arithmetic.
 *
 * `A11Y-08` / `UX-09` ask for a contrast audit of both themes. An audit that
 * lives in a spreadsheet goes stale the moment a token changes, so the palettes
 * are parsed straight out of `globals.css` and every text/background pair the
 * UI actually renders is checked by a unit test.
 *
 * Only the maths and the colour parsing live here; `tests/unit/contrast.test.ts`
 * owns the token combinations.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Pull `--token: #hex` / `--token: rgba(...)` declarations out of a CSS block. */
export function parseCssVariables(css: string): Map<string, string> {
  const variables = new Map<string, string>();
  const pattern = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    variables.set(match[1].toLowerCase(), match[2].trim());
  }
  return variables;
}

/**
 * Extract the declaration block of one selector (`:root` or `[data-theme="light"]`).
 * Returns the raw text so it can be fed to `parseCssVariables`.
 */
export function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}

/** Resolve `var(--x)` indirection so aliases like `--bg-surface` are comparable. */
export function resolveVariable(
  name: string,
  variables: Map<string, string>,
  depth = 0
): string | null {
  if (depth > 8) return null;
  const value = variables.get(name.replace(/^--/, '').toLowerCase());
  if (value === undefined) return null;
  const alias = value.match(/^var\(\s*--([a-z0-9-]+)\s*\)$/i);
  if (alias) return resolveVariable(alias[1], variables, depth + 1);
  return value;
}

/** `#0e1b2e`, `#fff`, `rgb(14 27 46)`, `rgba(14, 27, 46, 0.5)` → RGB, or null. */
export function parseColor(input: string | null | undefined): Rgb | null {
  if (!input) return null;
  const value = input.trim().toLowerCase();

  const hex = value.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3) {
      return {
        r: parseInt(digits[0] + digits[0], 16),
        g: parseInt(digits[1] + digits[1], 16),
        b: parseInt(digits[2] + digits[2], 16),
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const channel = (raw: string) =>
      raw.endsWith('%') ? Math.round((parseFloat(raw) / 100) * 255) : parseFloat(raw);
    const [r, g, b] = [channel(parts[0]), channel(parts[1]), channel(parts[2])];
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }

  return null;
}

/** WCAG relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, ordered so it is always ≥ 1. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * WCAG AA thresholds. Normal text needs 4.5:1; large text (≥ 18.66px bold or
 * ≥ 24px) and non-text UI such as borders and icons need 3:1.
 */
export const WCAG_AA_NORMAL_TEXT = 4.5;
export const WCAG_AA_LARGE_TEXT = 3;
export const WCAG_AA_NON_TEXT = 3;

export function meetsAa(ratio: number, kind: 'normal' | 'large' | 'non-text' = 'normal'): boolean {
  const threshold =
    kind === 'normal'
      ? WCAG_AA_NORMAL_TEXT
      : kind === 'large'
        ? WCAG_AA_LARGE_TEXT
        : WCAG_AA_NON_TEXT;
  return ratio >= threshold;
}

/**
 * Composite a translucent foreground (e.g. `rgba(239,68,68,0.12)`) over an opaque
 * background. Needed because several status banners use alpha tints, and the
 * naive ratio against the raw rgba would be meaningless.
 */
export function flatten(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  const mix = (fg: number, bg: number) => Math.round(fg * alpha + bg * (1 - alpha));
  return {
    r: mix(foreground.r, background.r),
    g: mix(foreground.g, background.g),
    b: mix(foreground.b, background.b),
  };
}
