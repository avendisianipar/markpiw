// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../src';

const prof = (md: string) => parseMarkdown(md).profile;

describe('profile detection', () => {
  it('uses spec defaults for an empty file', () => {
    expect(prof('')).toEqual({
      bulletMarker: '-',
      emDelim: '*',
      strongDelim: '**',
      fence: '```',
      headingStyle: 'atx',
      listIndent: 'marker+1',
      orderedNumbering: 'increment',
      tablePadding: 'compact',
      eol: '\n',
      finalNewline: true,
      bom: false,
    });
  });
  it('detects majority styles', () => {
    expect(prof('* a\n* b\n\n- c\n\n_x_ _y_ *z*\n\n__s__\n\n~~~\nq\n~~~\n')).toMatchObject({
      bulletMarker: '*',
      emDelim: '_',
      strongDelim: '__',
      fence: '~~~',
    });
  });
  it('detects ordered numbering, list indent and table padding', () => {
    expect(prof('1. a\n1. b\n').orderedNumbering).toBe('same');
    expect(prof('-   a\n-   b\n').listIndent).toBe(4);
    expect(prof('| a   | b   |\n| --- | --- |\n').tablePadding).toBe('aligned');
  });
  it('detects eol, final newline and BOM', () => {
    expect(prof('a\r\n\r\nb\r\n').eol).toBe('\r\n');
    expect(prof('a').finalNewline).toBe(false);
    expect(prof('﻿a\n').bom).toBe(true);
  });
});
