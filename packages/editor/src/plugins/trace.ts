// SPDX-License-Identifier: MIT
// Chip ID trace (fitur spec): setiap kemunculan ID yang dikenal (mis. `FR-1`, `T3`) di teks
// diberi dekorasi agar tampil sebagai chip yang bisa di-hover dan Mod+klik untuk lompat ke
// section yang mendefinisikannya. Hanya dekorasi: isi dokumen tidak pernah diubah.
import type { Node } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface TraceState {
  readonly ids: ReadonlySet<string>;
  readonly decorations: DecorationSet;
}

export const traceKey = new PluginKey<TraceState>('markpiwTrace');

const EMPTY_IDS: ReadonlySet<string> = new Set();

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function patternFor(ids: ReadonlySet<string>): RegExp | null {
  if (ids.size === 0) return null;
  // ID terpanjang lebih dulu agar `FR-10` tidak terpotong menjadi `FR-1`.
  const alternatives = [...ids].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(?<![\\p{L}\\p{N}_-])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
}

/** Dekorasi chip untuk setiap ID dikenal di blok teks (bukan code block / blok mentah). */
export function traceDecorations(doc: Node, ids: ReadonlySet<string>): DecorationSet {
  const pattern = patternFor(ids);
  if (!pattern) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const name = node.type.name;
    if (name === 'code_block' || name === 'raw_block') return false;
    let first = true;
    node.forEach((child, offset) => {
      if (!child.isText) {
        first = false;
        return;
      }
      const text = child.text ?? '';
      const start = pos + 1 + offset;
      for (const match of text.matchAll(pattern)) {
        // ID di awal heading adalah definisinya sendiri.
        const definition = name === 'heading' && first && text.slice(0, match.index).trim() === '';
        decorations.push(
          Decoration.inline(start + match.index, start + match.index + match[0].length, {
            class: definition ? 'mp-trace-id mp-trace-def' : 'mp-trace-id',
            'data-trace-id': match[0],
          }),
        );
      }
      first = false;
    });
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

export function tracePlugin(onActivate: (id: string) => void): Plugin<TraceState> {
  return new Plugin<TraceState>({
    key: traceKey,
    state: {
      init: () => ({ ids: EMPTY_IDS, decorations: DecorationSet.empty }),
      apply(tr, prev) {
        const ids = tr.getMeta(traceKey) as ReadonlySet<string> | undefined;
        if (ids) return { ids, decorations: traceDecorations(tr.doc, ids) };
        if (!tr.docChanged || prev.ids.size === 0) return prev;
        return { ids: prev.ids, decorations: traceDecorations(tr.doc, prev.ids) };
      },
    },
    props: {
      decorations: (state) => traceKey.getState(state)?.decorations ?? null,
      handleClick(_view, _pos, event) {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const chip = (event.target as Element | null)?.closest?.('[data-trace-id]');
        const id = chip?.getAttribute('data-trace-id');
        if (!id) return false;
        onActivate(id);
        return true;
      },
    },
  });
}
