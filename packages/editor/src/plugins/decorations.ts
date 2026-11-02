// SPDX-License-Identifier: MIT
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { renderHtmlBlock } from '../html-render';
import { previewKindOf } from '../nodeviews';
import { selectionTouches } from './active';

/** Placeholder pada paragraf kosong yang sedang aktif (atau dokumen kosong). */
export function placeholder(text: string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { $from, empty } = state.selection;
        const parent = $from.parent;
        if (!empty || parent.type !== schema.nodes.paragraph || parent.content.size > 0)
          return null;
        const pos = $from.before();
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + parent.nodeSize, {
            class: 'mp-placeholder',
            'data-placeholder': text,
          }),
        ]);
      },
    },
  });
}

/** Dekorasi class rata kolom (`mp-align-*`) untuk setiap sel tabel di `doc`. */
function alignmentDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.table) return !node.isTextblock;
    const align = node.attrs.align as readonly (string | null)[];
    if (align.every((a) => a === null)) return false;
    let rowPos = pos + 1;
    node.forEach((row) => {
      let cellPos = rowPos + 1;
      row.forEach((cell, _offset, c) => {
        const value = align[c];
        if (value)
          decorations.push(
            Decoration.node(cellPos, cellPos + cell.nodeSize, { class: `mp-align-${value}` }),
          );
        cellPos += cell.nodeSize;
      });
      rowPos += row.nodeSize;
    });
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * Rata kolom tabel GFM tersimpan di atribut `align` tabel, bukan di sel; tampilkan lewat class
 * (CSP melarang atribut `style` inline).
 */
export function tableAlignment(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    state: {
      init: (_config, state) => alignmentDecorations(state.doc),
      apply: (tr, prev) => (tr.docChanged ? alignmentDecorations(tr.doc) : prev),
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

/**
 * Menjamin ada paragraf setelah blok terakhir yang sulit ditinggalkan kursor (tabel, garis,
 * list, kutipan, kode). Paragraf/heading terakhir dibiarkan agar undo input rule tetap jalan.
 */
export function trailingParagraph(): Plugin {
  return new Plugin({
    appendTransaction(_trs, _old, state) {
      const last = state.doc.lastChild;
      if (!last || last.type === schema.nodes.paragraph || last.type === schema.nodes.heading) {
        return null;
      }
      return state.tr.insert(state.doc.content.size, schema.nodes.paragraph.create());
    },
  });
}

/** Posisi baris header tabel yang semua selnya kosong (`| | |`). */
function emptyHeaderRows(doc: Node): { from: number; to: number }[] {
  const rows: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.table) return !node.isTextblock;
    const head = node.firstChild;
    if (head?.firstChild?.attrs.header === true && head.textContent === '' && head.childCount > 0) {
      let empty = true;
      head.forEach((cell) => {
        if (cell.childCount > 0) empty = false;
      });
      if (empty) rows.push({ from: pos + 1, to: pos + 1 + head.nodeSize });
    }
    return false;
  });
  return rows;
}

/**
 * Header tabel kosong dibuat setipis di GitHub (class `mp-empty-header`), kecuali saat kursor
 * ada di dalamnya agar tetap bisa diketik.
 */
export function emptyTableHeader(): Plugin<{ from: number; to: number }[]> {
  return new Plugin<{ from: number; to: number }[]>({
    state: {
      init: (_config, state) => emptyHeaderRows(state.doc),
      apply: (tr, prev) => (tr.docChanged ? emptyHeaderRows(tr.doc) : prev),
    },
    props: {
      decorations(state) {
        const rows = this.getState(state) ?? [];
        if (rows.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          rows
            .filter((row) => !selectionTouches(state, row.from, row.to))
            .map((row) => Decoration.node(row.from, row.to, { class: 'mp-empty-header' })),
        );
      },
    },
  });
}

/** Blok yang punya pratinjau (```mermaid, ```math, `$$`, blok HTML lengkap yang aman). */
function previewBlockRanges(doc: Node): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    const preview =
      node.type === schema.nodes.math_block ||
      (node.type === schema.nodes.code_block &&
        previewKindOf(node.attrs.lang as string) !== null) ||
      (node.type === schema.nodes.raw_block &&
        node.attrs.kind === 'html' &&
        renderHtmlBlock(node.textContent) !== null);
    if (preview) ranges.push({ from: pos, to: pos + node.nodeSize });
    return !node.isTextblock;
  });
  return ranges;
}

/**
 * Seperti GitHub, diagram dan rumus hanya menampilkan hasil render (`mp-preview-only`);
 * source-nya muncul saat kursor masuk ke blok (klik pratinjau untuk mengedit).
 */
export function previewBlocks(): Plugin<{ from: number; to: number }[]> {
  return new Plugin<{ from: number; to: number }[]>({
    state: {
      init: (_config, state) => previewBlockRanges(state.doc),
      apply: (tr, prev) => (tr.docChanged ? previewBlockRanges(tr.doc) : prev),
    },
    props: {
      decorations(state) {
        const ranges = this.getState(state) ?? [];
        if (ranges.length === 0) return null;
        return DecorationSet.create(
          state.doc,
          ranges
            .filter((r) => !selectionTouches(state, r.from, r.to))
            .map((r) => Decoration.node(r.from, r.to, { class: 'mp-preview-only' })),
        );
      },
    },
  });
}
