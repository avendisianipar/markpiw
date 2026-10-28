// SPDX-License-Identifier: LicenseRef-Proprietary
// Jalur serialisasi ulang (tanpa indeks source) harus setara secara semantik untuk seluruh
// korpus golden: parse → serialisasi fresh → parse ulang menghasilkan dokumen yang sama.
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown, type SourceIndex } from '../src';
import { normalizeForCompare } from '../src/normalize';

const require = createRequire(import.meta.url);
const spec = (require('commonmark-spec') as { tests: { markdown: string; number: number }[] })
  .tests;
const root = new URL('../../../', import.meta.url);
const files = [
  ...globSync('fixtures/markdown-corpus/**/*.md', { cwd: root }),
  ...globSync('docs/**/*.md', { cwd: root }),
];

/**
 * Keterbatasan yang diketahui: list ber-indentasi 1–3 spasi diikuti blok ber-indentasi.
 * Indentasi awal list tidak disimpan, sehingga saat list ditulis ulang, blok berikutnya
 * masuk ke item. Guard round-trip menolak hasil seperti ini.
 */
const KNOWN_LIMITATIONS = new Set([257, 313]);

const EMPTY_INDEX: SourceIndex = { get: () => undefined, leading: '', trailing: '', size: 0 };

function freshRoundTrip(text: string): { actual: string; expected: string } {
  const parsed = parseMarkdown(text);
  const out = serializeMarkdown({ ...parsed, index: EMPTY_INDEX }, parsed.doc);
  return {
    actual: JSON.stringify(normalizeForCompare(parseMarkdown(out).doc)),
    expected: JSON.stringify(normalizeForCompare(parsed.doc)),
  };
}

describe('fresh serialization is semantically lossless', () => {
  it.each(files)('%s', (file) => {
    const { actual, expected } = freshRoundTrip(readFileSync(new URL(file, root), 'utf8'));
    expect(actual).toBe(expected);
  });
  it.each(
    spec
      .filter((t) => !KNOWN_LIMITATIONS.has(t.number))
      .map((t) => [t.number, t.markdown] as const),
  )('commonmark example %i', (_n, md) => {
    const { actual, expected } = freshRoundTrip(md);
    expect(actual).toBe(expected);
  });
});
