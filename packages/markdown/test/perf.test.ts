// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from '../src';

describe('performance', () => {
  it('performance: 5000-line document', () => {
    const block =
      '## Section\n\nSome *text* with `code` and [link](u).\n\n- item one\n- item two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n';
    const text = block.repeat(Math.ceil(5000 / block.split('\n').length));
    const t0 = performance.now();
    const p = parseMarkdown(text);
    expect(serializeMarkdown(p, p.doc)).toBe(text);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
