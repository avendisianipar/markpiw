// SPDX-License-Identifier: MIT
// Tata letak HTML ala GitHub tanpa memasukkan HTML dokumen ke DOM. GitHub meneruskan tag blok
// yang aman (`<div align="center">`, `<details>`/`<summary>`) sehingga blok Markdown di antara
// tag pembuka dan penutup ikut rata tengah atau terlipat. Di sini pasangan tag itu dikenali di
// antara blok bersaudara; tag-nya disembunyikan dan isinya diberi class lewat dekorasi. Source
// tag baru terlihat (untuk diedit) saat kursor berada di dalam wilayahnya.
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import {
  Plugin,
  PluginKey,
  Selection,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { renderSummary } from '../html-render';
import { selectionTouches } from './active';

type Align = 'left' | 'center' | 'right';

interface Opener {
  tag: 'div' | 'p' | 'details';
  align: Align | null;
  /** Isi `<summary>` (HTML mentah) untuk `<details>`. */
  summary: string | null;
  open: boolean;
}

const OPEN_BLOCK = /^<(div|p)((?:\s+[a-z-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*>$/i;
const ALIGN_ATTR = /\balign\s*=\s*["']?(left|center|right)["']?/i;
const OPEN_DETAILS =
  /^<details(\s+open(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)?\s*>\s*(?:<summary>([\s\S]*?)<\/summary>)?$/i;
const CLOSE = /^<\/(div|p|details)\s*>$/i;

/** Tag pembuka yang dikenali dari isi raw block HTML, atau null. */
export function parseOpener(source: string): Opener | null {
  const text = source.trim();
  const details = OPEN_DETAILS.exec(text);
  if (details)
    return { tag: 'details', align: null, summary: details[2] ?? null, open: !!details[1] };
  const block = OPEN_BLOCK.exec(text);
  if (!block) return null;
  const align = ALIGN_ATTR.exec(block[2] ?? '');
  return {
    tag: (block[1] as string).toLowerCase() as 'div' | 'p',
    align: align ? ((align[1] as string).toLowerCase() as Align) : null,
    summary: null,
    open: true,
  };
}

function parseCloser(source: string): string | null {
  const m = CLOSE.exec(source.trim());
  return m ? (m[1] as string).toLowerCase() : null;
}

export interface HtmlRegion {
  /** Posisi raw block pembuka dan penutup. */
  openPos: number;
  openEnd: number;
  closePos: number;
  closeEnd: number;
  opener: Opener;
  /** Blok-blok isi di antara keduanya. */
  children: { pos: number; end: number }[];
}

function isHtmlBlock(node: Node): boolean {
  return node.type === schema.nodes.raw_block && node.attrs.kind === 'html';
}

/** Cari pasangan tag pembuka/penutup di antara anak-anak setiap node blok. */
export function findRegions(doc: Node): HtmlRegion[] {
  const regions: HtmlRegion[] = [];
  const scan = (parent: Node, start: number) => {
    const stack: { pos: number; end: number; opener: Opener; index: number }[] = [];
    const blocks: { pos: number; end: number }[] = [];
    parent.forEach((child, offset) => {
      const pos = start + offset;
      const end = pos + child.nodeSize;
      blocks.push({ pos, end });
      if (isHtmlBlock(child)) {
        const opener = parseOpener(child.textContent);
        if (opener) {
          stack.push({ pos, end, opener, index: blocks.length });
          return;
        }
        const closer = parseCloser(child.textContent);
        if (closer) {
          // Penutup tanpa pasangan (atau salah pasangan) dibiarkan sebagai raw block biasa.
          const at = stack.map((s) => s.opener.tag).lastIndexOf(closer as Opener['tag']);
          if (at >= 0) {
            const open = stack[at] as (typeof stack)[number];
            stack.length = at;
            regions.push({
              openPos: open.pos,
              openEnd: open.end,
              closePos: pos,
              closeEnd: end,
              opener: open.opener,
              children: blocks.slice(open.index, blocks.length - 1),
            });
          }
          return;
        }
      }
      if (!child.isTextblock && !child.isAtom && child.type !== schema.nodes.table)
        scan(child, pos + 1);
    });
  };
  scan(doc, 0);
  return regions.sort((a, b) => a.openPos - b.openPos);
}

interface HtmlState {
  regions: HtmlRegion[];
  /** Posisi pembuka `<details>` yang statusnya dibalik pengguna (terbuka ↔ tertutup). */
  toggled: number[];
}

export const htmlLayoutKey = new PluginKey<HtmlState>('markpiwHtmlLayout');

function summaryDOM(
  view: EditorView,
  region: HtmlRegion,
  open: boolean,
  label: string,
): HTMLElement {
  const summary = document.createElement('div');
  summary.className = 'mp-details-summary';
  summary.contentEditable = 'false';
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', String(open));
  summary.dataset.open = String(open);
  summary.title = label;
  const text = document.createElement('span');
  if (region.opener.summary === null || region.opener.summary.trim() === '')
    text.textContent = 'Details';
  else renderSummary(region.opener.summary, text);
  summary.append(text);
  summary.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const { state } = view;
    const live = htmlLayoutKey.getState(state)?.regions.find((r) => r.openPos === region.openPos);
    if (!live) return;
    const tr = state.tr.setMeta(htmlLayoutKey, { toggle: live.openPos });
    // Menutup saat kursor di dalamnya: pindahkan kursor ke setelah </details> agar isi terlipat.
    if (open && selectionTouches(state, live.openPos, live.closeEnd))
      tr.setSelection(Selection.near(tr.doc.resolve(live.closeEnd)));
    view.dispatch(tr);
  });
  return summary;
}

function layoutDecorations(state: EditorState, html: HtmlState, label: string): DecorationSet {
  const decorations: Decoration[] = [];
  for (const region of html.regions) {
    const editing = selectionTouches(state, region.openPos, region.closeEnd);
    const tagClass = editing ? 'mp-html-tag mp-html-tag-active' : 'mp-html-tag';
    decorations.push(
      Decoration.node(region.openPos, region.openEnd, { class: tagClass }),
      Decoration.node(region.closePos, region.closeEnd, { class: tagClass }),
    );
    if (region.opener.tag === 'details') {
      const open = region.opener.open !== html.toggled.includes(region.openPos);
      // Isi yang sedang disentuh kursor selalu terlihat (mis. setelah undo atau pencarian).
      const visible = open || editing;
      decorations.push(
        Decoration.widget(region.openPos, (view) => summaryDOM(view, region, visible, label), {
          side: -1,
          key: `details-${region.openPos}-${visible}-${region.opener.summary ?? ''}`,
          ignoreSelection: true,
          stopEvent: () => true,
        }),
      );
      for (const child of region.children)
        decorations.push(
          Decoration.node(child.pos, child.end, {
            class: visible ? 'mp-details-body' : 'mp-details-body mp-html-collapsed',
          }),
        );
    } else if (region.opener.align) {
      for (const child of region.children)
        decorations.push(
          Decoration.node(child.pos, child.end, { class: `mp-html-align-${region.opener.align}` }),
        );
    }
  }
  return DecorationSet.create(state.doc, decorations);
}

function applyState(tr: Transaction, prev: HtmlState): HtmlState {
  const meta = tr.getMeta(htmlLayoutKey) as { toggle: number } | undefined;
  let toggled = prev.toggled;
  if (tr.docChanged)
    toggled = toggled
      .map((pos) => tr.mapping.mapResult(pos))
      .filter((r) => !r.deleted)
      .map((r) => r.pos);
  if (meta)
    toggled = toggled.includes(meta.toggle)
      ? toggled.filter((pos) => pos !== meta.toggle)
      : [...toggled, meta.toggle];
  const regions = tr.docChanged ? findRegions(tr.doc) : prev.regions;
  if (!tr.docChanged && toggled === prev.toggled) return prev;
  return { regions, toggled };
}

export function htmlLayout(toggleLabel: string): Plugin<HtmlState> {
  return new Plugin<HtmlState>({
    key: htmlLayoutKey,
    state: {
      init: (_config, state) => ({ regions: findRegions(state.doc), toggled: [] }),
      apply: applyState,
    },
    props: {
      decorations(state) {
        const html = htmlLayoutKey.getState(state);
        return html && html.regions.length > 0 ? layoutDecorations(state, html, toggleLabel) : null;
      },
    },
  });
}
