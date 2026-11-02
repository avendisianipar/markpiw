// SPDX-License-Identifier: MIT
// Pencarian di dokumen: sorot semua hasil, navigasi, dan membuka bagian yang tersembunyi.
import { TextSelection } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { findMatches } from '../src/plugins/search';
import { cursorAt, md, press, setup } from './util';

const text = 'Apel merah.\n\nJeruk dan apel hijau.\n\n```js\nconst apel = 1;\n```\n\nAPEL besar.\n';

const selected = (c: ReturnType<typeof setup>['c']) =>
  c.state.doc.textBetween(c.state.selection.from, c.state.selection.to);

describe('findMatches', () => {
  it('tidak membedakan huruf besar/kecil dan mencari per blok teks', () => {
    const { c } = setup(text);
    const matches = findMatches(c.state.doc, 'apel');
    expect(matches).toHaveLength(4);
    expect(matches.map((m) => c.state.doc.textBetween(m.from, m.to))).toEqual([
      'Apel',
      'apel',
      'apel',
      'APEL',
    ]);
  });

  it('kata kunci kosong atau karakter regex tidak membuat error', () => {
    const { c } = setup('a.b (c) [d]*\n');
    expect(findMatches(c.state.doc, '')).toEqual([]);
    expect(findMatches(c.state.doc, '(c)')).toHaveLength(1);
    expect(findMatches(c.state.doc, '.')).toHaveLength(1);
  });

  it('tidak mencocokkan melewati batas blok', () => {
    const { c } = setup('ujung\n\nawal\n');
    expect(findMatches(c.state.doc, 'ujungawal')).toEqual([]);
  });
});

describe('pencarian di editor', () => {
  it('membuka, menyorot semua hasil, dan memilih hasil pertama', () => {
    const { c, el } = setup(text);
    c.openSearch();
    expect(c.getSnapshot().search).toEqual({ query: '', total: 0, current: -1 });
    c.setSearchQuery('apel');
    expect(c.getSnapshot().search).toEqual({ query: 'apel', total: 4, current: 0 });
    expect(el.querySelectorAll('.mp-search-match')).toHaveLength(4);
    expect(el.querySelectorAll('.mp-search-current')).toHaveLength(1);
    expect(selected(c)).toBe('Apel');
  });

  it('maju dan mundur berputar di ujung', () => {
    const { c } = setup(text);
    c.openSearch();
    c.setSearchQuery('apel');
    c.searchStep(1);
    c.searchStep(1);
    c.searchStep(1);
    expect(c.getSnapshot().search?.current).toBe(3);
    expect(selected(c)).toBe('APEL');
    c.searchStep(1);
    expect(c.getSnapshot().search?.current).toBe(0);
    c.searchStep(-1);
    expect(c.getSnapshot().search?.current).toBe(3);
  });

  it('hasil pertama adalah yang terdekat setelah kursor', () => {
    const { c } = setup(text);
    cursorAt(c, 'Jeruk');
    c.openSearch();
    c.setSearchQuery('apel');
    expect(c.getSnapshot().search?.current).toBe(1);
  });

  it('tanpa hasil: hitungan nol dan selection tidak berubah', () => {
    const { c, el } = setup(text);
    cursorAt(c, 'Jeruk');
    const before = c.state.selection.from;
    c.openSearch();
    c.setSearchQuery('mangga');
    expect(c.getSnapshot().search).toEqual({ query: 'mangga', total: 0, current: -1 });
    expect(c.state.selection.from).toBe(before);
    expect(el.querySelector('.mp-search-match')).toBeNull();
  });

  it('teks yang sedang dipilih menjadi kata kunci awal', () => {
    const { c } = setup(text);
    let from = 0;
    c.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.startsWith('Jeruk')) from = pos;
    });
    c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, from, from + 5)));
    c.openSearch();
    expect(c.getSnapshot().search).toEqual({ query: 'Jeruk', total: 1, current: 0 });
  });

  it('membuka lagi saat sudah terbuka tidak mengganti kata kunci', () => {
    const { c } = setup(text);
    c.openSearch();
    c.setSearchQuery('apel');
    c.searchStep(1);
    c.openSearch();
    expect(c.getSnapshot().search).toEqual({ query: 'apel', total: 4, current: 1 });
  });

  it('menutup menghapus sorotan, tetap memilih hasil terakhir, dan file tidak berubah', () => {
    const { c, el } = setup(text);
    c.openSearch();
    c.setSearchQuery('apel');
    c.searchStep(1);
    c.closeSearch();
    expect(c.getSnapshot().search).toBeNull();
    expect(el.querySelector('.mp-search-match')).toBeNull();
    expect(selected(c)).toBe('apel');
    expect(md(c)).toBe(text);
  });

  it('hasil diperbarui saat dokumen berubah', () => {
    const { c } = setup(text);
    c.openSearch();
    c.setSearchQuery('apel');
    cursorAt(c, 'besar.');
    c.dispatch(c.state.tr.insertText(' apel'));
    expect(c.getSnapshot().search?.total).toBe(5);
  });

  it('Mod-f membuka pencarian dan meminta UI memfokuskan kotak cari', () => {
    const { c, view } = setup(text);
    const requests: string[] = [];
    c.onUiRequest((r) => requests.push(r));
    expect(press(view, 'Mod-f')).toBe(true);
    expect(c.getSnapshot().search).not.toBeNull();
    expect(requests).toEqual(['search']);
  });

  it('bisa dipakai saat read-only', () => {
    const { c } = setup(text);
    c.setReadOnly({ reason: 'host', message: 'baca saja' });
    c.openSearch();
    c.setSearchQuery('apel');
    expect(c.getSnapshot().search?.total).toBe(4);
  });
});

describe('hasil di bagian yang tersembunyi', () => {
  it('membuka <details> yang tertutup', () => {
    const { c, el } = setup(
      'Awal\n\n<details>\n<summary>Lihat</summary>\n\nRahasia\n\n</details>\n',
    );
    const body = () => [...el.querySelectorAll('p')].find((p) => p.textContent === 'Rahasia');
    expect(body()?.className).toContain('mp-html-collapsed');
    c.openSearch();
    c.setSearchQuery('rahasia');
    expect(body()?.className).not.toContain('mp-html-collapsed');
  });

  it('menampilkan source diagram yang hanya tampil sebagai pratinjau', () => {
    const { c, el } = setup('Awal\n\n```mermaid\ngraph LR\n  Simpul --> B\n```\n');
    expect(el.querySelector('.mp-code')?.className).toContain('mp-preview-only');
    c.openSearch();
    c.setSearchQuery('simpul');
    expect(el.querySelector('.mp-code')?.className).not.toContain('mp-preview-only');
  });
});
