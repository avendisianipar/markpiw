// SPDX-License-Identifier: MIT
// Syntax highlighting code block lewat lowlight (highlight.js). Hasilnya dekorasi inline ber-class
// `hljs-*`; teks dokumen dan file tidak berubah. Bahasa diambil dari kata pertama info string.
import { schema } from '@markpiw/markdown';
import type { Element, ElementContent, Root } from 'hast';
import { common, createLowlight } from 'lowlight';
import type { Node } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

const lowlight = createLowlight(common);

interface Token {
  readonly from: number;
  readonly to: number;
  readonly className: string;
}

/** Bahasa highlight.js untuk info string code block, atau null jika tidak dikenal. */
export function highlightLanguage(info: string): string | null {
  const lang = info.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return lang !== '' && lowlight.registered(lang) ? lang : null;
}

function collect(nodes: readonly ElementContent[], classes: string[], out: Token[], at: number) {
  let offset = at;
  for (const node of nodes) {
    if (node.type === 'text') {
      const end = offset + node.value.length;
      if (classes.length > 0) out.push({ from: offset, to: end, className: classes.join(' ') });
      offset = end;
    } else if (node.type === 'element') {
      const own = (node as Element).properties.className;
      const names = Array.isArray(own) ? own.map(String) : [];
      offset = collect(node.children, [...classes, ...names], out, offset);
    }
  }
  return offset;
}

// Token per node code block: node yang sama (tidak diedit) tidak di-highlight ulang.
const cache = new WeakMap<Node, readonly Token[]>();

export function tokensOf(node: Node): readonly Token[] {
  let tokens = cache.get(node);
  if (!tokens) {
    const lang = highlightLanguage(node.attrs.lang as string);
    const found: Token[] = [];
    if (lang && node.textContent !== '') {
      const tree: Root = lowlight.highlight(lang, node.textContent);
      collect(tree.children as ElementContent[], [], found, 0);
    }
    tokens = found;
    cache.set(node, tokens);
  }
  return tokens;
}

function highlightDecorations(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type === schema.nodes.code_block) {
      for (const t of tokensOf(node))
        decorations.push(
          Decoration.inline(pos + 1 + t.from, pos + 1 + t.to, { class: t.className }),
        );
      return false;
    }
    return !node.isTextblock;
  });
  return DecorationSet.create(doc, decorations);
}

export function syntaxHighlight(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    state: {
      init: (_config, state) => highlightDecorations(state.doc),
      apply: (tr, prev) => (tr.docChanged ? highlightDecorations(tr.doc) : prev),
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
