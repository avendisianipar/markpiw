// SPDX-License-Identifier: LicenseRef-Proprietary
import { afterEach, describe, expect, it } from 'vitest';
import { cursorAt, setup, type } from './util';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('outline', () => {
  it('lists every heading with level and plain text', () => {
    const { c } = setup(
      '# Satu\n\nIsi.\n\n## Dua *miring*\n\n> ### Di quote\n\n- item\n\n  #### Di list\n',
    );
    const outline = c.getSnapshot().outline;
    expect(outline.map((h) => [h.level, h.text])).toEqual([
      [1, 'Satu'],
      [2, 'Dua miring'],
      [3, 'Di quote'],
      [4, 'Di list'],
    ]);
    for (const h of outline) expect(c.state.doc.nodeAt(h.pos)?.type.name).toBe('heading');
  });

  it('is empty without headings', () => {
    const { c } = setup('Hanya paragraf.\n');
    expect(c.getSnapshot().outline).toEqual([]);
  });

  it('keeps the same reference when only the cursor moves', () => {
    const { c } = setup('# A\n\nisi panjang\n');
    const before = c.getSnapshot().outline;
    cursorAt(c, 'isi');
    expect(c.getSnapshot().outline).toBe(before);
  });

  it('updates when a heading is edited or added from outside', () => {
    const { c, view } = setup('# A\n\nisi\n');
    cursorAt(c, 'A');
    type(view, 'B');
    expect(c.getSnapshot().outline.map((h) => h.text)).toEqual(['AB']);
    c.applyExternalText('# AB\n\n## Baru\n');
    expect(c.getSnapshot().outline.map((h) => h.text)).toEqual(['AB', 'Baru']);
  });

  it('goToHeading puts the cursor at the start of the heading', () => {
    const { c } = setup('# A\n\nisi\n\n## Target\n');
    const target = c.getSnapshot().outline[1];
    expect(c.commands.goToHeading(target?.pos ?? -1)).toBe(true);
    const { $from, empty } = c.state.selection;
    expect(empty).toBe(true);
    expect($from.parent.textContent).toBe('Target');
    expect($from.parentOffset).toBe(0);
  });

  it('goToHeading ignores positions that are not headings', () => {
    const { c } = setup('# A\n\nisi\n');
    expect(c.commands.goToHeading(5)).toBe(false);
    expect(c.commands.goToHeading(999)).toBe(false);
  });
});
