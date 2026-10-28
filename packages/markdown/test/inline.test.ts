// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import type { Mark, Node } from 'prosemirror-model';
import { schema, parseMarkdown, serializeMarkdown } from '../src';

const para = (...content: Node[]) =>
  serializeMarkdown(
    parseMarkdown(''),
    schema.node('doc', null, [schema.node('paragraph', null, content)]),
  ).replace(/\n$/, '');
const t = (s: string, ...marks: Mark[]) => schema.text(s, marks);

describe('inline serialization', () => {
  it('moves edge whitespace outside delimiters', () => {
    expect(para(t('a '), t('b ', schema.mark('strong')), t('c'))).toBe('a **b** c');
  });
  it('switches underscore to star for intraword emphasis', () => {
    expect(para(t('foo'), t('bar', schema.mark('em', { delim: '_' })), t('baz'))).toBe(
      'foo*bar*baz',
    );
  });
  it('fences inline code around backticks', () => {
    expect(para(t('a`b', schema.mark('code')))).toBe('``a`b``');
    expect(para(t('`x', schema.mark('code')))).toBe('`` `x ``');
  });
  it('serializes link kinds', () => {
    expect(para(t('docs', schema.mark('link', { href: 'https://x/a b', title: 'T "q"' })))).toBe(
      '[docs](<https://x/a b> "T \\"q\\"")',
    );
    expect(para(t('https://x', schema.mark('link', { href: 'https://x', kind: 'autolink' })))).toBe(
      '<https://x>',
    );
    expect(
      para(t('www.y.com', schema.mark('link', { href: 'http://www.y.com', kind: 'literal' }))),
    ).toBe('www.y.com');
    expect(para(t('r', schema.mark('link', { href: 'u', kind: 'reference', refLabel: 'l' })))).toBe(
      '[r][l]',
    );
  });
  it('serializes breaks and images', () => {
    expect(para(t('a'), schema.node('hard_break'), t('b'))).toBe('a\\\nb');
    expect(para(t('a'), schema.node('soft_break'), t('b'))).toBe('a\nb');
    expect(para(schema.node('image', { src: 'assets/x.png', alt: 'a [b]', title: null }))).toBe(
      '![a \\[b\\]](assets/x.png)',
    );
  });
});
