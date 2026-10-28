// SPDX-License-Identifier: LicenseRef-Proprietary
import { schema } from '@markpiw/markdown';
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
