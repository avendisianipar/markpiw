// SPDX-License-Identifier: MIT
// Callout GitHub (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`). Di file
// tetap blockquote biasa; editor hanya menambah tampilan kotak berlabel lewat dekorasi.
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorStrings } from '../strings';

export const CALLOUT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

const MARKER = /^\[!(note|tip|important|warning|caution)\][ \t]*$/i;

/** Jenis callout jika `quote` diawali marker GitHub di baris pertamanya sendiri. */
export function calloutTypeOf(quote: Node): { type: CalloutType; markerSize: number } | null {
  const para = quote.firstChild;
  if (para?.type !== schema.nodes.paragraph) return null;
  const first = para.firstChild;
  if (!first?.isText) return null;
  const match = MARKER.exec(first.text ?? '');
  if (!match) return null;
  const next = para.childCount > 1 ? para.child(1) : null;
  if (next && next.type !== schema.nodes.soft_break && next.type !== schema.nodes.hard_break)
    return null;
  return {
    type: (match[1] as string).toLowerCase() as CalloutType,
    markerSize: first.nodeSize,
  };
}

/** Teks marker untuk jenis callout, mis. `[!NOTE]`. */
export const calloutMarker = (type: CalloutType) => `[!${type.toUpperCase()}]`;

function calloutDecorations(doc: Node, strings: EditorStrings): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.blockquote) return !node.isTextblock;
    const callout = calloutTypeOf(node);
    if (callout) {
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: `mp-callout mp-callout-${callout.type}`,
          'data-callout-label': strings.callouts[callout.type],
        }),
        // Marker tetap bisa diedit (mengubah jenis callout), hanya ditampilkan redup.
        Decoration.inline(pos + 2, pos + 2 + callout.markerSize, { class: 'mp-callout-marker' }),
      );
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

export function callouts(strings: EditorStrings): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    state: {
      init: (_config, state) => calloutDecorations(state.doc, strings),
      apply: (tr, prev) => (tr.docChanged ? calloutDecorations(tr.doc, strings) : prev),
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
