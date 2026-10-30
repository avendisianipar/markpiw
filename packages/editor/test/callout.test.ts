// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { cursorAt, md, press, setup, type } from './util';

describe('GitHub callouts', () => {
  it('styles a blockquote that starts with an alert marker, file unchanged', () => {
    const text = '> [!WARNING]\n> Jangan hapus folder ini.\n';
    const { c, el } = setup(text);
    const quote = el.querySelector('blockquote');
    expect(quote?.className).toContain('mp-callout-warning');
    expect(quote?.getAttribute('data-callout-label')).toBe('Peringatan');
    expect(el.querySelector('.mp-callout-marker')?.textContent).toBe('[!WARNING]');
    expect(md(c)).toBe(text);
  });

  it('ignores ordinary quotes and markers that are not alone on the first line', () => {
    const { el } = setup('> biasa\n\n> [!NOTE] teks di baris yang sama\n');
    expect(el.querySelector('.mp-callout')).toBeNull();
  });

  it('slash command wraps the paragraph into a callout', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/catatan');
    press(view, 'Enter');
    type(view, 'Isi catatan');
    expect(md(c)).toBe('> [!NOTE]\n> Isi catatan\n');
    expect(c.getSnapshot().readOnly).toBeNull();
  });

  it('wraps existing text and keeps the cursor in place', () => {
    const { c, view } = setup('halo dunia\n');
    cursorAt(c, 'halo');
    expect(c.commands.insertCallout('tip')).toBe(true);
    type(view, '!');
    expect(md(c)).toBe('> [!TIP]\n> halo! dunia\n');
  });
});
