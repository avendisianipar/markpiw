// SPDX-License-Identifier: MIT
import { TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { cursorAt, md, setup } from './util';

describe('applyExternalText', () => {
  it('keeps the cursor in an unchanged block before the change', () => {
    const { c } = setup('# A\n\nbb\n\ncc\n');
    cursorAt(c, 'A');
    const before = c.state.selection.from;
    c.applyExternalText('# A\n\nbb\n\ncc changed\n');
    expect(c.state.selection.from).toBe(before);
    expect(md(c)).toBe('# A\n\nbb\n\ncc changed\n');
  });

  it('shifts a cursor in the unchanged suffix by the size difference', () => {
    const { c } = setup('a\n\nzz\n');
    cursorAt(c, 'zz');
    const before = c.state.selection.from;
    c.applyExternalText('a longer\n\nzz\n');
    expect(c.state.selection.from).toBe(before + ' longer'.length);
  });

  it('puts the cursor at the start of the replaced range when its block changed', () => {
    const { c } = setup('a\n\nbb\n\ncc\n');
    cursorAt(c, 'bb');
    c.applyExternalText('a\n\nxx yy\n\ncc\n');
    expect(c.state.selection).toBeInstanceOf(TextSelection);
    expect(c.state.doc.resolve(c.state.selection.from).parent.textContent).toBe('xx yy');
  });

  it('is byte-identical afterwards and not dirty, without firing onDocChange', () => {
    const { c } = setup('a\n');
    let changes = 0;
    c.onDocChange(() => changes++);
    c.applyExternalText('x\r\n\r\n- y\r\n');
    expect(md(c)).toBe('x\r\n\r\n- y\r\n');
    expect(c.getSnapshot().dirty).toBe(false);
    expect(changes).toBe(0);
  });

  it('is not undoable in editor history mode', () => {
    const { c } = setup('a\n');
    c.applyExternalText('b\n');
    expect(c.getSnapshot().canUndo).toBe(false);
  });
});
