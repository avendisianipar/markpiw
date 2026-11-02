// SPDX-License-Identifier: MIT
// Callout GitHub (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`). Di file
// tetap blockquote biasa; editor menampilkannya seperti GitHub lewat dekorasi: judul berikon,
// marker disembunyikan dan baru muncul (di barisnya sendiri) saat kursor berada di sana.
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { Plugin, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { EditorStrings } from '../strings';
import { headWithin } from './active';

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

// Ikon judul (path Lucide, ISC; paket yang sama dipakai toolbar), setara octicon di GitHub.
const ICONS: Record<CalloutType, readonly string[]> = {
  note: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  tip: [
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6',
    'M10 22h4',
  ],
  important: [
    'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z',
    'M12 15h.01',
    'M12 7v4',
  ],
  warning: [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  caution: [
    'M12 16h.01',
    'M12 8v4',
    'M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z',
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function titleDOM(type: CalloutType, label: string): HTMLElement {
  const title = document.createElement('div');
  title.className = 'mp-callout-title';
  title.contentEditable = 'false';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'mp-callout-icon');
  for (const d of ICONS[type]) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  title.append(svg, label);
  return title;
}

interface CalloutInfo {
  pos: number;
  end: number;
  type: CalloutType;
  /** Rentang teks marker `[!NOTE]`. */
  markerFrom: number;
  markerTo: number;
  /** Akhir pindah baris setelah marker (sama dengan markerTo jika tidak ada). */
  breakTo: number;
}

function findCallouts(doc: Node): CalloutInfo[] {
  const found: CalloutInfo[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.blockquote) return !node.isTextblock;
    const callout = calloutTypeOf(node);
    if (callout) {
      const markerFrom = pos + 2;
      const markerTo = markerFrom + callout.markerSize;
      const para = node.firstChild as Node;
      const next = para.childCount > 1 ? para.child(1) : null;
      found.push({
        pos,
        end: pos + node.nodeSize,
        type: callout.type,
        markerFrom,
        markerTo,
        breakTo: next ? markerTo + next.nodeSize : markerTo,
      });
    }
    return true;
  });
  return found;
}

function calloutDecorations(
  state: EditorState,
  found: readonly CalloutInfo[],
  strings: EditorStrings,
): DecorationSet {
  const decorations: Decoration[] = [];
  for (const c of found) {
    const label = strings.callouts[c.type];
    // Marker terlihat hanya saat kursor di marker itu atau tepat di awal baris isi pertama.
    const editing = headWithin(state, c.markerFrom, c.breakTo);
    const shown = editing ? 'mp-callout-marker-shown' : 'mp-callout-marker-hidden';
    decorations.push(
      Decoration.node(c.pos, c.end, {
        class: `mp-callout mp-callout-${c.type}`,
        'data-callout-label': label,
      }),
      Decoration.widget(c.pos + 1, () => titleDOM(c.type, label), {
        side: -1,
        key: `callout-title-${c.type}-${label}`,
        ignoreSelection: true,
      }),
      Decoration.inline(c.markerFrom, c.markerTo, { class: `mp-callout-marker ${shown}` }),
    );
    if (c.breakTo > c.markerTo)
      decorations.push(
        Decoration.inline(c.markerTo, c.breakTo, { class: `mp-callout-break ${shown}` }),
      );
  }
  return DecorationSet.create(state.doc, decorations);
}

export function callouts(strings: EditorStrings): Plugin<CalloutInfo[]> {
  return new Plugin<CalloutInfo[]>({
    state: {
      init: (_config, state) => findCallouts(state.doc),
      apply: (tr, prev) => (tr.docChanged ? findCallouts(tr.doc) : prev),
    },
    props: {
      decorations(state) {
        return calloutDecorations(state, this.getState(state) ?? [], strings);
      },
    },
  });
}
