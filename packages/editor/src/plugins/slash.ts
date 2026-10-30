// SPDX-License-Identifier: MIT
// Slash command (spesifikasi 4.2): "/" di awal paragraf atau setelah spasi membuka menu.
import { schema } from '@markpiw/markdown';
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorController } from '../controller';
import type { SlashItem } from '../snapshot';
import type { EditorStrings, SlashGroupId, SlashItemId } from '../strings';

/** Item per kelompok, berurutan seperti tampilannya di slash menu dan toolbar. */
export const SLASH_GROUPS: readonly { id: SlashGroupId; items: readonly SlashItemId[] }[] = [
  { id: 'text', items: ['text', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] },
  { id: 'list', items: ['bullet', 'ordered', 'task'] },
  { id: 'block', items: ['quote', 'code'] },
  { id: 'insert', items: ['table', 'image', 'hr', 'link'] },
  { id: 'callout', items: ['note', 'tip', 'important', 'warning', 'caution'] },
  { id: 'advanced', items: ['math', 'mathInline', 'mermaid'] },
];

export const SLASH_ITEMS: readonly { id: SlashItemId; group: SlashGroupId }[] =
  SLASH_GROUPS.flatMap((group) => group.items.map((id) => ({ id, group: group.id })));

export interface SlashMatch {
  /** Posisi karakter "/". */
  readonly from: number;
  /** Posisi akhir query (kursor). */
  readonly to: number;
  readonly query: string;
}

interface SlashPluginState {
  readonly match: SlashMatch | null;
  readonly selectedIndex: number;
  /** Posisi "/" yang ditutup dengan Esc; menu tidak dibuka lagi untuk "/" itu. */
  readonly dismissed: number | null;
}

type SlashMeta =
  { type: 'move'; delta: number } | { type: 'select'; index: number } | { type: 'close' };

export const slashKey = new PluginKey<SlashPluginState>('markpiw-slash');

function findMatch(state: EditorState): SlashMatch | null {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type !== schema.nodes.paragraph) return null;
  const before = $from.parent.textBetween(0, $from.parentOffset, undefined, '￼');
  const m = /(?:^|\s)\/([^\n/]*)$/.exec(before);
  if (!m) return null;
  const query = m[1] as string;
  if (query.includes('  ') || query.length > 30) return null;
  const from = $from.pos - query.length - 1;
  return { from, to: $from.pos, query };
}

export function filterItems(query: string, strings: EditorStrings): SlashItem[] {
  const q = query.trim().toLowerCase();
  return SLASH_ITEMS.filter(({ id }) => {
    if (q === '') return true;
    const entry = strings.slash[id];
    return entry.label.toLowerCase().includes(q) || entry.aliases.some((a) => a.startsWith(q));
  }).map(({ id, group }) => ({ id, label: strings.slash[id].label, group }));
}

export function slashPlugin(controller: EditorController): Plugin<SlashPluginState> {
  const itemsOf = (state: EditorState) => {
    const s = slashKey.getState(state);
    return s?.match ? filterItems(s.match.query, controller.strings) : [];
  };
  return new Plugin<SlashPluginState>({
    key: slashKey,
    state: {
      init: () => ({ match: null, selectedIndex: 0, dismissed: null }),
      apply(tr, prev, _old, state) {
        const meta = tr.getMeta(slashKey) as SlashMeta | undefined;
        const dismissed =
          meta?.type === 'close'
            ? (prev.match?.from ?? null)
            : prev.dismissed !== null
              ? tr.mapping.map(prev.dismissed)
              : null;
        let match = findMatch(state);
        if (match && match.from === dismissed) match = null;
        if (match && filterItems(match.query, controller.strings).length === 0) match = null;
        let selectedIndex = match && prev.match?.query === match.query ? prev.selectedIndex : 0;
        if (match && meta?.type === 'move') {
          const count = filterItems(match.query, controller.strings).length;
          selectedIndex = (prev.selectedIndex + meta.delta + count) % count;
        }
        if (match && meta?.type === 'select') selectedIndex = meta.index;
        return { match, selectedIndex, dismissed: match ? null : dismissed };
      },
    },
    props: {
      handleKeyDown(view, event) {
        const s = slashKey.getState(view.state);
        if (!s?.match) return false;
        const move = (delta: number) => {
          view.dispatch(
            view.state.tr.setMeta(slashKey, { type: 'move', delta } satisfies SlashMeta),
          );
          return true;
        };
        switch (event.key) {
          case 'ArrowDown':
            return move(1);
          case 'ArrowUp':
            return move(-1);
          case 'Enter':
          case 'Tab': {
            const item = itemsOf(view.state)[s.selectedIndex];
            if (!item) return false;
            controller.runSlashItem(item.id);
            return true;
          }
          case 'Escape':
            view.dispatch(view.state.tr.setMeta(slashKey, { type: 'close' } satisfies SlashMeta));
            return true;
          default:
            return false;
        }
      },
    },
  });
}

/** Hapus teks "/query" (jika slash menu terbuka) lalu jalankan aksi item; dipakai juga toolbar. */
export function runSlashItem(controller: EditorController, id: SlashItemId): void {
  const s = slashKey.getState(controller.state);
  if (s?.match) controller.dispatch(controller.state.tr.delete(s.match.from, s.match.to));
  const c = controller.commands;
  switch (id) {
    case 'text':
      c.setBlock({ type: 'paragraph' });
      break;
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      c.setBlock({ type: 'heading', level: Number(id[1]) as 1 | 2 | 3 | 4 | 5 | 6 });
      break;
    case 'bullet':
    case 'ordered':
    case 'task':
      c.wrapList(id);
      break;
    case 'quote':
      c.toggleQuote();
      break;
    case 'code':
      c.setBlock({ type: 'code_block' });
      break;
    case 'table':
      c.insertTable(3, 3);
      break;
    case 'image':
      controller.requestUi('image');
      break;
    case 'hr':
      c.insertHorizontalRule();
      break;
    case 'link':
      controller.openLinkEditor();
      break;
    case 'note':
    case 'tip':
    case 'important':
    case 'warning':
    case 'caution':
      c.insertCallout(id);
      break;
    case 'math':
      c.insertMathBlock();
      break;
    case 'mathInline':
      c.insertMathInline();
      break;
    case 'mermaid':
      c.insertMermaid();
      break;
  }
}
