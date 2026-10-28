// SPDX-License-Identifier: LicenseRef-Proprietary
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from '../src';

const require = createRequire(import.meta.url);
const spec = (require('commonmark-spec') as { tests: { markdown: string; number: number }[] })
  .tests;
const root = new URL('../../../', import.meta.url);
const files = [
  ...globSync('fixtures/markdown-corpus/**/*.md', { cwd: root }),
  ...globSync('docs/**/*.md', { cwd: root }),
];
const identity = (text: string) => {
  const p = parseMarkdown(text);
  return serializeMarkdown(p, p.doc);
};

describe('golden: unedited round-trip is byte-identical', () => {
  it.each(spec.map((t) => [t.number, t.markdown] as const))('commonmark example %i', (_n, md) => {
    expect(identity(md)).toBe(md);
  });
  it.each(files)('%s', (file) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    expect(identity(text)).toBe(text);
  });
  it('covers the corpus', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });
});
