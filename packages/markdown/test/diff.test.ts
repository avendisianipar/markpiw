// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { diffText } from '../src';

describe('diffText', () => {
  it('returns no change for equal text', () => {
    expect(diffText('abc', 'abc')).toEqual([]);
  });
  it('trims common prefix and suffix', () => {
    expect(diffText('abcdef', 'abXYef')).toEqual([{ from: 2, to: 4, insert: 'XY' }]);
    expect(diffText('ab', 'aXb')).toEqual([{ from: 1, to: 1, insert: 'X' }]);
    expect(diffText('aaa', 'aaaa')).toEqual([{ from: 3, to: 3, insert: 'a' }]);
  });
  it('diffText never splits surrogate pairs', () => {
    expect(diffText('x😀y', 'x😁y')).toEqual([{ from: 1, to: 3, insert: '😁' }]);
    expect(diffText('中文😀', '中文😀!')).toEqual([{ from: 4, to: 4, insert: '!' }]);
  });
});
