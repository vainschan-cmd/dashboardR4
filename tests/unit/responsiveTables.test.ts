import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `UX-05` — data tables must degrade to cards on a narrow screen.
 *
 * At 390 px an eight-column table cannot be read: the reader swipes
 * horizontally, loses the header after the first swipe, and can no longer tell
 * which column a number belongs to. The fix is `card-table`, which stacks each
 * row and prints the column name in front of every cell using `data-label`.
 *
 * A cell without `data-label` silently loses its caption, which is worse than
 * the horizontal scroll it replaced — the number is still on screen but no
 * longer attributable. So the attribute is enforced here rather than left to
 * review, and the empty-state row (the one `colSpan` cell) is the only allowed
 * exception.
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
    if (/\.tsx$/.test(entry)) out.push(file);
  }
  return out;
}

/** Every `<table>…</table>` block in a file. */
function tableBlocks(source: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = source.indexOf('<table', cursor);
    if (start === -1) break;
    const end = source.indexOf('</table>', start);
    if (end === -1) break;
    blocks.push(source.slice(start, end + '</table>'.length));
    cursor = end + '</table>'.length;
  }
  return blocks;
}

/** `<td>` openings that render a value (i.e. not the colSpan empty state). */
function dataCells(block: string): string[] {
  return block
    .split('<td')
    .slice(1)
    .map((chunk) => `<td${chunk.slice(0, 200)}`)
    .filter((opening) => !opening.includes('colSpan'));
}

const TABLE_FILES = walk(SRC).filter((file) => readFileSync(file, 'utf8').includes('<table'));

describe('tabel responsif (UX-05)', () => {
  it('menemukan tabel untuk diperiksa (kontrol positif)', () => {
    // A filter that matches nothing would make every assertion below vacuous.
    expect(TABLE_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('setiap tabel data memakai kelas card-table', () => {
    for (const file of TABLE_FILES) {
      const source = readFileSync(file, 'utf8');
      const withoutClass = tableBlocks(source).filter(
        (block) => !/^<table[^>]*className="[^"]*card-table/.test(block) && !/^<table[^>]*className=\{[^}]*card-table/.test(block)
      );
      expect(withoutClass, `${file.replace(SRC, 'src')} punya tabel tanpa card-table`).toEqual([]);
    }
  });

  it('setiap sel data punya data-label', () => {
    const offenders: string[] = [];
    for (const file of TABLE_FILES) {
      for (const block of tableBlocks(readFileSync(file, 'utf8'))) {
        for (const cell of dataCells(block)) {
          if (!cell.includes('data-label')) {
            offenders.push(`${file.replace(SRC, 'src')}: ${cell.slice(0, 60).replace(/\s+/g, ' ')}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('aturan card-mode ada dan hanya berlaku di layar sempit', () => {
    const css = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    expect(css).toContain('.card-table td::before');
    expect(css).toContain('content: attr(data-label)');
    // The rule must sit inside a max-width query, not apply on desktop.
    const mediaIndex = css.indexOf('@media (max-width: 720px)', css.indexOf('.card-table'));
    expect(mediaIndex, 'card-mode harus dibungkus @media (max-width: 720px)').toBeGreaterThan(-1);
  });
});
