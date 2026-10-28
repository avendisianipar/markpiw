// SPDX-License-Identifier: LicenseRef-Proprietary
import type { Node } from 'prosemirror-model';
import type { Transform } from 'prosemirror-transform';
import { describe, expect, it } from 'vitest';
import { schema } from '../src';
import { childPos, edit, insertText, posOf } from './helpers';

/** Ganti kemunculan pertama `from` dengan `to`. */
const replace = (from: string, to: string) => (tr: Transform, doc: Node) => {
  const at = posOf(doc, from);
  insertText(tr, to, at, at + from.length);
};
/** Sisip `text` tepat setelah kemunculan pertama `after`. */
const append = (after: string, text: string) => (tr: Transform, doc: Node) => {
  insertText(tr, text, posOf(doc, after) + after.length);
};
const item = (text: string) =>
  schema.node('list_item', null, [schema.node('paragraph', null, [schema.text(text)])]);
const para = (text: string) => schema.node('paragraph', null, [schema.text(text)]);

describe('targeted edits only touch the edited block', () => {
  it('edit: paragraph among others', () => {
    expect(
      edit('# Title\n\nPara one\nwrapped line.\n\nPara two.\n', append('Para two.', '!')),
    ).toBe('# Title\n\nPara one\nwrapped line.\n\nPara two.!\n');
  });
  it('edit: soft breaks preserved', () => {
    expect(edit('# Title\n\nPara one\nwrapped line.\n\nPara two.\n', replace('one', 'ONE'))).toBe(
      '# Title\n\nPara ONE\nwrapped line.\n\nPara two.\n',
    );
  });
  it('edit: bullet item with star marker', () => {
    expect(edit('* a\n* b\n* c\n', replace('b', 'bb'))).toBe('* a\n* bb\n* c\n');
  });
  it('edit: insert ordered item renumbers', () => {
    expect(edit('1. a\n2. b\n', (tr) => tr.insert(1, item('z')))).toBe('1. z\n2. a\n3. b\n');
  });
  it('edit: insert ordered item same numbering', () => {
    expect(edit('1. a\n1. b\n', (tr) => tr.insert(1, item('z')))).toBe('1. z\n1. a\n1. b\n');
  });
  it('edit: nested list item', () => {
    expect(edit('- a\n  - b\n  - c\n- d\n', replace('c', 'cc'))).toBe('- a\n  - b\n  - cc\n- d\n');
  });
  it('edit: blockquote without space', () => {
    expect(edit('>a\n>\n>b\n', replace('b', 'bb'))).toBe('>a\n>\n>bb\n');
  });
  it('edit: toggle task', () => {
    expect(
      edit('- [ ] todo\n- [x] done\n', (tr, doc) => {
        const pos = childPos(doc, [0, 0]);
        tr.setNodeMarkup(pos, null, { ...doc.child(0).child(0).attrs, checked: true });
      }),
    ).toBe('- [x] todo\n- [x] done\n');
  });
  it('edit: emphasis delimiter kept', () => {
    expect(edit('This is _important_ text.\n', replace('text', 'texts'))).toBe(
      'This is _important_ texts.\n',
    );
  });
  it('edit: setext heading', () => {
    expect(edit('Title\n=====\n\nBody\n', replace('Title', 'Title2'))).toBe(
      'Title2\n======\n\nBody\n',
    );
  });
  it('edit: tilde fence kept', () => {
    expect(edit('~~~py\nx = 1\n~~~\n', replace('1', '2'))).toBe('~~~py\nx = 2\n~~~\n');
  });
  it('edit: compact table row only', () => {
    expect(edit('| a | b |\n| --- | :-: |\n| 1 | 2 |\n', replace('2', '22'))).toBe(
      '| a | b |\n| --- | :-: |\n| 1 | 22 |\n',
    );
  });
  it('edit: aligned table re-padded', () => {
    expect(edit('| a   | b   |\n| --- | --- |\n| 1   | 2   |\n', replace('2', '2222'))).toBe(
      '| a   | b    |\n| --- | ---- |\n| 1   | 2222 |\n',
    );
  });
  it('edit: insert paragraph', () => {
    expect(edit('A\n\nB\n', (tr, doc) => tr.insert(doc.child(0).nodeSize, para('N')))).toBe(
      'A\n\nN\n\nB\n',
    );
  });
  it('edit: delete block', () => {
    expect(
      edit('A\n\nB\n\nC\n', (tr, doc) => {
        const from = childPos(doc, [1]);
        tr.delete(from, from + doc.child(1).nodeSize);
      }),
    ).toBe('A\n\nC\n');
  });
  it('edit: crlf preserved', () => {
    expect(edit('A\r\n\r\nB\r\n', replace('B', 'BB'))).toBe('A\r\n\r\nBB\r\n');
  });
  it('edit: frontmatter untouched', () => {
    expect(edit('---\ntitle: x\n---\n\n# H\n', replace('H', 'H2'))).toBe(
      '---\ntitle: x\n---\n\n# H2\n',
    );
  });
  it('edit: html block untouched', () => {
    expect(edit('<div>\nx\n</div>\n\nP\n', replace('P', 'PP'))).toBe('<div>\nx\n</div>\n\nPP\n');
  });
  it('edit: hard break spaces', () => {
    expect(edit('a  \nb\n', replace('b', 'bb'))).toBe('a  \nbb\n');
  });
  it('edit: hard break backslash', () => {
    expect(edit('a\\\nb\n', replace('b', 'bb'))).toBe('a\\\nbb\n');
  });
  it('edit: reference link kept', () => {
    expect(edit('See [docs][d].\n\n[d]: https://x\n', replace('See', 'Read'))).toBe(
      'Read [docs][d].\n\n[d]: https://x\n',
    );
  });
  it('edit: literal autolink kept', () => {
    expect(edit('Go to www.x.com now\n', replace('now', 'later'))).toBe('Go to www.x.com later\n');
  });
  it('edit: loose list', () => {
    expect(edit('- a\n\n- b\n', replace('b', 'bb'))).toBe('- a\n\n- bb\n');
  });
  it('edit: indented code kept', () => {
    expect(edit('    code\n', append('code', '2'))).toBe('    code2\n');
  });
  it('edit: wide list padding kept', () => {
    expect(edit('-   a\n-   b\n', replace('b', 'bb'))).toBe('-   a\n-   bb\n');
  });
  it('edit: trailing blank lines kept', () => {
    expect(edit('A\n\n\n', replace('A', 'AA'))).toBe('AA\n\n\n');
  });
  it('edit: empty file gets final newline', () => {
    expect(edit('', (tr) => insertText(tr, 'Hi', 1))).toBe('Hi\n');
  });
  it('edit: list with tab indentation', () => {
    expect(edit('-\ta\n-\tb\n', replace('b', 'bb'))).toBe('-\ta\n-\tbb\n');
  });
  it('edit: mixed line endings', () => {
    expect(edit('A\r\nwrapped\n\nB\n', replace('wrapped', 'wrapped2'))).toBe('A\nwrapped2\n\nB\n');
  });
  it('edit: paragraph with inline html comment', () => {
    expect(edit('Text <!-- TODO --> here\n', replace('here', 'there'))).toBe(
      'Text <!-- TODO --> there\n',
    );
  });
});
