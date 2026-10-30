// SPDX-License-Identifier: MIT
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

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
