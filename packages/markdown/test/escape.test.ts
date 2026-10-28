// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { schema, parseMarkdown, serializeMarkdown } from '../src';

const out = (text: string) =>
  serializeMarkdown(
    parseMarkdown(''),
    schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])]),
  ).replace(/\n$/, '');

describe('minimal escaping', () => {
  it.each([
    ['2 * 3 = 6', '2 * 3 = 6'],
    ['a_b_c', 'a_b_c'],
    ['# not heading', '\\# not heading'],
    ['1. not list', '1\\. not list'],
    ['- not list', '\\- not list'],
    // Algoritma kiri-ke-kanan menghapus escape `<` lebih dulu; `<y\>` bukan tag HTML.
    ['x <y> z', 'x <y\\> z'],
    ['*not em*', '*not em\\*'],
    ['[x](y)', '[x\\](y)'],
    ['C:\\path', 'C:\\path'],
  ])('%s → %s', (input, expected) => {
    expect(out(input)).toBe(expected);
  });

  it.each([
    '~~no~~',
    'a | b',
    '&amp; &copy;',
    '`tick`',
    '***',
    '<!-- c -->',
    '[^1]',
    'line\n===',
    '> quote',
    '+ plus',
    '1) paren',
  ])('round-trips %j as literal text', (input) => {
    const p = parseMarkdown(out(input) + '\n');
    expect(p.doc.child(0).textContent).toBe(input.replace('\n', ' '));
  });
});
