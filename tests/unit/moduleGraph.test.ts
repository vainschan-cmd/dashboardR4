import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `CODE-04` — the module graph must not contain an import cycle between
 * `db.ts` and `userPicSync.ts`.
 *
 * The cycle was invisible: both files read each other's exports lazily, so it
 * only bit when an initialiser ran in the wrong order, and the failure surfaced
 * as `undefined` somewhere unrelated. Rather than trust a comment, this test
 * builds the static import graph of `src/lib` and asserts it is acyclic, and
 * specifically that the two modules no longer import each other.
 */

const LIB_DIR = resolve(__dirname, '../../src/lib');

/** Static `import ... from '…'` plus `export ... from '…'` specifiers. */
function staticImportsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"`;]*?\bfrom\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveLocal(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(fromFile, '..', specifier);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // keep trying
    }
  }
  return null;
}

function buildGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  // Recursive: `CODE-03` moved most of `db.ts` into `db/` and `repositories/`,
  // so a shallow scan would have stopped guarding the files that now matter.
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const file = join(dir, entry);
      if (statSync(file).isDirectory()) {
        walk(file);
        continue;
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) continue;
      const edges = staticImportsOf(file)
        .map((specifier) => resolveLocal(specifier, file))
        .filter((target): target is string => target !== null);
      graph.set(file, edges);
    }
  };
  walk(LIB_DIR);
  return graph;
}

/** Depth-first search that reports the first cycle it finds, if any. */
function findCycle(graph: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string): string[] | null => {
    const current = state.get(node);
    if (current === 'done') return null;
    if (current === 'visiting') {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

describe('graf modul src/lib', () => {
  it('tidak mengandung impor melingkar', () => {
    const cycle = findCycle(buildGraph());
    const readable = cycle?.map((file) => file.replace(LIB_DIR, 'src/lib')).join(' → ');
    expect(cycle, `Siklus impor ditemukan: ${readable}`).toBeNull();
  });

  it('db.ts tidak mengimpor userPicSync.ts secara statis', () => {
    const db = join(LIB_DIR, 'db.ts');
    const targets = staticImportsOf(db).filter((specifier) => specifier.includes('userPicSync'));
    expect(targets, 'db.ts masih mengimpor userPicSync secara statis').toEqual([]);
  });

  it('db/maintenance.ts tetap memuat userPicSync secara dinamis untuk mirror spreadsheet', () => {
    // The mirror file still has to be written; only the static edge is gone.
    // `CODE-03` moved the sync scheduler out of `db.ts` into `db/maintenance.ts`.
    const source = readFileSync(join(LIB_DIR, 'db', 'maintenance.ts'), 'utf8');
    expect(source).toContain("import('../userPicSync')");
  });

  it('db.ts hanyalah facade: tidak lagi memuat skema atau kueri', () => {
    // Proves the split is real rather than a copy: the old file held
    // `CREATE TABLE`, `initSchema`, and every query. None may remain here.
    const source = readFileSync(join(LIB_DIR, 'db.ts'), 'utf8');
    expect(source).not.toContain('CREATE TABLE');
    expect(source).not.toContain('function initSchema');
    expect(source).not.toContain('DatabaseSync');
    expect(source.split('\n').length).toBeLessThan(140);
  });

  it('data seed pengguna tidak bergantung pada basis data', () => {
    const seed = join(LIB_DIR, 'userSeed.ts');
    const targets = staticImportsOf(seed).map((specifier) => specifier.replace('./', ''));
    // Types only: importing `db` here would recreate the cycle through the back door.
    expect(targets).toEqual(['types']);
  });

  it('menemukan siklus pada graf buatan (kontrol negatif)', () => {
    // Guards the detector itself: a test that can only pass proves nothing.
    const cycle = findCycle(
      new Map([
        ['/a.ts', ['/b.ts']],
        ['/b.ts', ['/a.ts']],
      ])
    );
    expect(cycle).toEqual(['/a.ts', '/b.ts', '/a.ts']);
  });

  it('graf tanpa siklus dilaporkan bersih (kontrol negatif)', () => {
    const cycle = findCycle(
      new Map([
        ['/a.ts', ['/b.ts']],
        ['/b.ts', []],
      ])
    );
    expect(cycle).toBeNull();
  });
});
