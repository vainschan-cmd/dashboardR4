import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Credentials must never be able to reach the URL bar.
 *
 * Found by driving the real login page: submitting before React had hydrated
 * performed a NATIVE submit of the `<form>`, and because the form declared no
 * `method` the browser defaulted to GET. The result was
 *
 *     /?nipp=10002&password=Uji-…
 *
 * in the address bar, in the browser history, and in the server access log —
 * a plaintext password written to three places by a single slow first paint.
 *
 * `event.preventDefault()` cannot help, because it does not exist yet. The only
 * reliable fixes are the two asserted here: name the fields nothing, so a native
 * submit has nothing to serialise, and declare `method="post"` so a future named
 * field still never lands in the query string.
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

/** `<form …>` opening tags in a file. */
function formTags(source: string): string[] {
  return [...source.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]);
}

/** Every `<input>`/`<select>`/`<textarea>` opening tag in a file. */
function fieldTags(source: string): string[] {
  return [...source.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)].map((m) => m[0]);
}

const SENSITIVE = /password|passwd|sandi|token|secret|pin/i;
const FORM_FILES = walk(SRC).filter((file) => readFileSync(file, 'utf8').includes('<form'));

describe('formulir tidak membocorkan kredensial ke URL', () => {
  it('menemukan formulir untuk diperiksa (kontrol positif)', () => {
    expect(FORM_FILES.length).toBeGreaterThanOrEqual(3);
  });

  it('tidak ada field sensitif yang punya atribut name', () => {
    const offenders: string[] = [];
    for (const file of FORM_FILES) {
      for (const tag of fieldTags(readFileSync(file, 'utf8'))) {
        if (!SENSITIVE.test(tag)) continue;
        if (/\bname=/.test(tag)) {
          offenders.push(`${file.replace(SRC, 'src')}: ${tag.replace(/\s+/g, ' ').slice(0, 70)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('setiap formulir memakai method="post"', () => {
    // GET is the default, and the default is what put the password in the URL.
    for (const file of FORM_FILES) {
      for (const tag of formTags(readFileSync(file, 'utf8'))) {
        expect(tag, `${file.replace(SRC, 'src')}: ${tag.replace(/\s+/g, ' ').slice(0, 70)}`).toMatch(
          /method=("post"|'post'|\{["']post["']\})/
        );
      }
    }
  });
});
