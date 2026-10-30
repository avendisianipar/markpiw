// SPDX-License-Identifier: MIT
import type { Node } from 'prosemirror-model';
import type { Transform } from 'prosemirror-transform';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, schema, serializeMarkdown, verifyRoundTrip } from '../src';
import { edit, insertText, posOf } from './helpers';

const append = (after: string, text: string) => (tr: Transform, doc: Node) => {
  insertText(tr, text, posOf(doc, after) + after.length);
};

function types(text: string): string[] {
  const out: string[] = [];
  parseMarkdown(text).doc.descendants((n) => {
    out.push(n.type.name);
  });
  return out;
}

/** Serialisasi dokumen baru (tanpa source) dan pastikan lolos guard. */
function fresh(doc: Node): string {
  const out = serializeMarkdown(parseMarkdown(''), doc);
  expect(verifyRoundTrip(out, doc)).toEqual({ ok: true, value: undefined });
  return out;
}

describe('math', () => {
  it('parses inline and block math into math nodes', () => {
    expect(types('Energi $E=mc^2$ di sini.\n\n$$\n\\int_0^1 x\\,dx\n$$\n')).toEqual([
      'paragraph',
      'text',
      'math_inline',
      'text',
      'math_block',
      'text',
    ]);
    const doc = parseMarkdown('$$\na\n$$\n').doc;
    expect(doc.firstChild?.textContent).toBe('a');
  });

  it('keeps unedited math byte-identical', () => {
    const text = 'Rumus $$a$$ dan $b$.\n\n$$$\nx $$ y\n$$$\n';
    const parsed = parseMarkdown(text);
    expect(serializeMarkdown(parsed, parsed.doc)).toBe(text);
  });

  it('re-serializes an edited paragraph with its inline math', () => {
    expect(edit('Nilai $x^2$ naik.\n', append('naik', ' lagi'))).toBe('Nilai $x^2$ naik lagi.\n');
  });

  it('writes new math nodes with safe delimiters', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('harga '),
        schema.node('math_inline', { latex: 'a$b' }),
      ]),
      schema.node('math_block', null, [schema.text('x\n$$\ny')]),
    ]);
    expect(fresh(doc)).toBe('harga $$a$b$$\n\n$$$\nx\n$$\ny\n$$$\n');
  });

  it('escapes dollar signs in ordinary text so they do not become math', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('$5 dan $10')]),
    ]);
    const out = fresh(doc);
    expect(parseMarkdown(out).doc.firstChild?.textContent).toBe('$5 dan $10');
  });

  it('escapes pipes of inline math inside a table cell', () => {
    const cell = (content: Node[], header: boolean) =>
      schema.node('table_cell', { header }, content);
    const doc = schema.node('doc', null, [
      schema.node('table', { align: [null] }, [
        schema.node('table_row', null, [cell([schema.text('A')], true)]),
        schema.node('table_row', null, [
          cell([schema.node('math_inline', { latex: '|x|' })], false),
        ]),
      ]),
    ]);
    expect(fresh(doc)).toContain('$\\|x\\|$');
  });
});

describe('empty inline math (just inserted, not filled in yet)', () => {
  it('is not written and does not trip the guard', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('a '),
        schema.node('math_inline', { latex: '' }),
      ]),
    ]);
    expect(fresh(doc)).toBe('a \n');
  });
});
