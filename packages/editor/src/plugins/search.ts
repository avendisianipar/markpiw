// SPDX-License-Identifier: MIT
// Pencarian di dokumen (Ctrl/⌘+F). Hasil dicari per blok teks (termasuk code block dan source
// HTML), disorot lewat dekorasi, dan hasil aktif dijadikan selection editor. Karena selection
// berada di hasil, bagian yang tersembunyi (isi <details> tertutup, source diagram/rumus/HTML)
// ikut terbuka dengan mekanisme yang sama seperti saat pengguna menaruh kursor di sana.
import type { Node } from 'prosemirror-model';
import { Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

export interface SearchMatch {
  readonly from: number;
  readonly to: number;
}

export interface SearchPluginState {
  readonly query: string;
  readonly matches: readonly SearchMatch[];
  /** Indeks hasil aktif, atau -1 jika tidak ada hasil. */
  readonly current: number;
}

export const searchKey = new PluginKey<SearchPluginState>('markpiwSearch');

export const EMPTY_SEARCH: SearchPluginState = { query: '', matches: [], current: -1 };

/** Pengganti node inline non-teks (gambar, rumus inline, …) agar hasil tidak melompatinya. */
const OBJECT = '￼';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Semua kemunculan `query` (tanpa membedakan huruf besar/kecil) di setiap blok teks. */
export function findMatches(doc: Node, query: string): SearchMatch[] {
  if (query === '') return [];
  const pattern = new RegExp(escapeRegExp(query), 'giu');
  const matches: SearchMatch[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    node.forEach((child) => {
      text += child.isText ? (child.text as string) : OBJECT.repeat(child.nodeSize);
    });
    const start = pos + 1;
    for (const m of text.matchAll(pattern))
      matches.push({ from: start + m.index, to: start + m.index + m[0].length });
    return false;
  });
  return matches;
}

/** Indeks hasil pertama yang dimulai di/sesudah `pos`; berputar ke awal jika tidak ada. */
export function firstFrom(matches: readonly SearchMatch[], pos: number): number {
  if (matches.length === 0) return -1;
  const at = matches.findIndex((m) => m.from >= pos);
  return at >= 0 ? at : 0;
}

function apply(tr: Transaction, prev: SearchPluginState): SearchPluginState {
  const meta = tr.getMeta(searchKey) as SearchPluginState | undefined;
  if (meta) return meta;
  if (!tr.docChanged || prev.query === '') return prev;
  // Dokumen berubah saat pencarian terbuka: hitung ulang, pertahankan posisi hasil aktif.
  const matches = findMatches(tr.doc, prev.query);
  const anchor = prev.matches[prev.current];
  return {
    query: prev.query,
    matches,
    current: firstFrom(matches, anchor ? tr.mapping.map(anchor.from) : 0),
  };
}

export function searchPlugin(): Plugin<SearchPluginState> {
  return new Plugin<SearchPluginState>({
    key: searchKey,
    state: { init: () => EMPTY_SEARCH, apply },
    props: {
      decorations(state) {
        const search = searchKey.getState(state);
        if (!search || search.matches.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          search.matches.map((m, i) =>
            Decoration.inline(m.from, m.to, {
              class: i === search.current ? 'mp-search-match mp-search-current' : 'mp-search-match',
            }),
          ),
        );
      },
    },
  });
}

/**
 * Pasang state pencarian pada transaksi; jika ada hasil aktif, hasil itu dijadikan selection
 * dan digulir ke layar.
 */
export function withSearch(tr: Transaction, next: SearchPluginState): Transaction {
  tr.setMeta(searchKey, next);
  const match = next.matches[next.current];
  if (match) tr.setSelection(TextSelection.create(tr.doc, match.from, match.to)).scrollIntoView();
  return tr;
}

function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight)
      return node;
  }
  return null;
}

/**
 * Gulir hasil ke tengah area yang terlihat jika belum terlihat utuh. Bagian atas area dikurangi
 * `topInset` (kotak cari mengambang di sana).
 */
export function revealMatch(view: EditorView, match: SearchMatch, topInset = 56): void {
  let rect: { top: number; bottom: number };
  try {
    rect = view.coordsAtPos(match.from);
  } catch {
    return;
  }
  const container = scrollParent(view.dom);
  const bounds = container
    ? container.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };
  if (rect.top >= bounds.top + topInset && rect.bottom <= bounds.bottom) return;
  const middle = (bounds.top + topInset + bounds.bottom) / 2;
  const delta = rect.top - middle;
  if (container) container.scrollTop += delta;
  else window.scrollBy(0, delta);
}
