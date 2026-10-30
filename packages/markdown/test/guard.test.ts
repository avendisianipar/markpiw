// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parseMarkdown, verifyRoundTrip, schema } from '../src';

describe('verifyRoundTrip', () => {
  it('accepts output that re-parses to the same semantics', () => {
    const { doc } = parseMarkdown('* a\n* b\n');
    expect(verifyRoundTrip('- a\n- b\n', doc)).toEqual({ ok: true, value: undefined });
  });
  it('rejects output that changes semantics and reports the path', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('a', [schema.mark('strong')])]),
    ]);
    const r = verifyRoundTrip('a\n', doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.path).toEqual([0]);
  });
  it('treats whitespace between equally marked words as carrying their common marks', () => {
    // `**a** **b**` dan `**a b**` hanya berbeda di tebal-tidaknya spasi; setelah mark
    // bersilangan, hanya bentuk pertama yang bisa ditulis.
    const strong = schema.mark('strong');
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('a b', [strong])]),
    ]);
    expect(verifyRoundTrip('**a** **b**\n', doc).ok).toBe(true);
  });
  it('trims whitespace around soft breaks in headings before joining lines', () => {
    const doc = schema.node('doc', null, [
      schema.node('heading', { level: 1 }, [
        schema.text('a '),
        schema.node('soft_break'),
        schema.text('b'),
      ]),
    ]);
    expect(verifyRoundTrip('# a b\n', doc).ok).toBe(true);
  });
  it('ignores empty paragraphs and edge whitespace', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('  x  ')]),
      schema.node('paragraph'),
    ]);
    expect(verifyRoundTrip('x\n', doc).ok).toBe(true);
  });
});
