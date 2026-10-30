// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../src';

const d = (md: string) => parseMarkdown(md).doc;

describe('parseMarkdown structure', () => {
  it('maps headings with style', () => {
    expect(d('# A\n').child(0).attrs).toMatchObject({ level: 1, style: 'atx' });
    expect(d('B\n===\n').child(0).attrs).toMatchObject({ level: 1, style: 'setext' });
  });
  it('maps lists with marker, tightness and task state', () => {
    const list = d('* a\n* [x] b\n').child(0);
    expect(list.attrs).toMatchObject({ marker: '*', tight: true });
    expect(list.child(1).attrs.checked).toBe(true);
    expect(d('3) a\n4) b\n').child(0).attrs).toMatchObject({ start: 3, delimiter: ')' });
    expect(d('- a\n\n- b\n').child(0).attrs.tight).toBe(false);
  });
  it('keeps soft breaks and hard break style', () => {
    expect(d('a\nb\n').toString()).toBe('doc(paragraph("a", soft_break, "b"))');
    expect(d('a\\\nb\n').child(0).child(1).attrs.style).toBe('backslash');
    expect(d('a  \nb\n').child(0).child(1).attrs.style).toBe('spaces');
  });
  it('records emphasis delimiters and link kinds', () => {
    const p = d(
      '_a_ **b** [c](u) <https://x> www.y.com [r][l] [s]\n\n[l]: https://l\n[s]: https://s\n',
    ).child(0);
    const marks = (i: number) => p.child(i).marks.map((m) => [m.type.name, m.attrs]);
    expect(marks(0)).toEqual([['em', { delim: '_' }]]);
    expect(p.textContent).toContain('www.y.com');
    const kinds: string[] = [];
    p.forEach((n) =>
      n.marks.forEach((m) => {
        if (m.type.name === 'link') kinds.push(`${m.attrs.kind}:${m.attrs.refLabel}`);
      }),
    );
    expect(kinds).toEqual([
      'inline:null',
      'autolink:null',
      'literal:null',
      'reference:l',
      'reference:null',
    ]);
  });
  it('maps code blocks with fence info', () => {
    expect(d('~~~~js title="x"\nq\n~~~~\n').child(0).attrs).toMatchObject({
      lang: 'js title="x"',
      fence: '~~~',
      fenceLength: 4,
    });
    expect(d('    q\n').child(0).attrs.fence).toBe('indented');
  });
  it('maps raw constructs to raw nodes', () => {
    const doc = d('---\nt: 1\n---\n\n<div>\nx\n</div>\n\nText <!-- c --> end[^1]\n\n[^1]: note\n');
    expect(doc.child(0).attrs.kind).toBe('frontmatter');
    expect(doc.child(0).textContent).toBe('---\nt: 1\n---');
    expect(doc.child(1).attrs.kind).toBe('html');
    expect(doc.child(2).toString()).toContain('raw_inline');
    expect(doc.child(3).attrs.kind).toBe('footnote');
  });
  it('falls back to raw_block when a list item does not start with a paragraph', () => {
    const doc = d('- # heading in item\n- b\n');
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('raw_block');
    expect(doc.child(0).textContent).toBe('- # heading in item\n- b');
  });
  it('maps tables with alignment and header cells', () => {
    const t = d('| a | b |\n| :- | -: |\n| 1 | 2 |\n').child(0);
    expect(t.attrs.align).toEqual(['left', 'right']);
    expect(t.child(0).child(0).attrs.header).toBe(true);
    expect(t.child(1).child(0).attrs.header).toBe(false);
  });
  it('handles empty input and BOM', () => {
    expect(d('').toString()).toBe('doc(paragraph)');
    expect(d('\uFEFF# A\n').child(0).type.name).toBe('heading');
  });
});
