// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type SrcKey } from '../src';

const src = '# T\n\n> q1\n> q2\n\n- a\n- [ ] b\n';
const p = parseMarkdown(src);
const entry = (n: { attrs: Record<string, unknown> }) => p.index.get(n.attrs.srcKey as SrcKey)!;

describe('source index', () => {
  it('records whole-line text, separators and leading/trailing', () => {
    const [h, q, l] = [p.doc.child(0), p.doc.child(1), p.doc.child(2)];
    expect(entry(h)).toMatchObject({ text: '# T', prevKey: null, sepBefore: '', isLast: false });
    expect(entry(q)).toMatchObject({ text: '> q1\n> q2', sepBefore: '\n\n' });
    expect(entry(q).prevKey).toBe(h.attrs.srcKey);
    expect(entry(l)).toMatchObject({ text: '- a\n- [ ] b', isLast: true });
    expect(p.index.leading).toBe('');
    expect(p.index.trailing).toBe('\n');
  });
  it('records container contributions', () => {
    expect(entry(p.doc.child(1)).contribution).toEqual({ first: '> ', rest: '> ' });
    const items = p.doc.child(2);
    expect(entry(items.child(0)).contribution).toEqual({ first: '- ', rest: '  ' });
    expect(entry(items.child(1)).contribution).toEqual({ first: '- [ ] ', rest: '  ' });
    expect(entry(items.child(1)).sepBefore).toBe('\n');
  });
  it('records nested blocks with absolute prefixes', () => {
    const q = parseMarkdown('> a\n>\n> b\n');
    const b = q.doc.child(0).child(1);
    expect(q.index.get(b.attrs.srcKey)!).toMatchObject({ text: '> b', sepBefore: '\n>\n' });
  });
  it('records ordered list numbers and table lines', () => {
    const o = parseMarkdown('1. a\n1. b\n\n| a   | b   |\n| --- | --- |\n');
    expect(o.index.get(o.doc.child(0).child(1).attrs.srcKey)!.listNumber).toBe(1);
    expect(o.index.get(o.doc.child(1).attrs.srcKey)!).toMatchObject({
      tableLines: ['| a   | b   |', '| --- | --- |'],
      tableAligned: true,
    });
  });
  it('treats whitespace-only input as trailing', () => {
    const e = parseMarkdown('\n\n');
    expect(e.index.size).toBe(0);
    expect(e.index.trailing).toBe('\n\n');
  });
});
