// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { cursorAt, md, press, setup } from './util';

const TABLE = '# T\n\n| A | B |\n|---|:---:|\n| a1 | b1 |\n| c1 | d1 |\n\nzzz\n';

describe('table alignment rendering', () => {
  it('shows column alignment from the file as a class on every cell of that column', () => {
    const { el } = setup(TABLE);
    const aligns = [...el.querySelectorAll('tr')].map((tr) =>
      [...tr.children].map((cell) => cell.className),
    );
    expect(aligns).toEqual([
      ['', 'mp-align-center'],
      ['', 'mp-align-center'],
      ['', 'mp-align-center'],
    ]);
  });

  it('updates the cells after changing alignment from the toolbar command', () => {
    const { c, el } = setup(TABLE);
    cursorAt(c, 'a1');
    c.commands.tableSetAlign('right');
    expect(el.querySelector('td')?.className).toBe('mp-align-right');
    expect(md(c)).toContain('| ---: | :---: |');
  });
});

describe('table state and actions', () => {
  it('reports which delete actions apply', () => {
    const { c } = setup(TABLE);
    cursorAt(c, 'B');
    expect(c.getSnapshot().table).toEqual({
      canDeleteRow: false,
      canDeleteColumn: true,
      align: 'center',
    });
    cursorAt(c, 'a1');
    expect(c.getSnapshot().table?.canDeleteRow).toBe(true);
    cursorAt(c, 'zzz');
    expect(c.getSnapshot().table).toBeNull();
  });

  it('cannot delete the only body row or the only column', () => {
    const { c } = setup('| A |\n|---|\n| a |\n');
    cursorAt(c, 'a');
    expect(c.getSnapshot().table).toMatchObject({ canDeleteRow: false, canDeleteColumn: false });
  });

  it('adds a row above and a column to the left', () => {
    const { c } = setup(TABLE);
    cursorAt(c, 'c1');
    c.commands.tableAddRow('before');
    c.commands.tableAddColumn('before');
    expect(md(c)).toBe(
      '# T\n\n|  | A | B |\n| --- | --- | :---: |\n|  | a1 | b1 |\n|  |  |  |\n|  | c1 | d1 |\n\nzzz\n',
    );
  });

  it('deletes the whole table', () => {
    const { c } = setup(TABLE);
    cursorAt(c, 'a1');
    expect(c.commands.tableDelete()).toBe(true);
    expect(md(c)).toBe('# T\n\nzzz\n');
    expect(c.getSnapshot().table).toBeNull();
  });

  it('deleting a table that is the whole document leaves an empty paragraph', () => {
    const { c } = setup('| A |\n|---|\n| a |\n');
    cursorAt(c, 'a');
    c.commands.tableDelete();
    expect(c.state.doc.childCount).toBe(1);
    expect(c.state.doc.firstChild?.type.name).toBe('paragraph');
  });
});

describe('Shift+Enter', () => {
  it('inserts a hard break in a paragraph', () => {
    const { c, view } = setup('satu dua\n');
    cursorAt(c, 'satu');
    expect(press(view, 'Shift-Enter')).toBe(true);
    expect(md(c)).toBe('satu\\\ndua\n');
    expect(c.getSnapshot().readOnly).toBeNull();
  });

  it('inserts <br> in a table cell and renders it as a line break', () => {
    const { c, view, el } = setup(TABLE);
    cursorAt(c, 'a1');
    expect(press(view, 'Shift-Enter')).toBe(true);
    expect(md(c)).toContain('| a1<br> | b1 |');
    expect(el.querySelector('td .mp-raw-br br')).not.toBeNull();
    expect(c.getSnapshot().readOnly).toBeNull();
  });

  it('does nothing in a heading (markdown headings are single-line)', () => {
    const { c, view } = setup('# Judul\n');
    cursorAt(c, 'Jud');
    expect(press(view, 'Shift-Enter')).toBe(false);
  });

  it('inserts a newline in a code block', () => {
    const { c, view } = setup('```\nab\n```\n');
    cursorAt(c, 'a');
    press(view, 'Shift-Enter');
    expect(md(c)).toBe('```\na\nb\n```\n');
  });
});
