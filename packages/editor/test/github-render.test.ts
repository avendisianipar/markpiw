// SPDX-License-Identifier: MIT
// Tampilan meniru GitHub: callout, tag HTML blok, <details>, header tabel kosong, pratinjau.
import { TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { findRegions, parseOpener } from '../src/plugins/html';
import { cursorAt, md, setup } from './util';

const mousedown = (target: Element) =>
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

describe('callout seperti GitHub', () => {
  const text = '> [!NOTE]\n> Rilis stabil.\n';

  it('menampilkan judul berikon dan menyembunyikan marker selama tidak diedit', () => {
    const { el } = setup(`paragraf\n\n${text}`);
    const title = el.querySelector('blockquote .mp-callout-title');
    expect(title?.textContent).toBe('Catatan');
    expect(title?.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('.mp-callout-marker')?.className).toContain('mp-callout-marker-hidden');
    expect(el.querySelector('.mp-callout-break')?.className).toContain('mp-callout-marker-hidden');
  });

  it('memunculkan marker saat kursor di awal baris isi, file tetap sama', () => {
    const { c, el } = setup(`paragraf\n\n${text}`);
    cursorAt(c, 'Rilis');
    const start = c.state.selection.head - 'Rilis'.length;
    c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, start)));
    expect(el.querySelector('.mp-callout-marker')?.className).toContain('mp-callout-marker-shown');
    cursorAt(c, 'stabil');
    expect(el.querySelector('.mp-callout-marker')?.className).toContain('mp-callout-marker-hidden');
    expect(md(c)).toBe(`paragraf\n\n${text}`);
  });
});

describe('tag HTML blok seperti GitHub', () => {
  const centered = '<div align="center">\n\n# Judul\n\nTeks\n\n</div>\n\nSesudah\n';

  it('mengenali tag pembuka', () => {
    expect(parseOpener('<div align="center">')).toMatchObject({ tag: 'div', align: 'center' });
    expect(parseOpener("<p align='right'>")).toMatchObject({ tag: 'p', align: 'right' });
    expect(parseOpener('<details>\n<summary><b>Lihat</b></summary>')).toMatchObject({
      tag: 'details',
      summary: '<b>Lihat</b>',
      open: false,
    });
    expect(parseOpener('<details open>')).toMatchObject({ tag: 'details', open: true });
    expect(parseOpener('<div align="center"><img src="x.png"></div>')).toBeNull();
    expect(parseOpener('<img src="x.png">')).toBeNull();
  });

  it('meratakan isi <div align="center"> dan menyembunyikan tag-nya', () => {
    const { c, el } = setup(centered);
    expect(findRegions(c.state.doc)).toHaveLength(1);
    expect(el.querySelector('h1')?.className).toContain('mp-html-align-center');
    expect(el.querySelectorAll('p.mp-html-align-center')).toHaveLength(1);
    const tags = el.querySelectorAll('.mp-raw.mp-html-tag');
    expect(tags).toHaveLength(2);
    tags.forEach((tag) => expect(tag.className).not.toContain('mp-html-tag-active'));
    expect(md(c)).toBe(centered);
  });

  it('menampilkan source tag saat kursor berada di wilayahnya', () => {
    const { c, el } = setup(centered);
    cursorAt(c, 'Judul');
    expect(el.querySelectorAll('.mp-html-tag-active')).toHaveLength(2);
    cursorAt(c, 'Sesudah');
    expect(el.querySelectorAll('.mp-html-tag-active')).toHaveLength(0);
  });

  it('tag penutup tanpa pasangan tetap raw block biasa', () => {
    const { el } = setup('</div>\n\nteks\n');
    expect(el.querySelector('.mp-html-tag')).toBeNull();
    expect(el.querySelector('.mp-raw')).not.toBeNull();
  });
});

describe('<details> seperti GitHub', () => {
  const text =
    'Awal\n\n<details>\n<summary><strong>Lihat cara pakai</strong></summary>\n\nIsi tersembunyi\n\n</details>\n\nAkhir\n';

  it('terlipat dengan ringkasan yang aman, bisa dibuka dan ditutup', () => {
    const { c, el, view } = setup(text);
    const summary = () => el.querySelector('.mp-details-summary') as HTMLElement;
    expect(summary().textContent).toBe('Lihat cara pakai');
    expect(summary().querySelector('strong')).not.toBeNull();
    expect(summary().dataset.open).toBe('false');
    const body = () =>
      [...el.querySelectorAll('p')].find((p) => p.textContent === 'Isi tersembunyi');
    expect(body()?.className).toContain('mp-html-collapsed');

    mousedown(summary());
    expect(summary().dataset.open).toBe('true');
    expect(body()?.className).not.toContain('mp-html-collapsed');

    mousedown(summary());
    expect(summary().dataset.open).toBe('false');
    expect(view.state.doc.eq(c.state.doc)).toBe(true);
    expect(md(c)).toBe(text);
  });

  it('isi terlihat saat kursor masuk ke dalamnya', () => {
    const { c, el } = setup(text);
    cursorAt(c, 'tersembunyi');
    const body = [...el.querySelectorAll('p')].find((p) => p.textContent === 'Isi tersembunyi');
    expect(body?.className).not.toContain('mp-html-collapsed');
  });

  it('tidak memasukkan HTML berbahaya dari summary', () => {
    const { el } = setup(
      '<details>\n<summary><img src=x onerror="alert(1)">Aman<script>x()</script></summary>\n\nIsi\n\n</details>\n',
    );
    const summary = el.querySelector('.mp-details-summary') as HTMLElement;
    expect(summary.querySelector('img, script')).toBeNull();
    expect(summary.textContent).toBe('Amanx()');
  });
});

describe('tabel dan pratinjau seperti GitHub', () => {
  it('header tabel kosong diberi class tipis kecuali sedang diedit', () => {
    const { c, el } = setup('Awal\n\n| | |\n|---|---|\n| a | b |\n');
    expect(el.querySelector('tr')?.className).toContain('mp-empty-header');
    const th = c.state.doc.child(1).firstChild?.firstChild;
    expect(th?.attrs.header).toBe(true);
    let thPos = -1;
    c.state.doc.descendants((node, pos) => {
      if (thPos < 0 && node.type.name === 'table_cell') thPos = pos;
    });
    c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, thPos + 1)));
    expect(el.querySelector('tr')?.className ?? '').not.toContain('mp-empty-header');
  });

  it('mermaid hanya menampilkan pratinjau di luar kursor; klik pratinjau membuka source', () => {
    const { c, el } = setup('Awal\n\n```mermaid\ngraph LR\n  A --> B\n```\n');
    const block = el.querySelector('.mp-code') as HTMLElement;
    expect(block.className).toContain('mp-preview-only');
    mousedown(block.querySelector('.mp-preview') as HTMLElement);
    expect(c.state.selection.$from.parent.type.name).toBe('code_block');
    expect((el.querySelector('.mp-code') as HTMLElement).className).not.toContain(
      'mp-preview-only',
    );
  });
});
