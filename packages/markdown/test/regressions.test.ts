// SPDX-License-Identifier: LicenseRef-Proprietary
// Regresi dari review akhir Fase 1 (C = critical, I = important).
import type { Node } from 'prosemirror-model';
import { lift, joinBackward } from 'prosemirror-commands';
import { liftListItem } from 'prosemirror-schema-list';
import { type Command, EditorState, TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, schema, serializeMarkdown, verifyRoundTrip } from '../src';
import { edit, posOf, insertText } from './helpers';

const replace =
  (from: string, to: string) => (tr: import('prosemirror-transform').Transform, doc: Node) => {
    const at = posOf(doc, from);
    insertText(tr, to, at, at + from.length);
  };

/** Jalankan perintah editor dengan kursor di awal `needle`; kembalikan output dan hasil guard. */
function runCommand(text: string, needle: string, command: Command): { out: string; ok: boolean } {
  const parsed = parseMarkdown(text);
  let state = EditorState.create({
    doc: parsed.doc,
    selection: TextSelection.create(parsed.doc, posOf(parsed.doc, needle)),
  });
  command(state, (tr) => {
    state = state.apply(tr);
  });
  const out = serializeMarkdown(parsed, state.doc);
  return { out, ok: verifyRoundTrip(out, state.doc).ok };
}

describe('C1: code span wrapped across lines stays one span', () => {
  it('keeps a wrapped code span intact when the paragraph is edited', () => {
    expect(edit('Run `npm install\n--save foo` now.\n', replace('now', 'later'))).toBe(
      'Run `npm install\n--save foo` later.\n',
    );
  });
  it('keeps CRLF inside a wrapped code span', () => {
    expect(edit('Run `npm install\r\n--save foo` now.\r\n', replace('now', 'later'))).toBe(
      'Run `npm install\r\n--save foo` later.\r\n',
    );
  });
  it('prefixes the continuation line inside a list item', () => {
    expect(edit('- Run `npm install\n  --save foo` now.\n', replace('now', 'later'))).toBe(
      '- Run `npm install\n  --save foo` later.\n',
    );
  });
  it('guard rejects splitting a code span in two', () => {
    const { doc } = parseMarkdown('Run `npm install\n--save foo` later.\n');
    expect(verifyRoundTrip('Run `npm install`\n`--save foo` later.\n', doc).ok).toBe(false);
  });
});

describe('C2: verbatim only in the original container', () => {
  it('liftListItem on the last nested item', () => {
    expect(
      runCommand('- a\n  - b\n  - c\n- d\n', 'c', liftListItem(schema.nodes.list_item)),
    ).toEqual({
      out: '- a\n  - b\n- c\n- d\n',
      ok: true,
    });
  });
  it('lifting the first item out of a list', () => {
    expect(runCommand('- a\n- b\n', 'a', liftListItem(schema.nodes.list_item))).toEqual({
      out: 'a\n\n- b\n',
      ok: true,
    });
  });
  it('lift a paragraph out of a blockquote', () => {
    expect(runCommand('> a\n>\n> b\n', 'b', lift)).toEqual({ out: '> a\n\nb\n', ok: true });
  });
  it('joinBackward a paragraph into the preceding quote', () => {
    expect(runCommand('> q\n\np\n', 'p', joinBackward)).toEqual({ out: '> q\n>\n> p\n', ok: true });
  });
  it('inserting a block at the top keeps the next block verbatim', () => {
    const text = 'Use \\_\\_init\\_\\_ x &amp; y   \nz\n';
    expect(
      edit(text, (tr) => tr.insert(0, schema.node('heading', { level: 1 }, [schema.text('New')]))),
    ).toBe('# New\n\n' + text);
  });
  it('deleting the first block keeps the next block verbatim', () => {
    expect(
      edit('A\n\nUse \\_\\_init\\_\\_\n', (tr, doc) => tr.delete(0, doc.child(0).nodeSize)),
    ).toBe('Use \\_\\_init\\_\\_\n');
  });
  it('inserting before the first child of a blockquote keeps it verbatim', () => {
    expect(
      edit('> Use \\_x\\_\n', (tr) =>
        tr.insert(1, schema.node('paragraph', null, [schema.text('N')])),
      ),
    ).toBe('> N\n>\n> Use \\_x\\_\n');
  });
});

describe('I2: task list items keep their checkbox source', () => {
  it('records the checkbox when the paragraph starts with inline code', () => {
    expect(edit('- [ ] `s2`\n  - x\n\n- [ ] s3\n', replace('s3', 's3!'))).toBe(
      '- [ ] `s2`\n  - x\n\n- [ ] s3!\n',
    );
  });
  it('keeps an uppercase X in untouched items', () => {
    expect(edit('- [ ] a\n- [X] b\n', replace('a', 'aa'))).toBe('- [ ] aa\n- [X] b\n');
  });
});

describe('I4: multi-line inline HTML inside containers', () => {
  it('in a list item', () => {
    expect(edit('- a <span\n  class="x">b</span>\n', replace('a', 'aa'))).toBe(
      '- aa <span\n  class="x">b</span>\n',
    );
  });
  it('in a blockquote', () => {
    expect(edit('> a <span\n> class="x">b</span>\n', replace('a', 'aa'))).toBe(
      '> aa <span\n> class="x">b</span>\n',
    );
  });
});

describe('I5: aligned tables keep alignment padding', () => {
  it('pads center and right columns by their alignment', () => {
    const table = '| x   |  b  |   c |\n| :-- | :-: | --: |\n| 1   |  2  |   3 |\n';
    expect(edit(table, replace('1', '1Q'))).toBe(table.replace('| 1   |', '| 1Q  |'));
  });
});

describe('I6: lone CR line endings', () => {
  it.each(['a\rb\r\rc\r', '# H\r\rpara\n', 'x\r\r- a\r- b\r'])(
    'round-trips %j unedited',
    (text) => {
      const p = parseMarkdown(text);
      const out = serializeMarkdown(p, p.doc);
      expect(out).toBe(text);
      expect(verifyRoundTrip(out, p.doc).ok).toBe(true);
    },
  );
});

describe('I1: edit path performance', () => {
  it('editing one cell of a 1000-row table with 100 link definitions', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => `| r${i} | [l${i % 100}] |`).join('\n');
    const defs = Array.from({ length: 100 }, (_, i) => `[l${i}]: https://x/${i}`).join('\n');
    const text = `| a | b |\n| --- | --- |\n${rows}\n\n${defs}\n`;
    const t0 = performance.now();
    const out = edit(text, replace('r500', 'r500!'));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(out).toBe(text.replace('| r500 |', '| r500! |'));
  });
  it('a fresh paragraph with 2000 escape candidates', () => {
    const para = 'a_'.repeat(1000) + 'b';
    const t0 = performance.now();
    const out = serializeMarkdown(
      parseMarkdown(''),
      schema.node('doc', null, [schema.node('paragraph', null, [schema.text(para)])]),
    );
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(out).toBe(para + '\n');
  });
});
