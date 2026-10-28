// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { schema } from '../src/schema';

describe('schema', () => {
  it('declares exactly the GFM node and mark names', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      'blockquote',
      'bullet_list',
      'code_block',
      'doc',
      'hard_break',
      'heading',
      'horizontal_rule',
      'image',
      'list_item',
      'ordered_list',
      'paragraph',
      'raw_block',
      'raw_inline',
      'soft_break',
      'table',
      'table_cell',
      'table_row',
      'text',
    ]);
    expect(Object.keys(schema.marks).sort()).toEqual(['code', 'em', 'link', 'strike', 'strong']);
  });
  it('style attrs default to null (use profile) and srcKey defaults to null', () => {
    const list = schema.nodes.bullet_list.create(
      null,
      schema.nodes.list_item.create(null, schema.nodes.paragraph.create()),
    );
    expect(list.attrs).toMatchObject({ marker: null, tight: true, srcKey: null });
    expect(schema.marks.em.create().attrs).toEqual({ delim: null });
    expect(schema.nodes.hard_break.create().attrs).toEqual({ style: 'backslash' });
  });
  it('list_item must start with a paragraph', () => {
    expect(() =>
      schema.nodes.list_item.createChecked(null, schema.nodes.code_block.create()),
    ).toThrow();
  });
  it('soft_break reads as a space', () => {
    expect(schema.nodes.soft_break.spec.leafText?.(schema.nodes.soft_break.create())).toBe(' ');
  });
});
