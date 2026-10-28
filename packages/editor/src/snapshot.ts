// SPDX-License-Identifier: LicenseRef-Proprietary
import type { GuardFailure, MarkName } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { type EditorState, NodeSelection } from 'prosemirror-state';
import type { SlashItemId } from './strings';

export type BlockTypeInfo =
  | { readonly type: 'paragraph' }
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { readonly type: 'code_block' }
  | { readonly type: 'raw_block' }
  | { readonly type: 'other' };

export type ListKind = 'bullet' | 'ordered' | 'task';

export interface SlashItem {
  readonly id: SlashItemId;
  readonly label: string;
}

export interface SlashState {
  readonly query: string;
  readonly items: readonly SlashItem[];
  readonly selectedIndex: number;
  /** Posisi layar kursor (untuk menempatkan menu), atau null jika tidak tersedia. */
  readonly anchorRect: { left: number; top: number; bottom: number } | null;
}

export interface LinkState {
  readonly href: string;
  readonly from: number;
  readonly to: number;
}

export interface ImageState {
  readonly pos: number;
  readonly src: string;
  readonly alt: string;
  readonly title: string | null;
}

export type ReadOnlyState =
  | { readonly reason: 'guard'; readonly failure: GuardFailure }
  | { readonly reason: 'host'; readonly message: string };

export interface Notice {
  readonly kind: 'error' | 'info';
  readonly message: string;
  readonly id: number;
}

export interface EditorSnapshot {
  readonly activeMarks: ReadonlySet<MarkName>;
  readonly blockType: BlockTypeInfo;
  readonly listKind: ListKind | null;
  readonly inQuote: boolean;
  readonly inTable: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly slash: SlashState | null;
  readonly link: LinkState | null;
  readonly image: ImageState | null;
  readonly zoom: number;
  readonly readOnly: ReadOnlyState | null;
  readonly dirty: boolean;
  readonly notice: Notice | null;
}

const MARKS: readonly MarkName[] = ['strong', 'em', 'strike', 'code', 'link'];

export function activeMarks(state: EditorState): Set<MarkName> {
  const { from, to, empty, $from } = state.selection;
  const out = new Set<MarkName>();
  for (const name of MARKS) {
    const type = state.schema.marks[name];
    if (!type) continue;
    const has = empty
      ? !!type.isInSet(state.storedMarks ?? $from.marks())
      : state.doc.rangeHasMark(from, to, type);
    if (has) out.add(name);
  }
  return out;
}

export function blockTypeOf(state: EditorState): BlockTypeInfo {
  const parent = state.selection.$from.parent;
  switch (parent.type.name) {
    case 'paragraph':
      return { type: 'paragraph' };
    case 'heading':
      return { type: 'heading', level: parent.attrs.level as 1 | 2 | 3 | 4 | 5 | 6 };
    case 'code_block':
      return { type: 'code_block' };
    case 'raw_block':
      return { type: 'raw_block' };
    default:
      return { type: 'other' };
  }
}

/** List terdekat yang memuat kursor: node, posisi, dan item yang memuat kursor. */
export function findList(
  state: EditorState,
): { list: Node; pos: number; item: Node; depth: number } | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') {
      const item = $from.node(d + 1);
      return { list: node, pos: $from.before(d), item, depth: d };
    }
  }
  return null;
}

export function listKindOf(state: EditorState): ListKind | null {
  const found = findList(state);
  if (!found) return null;
  if (found.item.attrs.checked !== null) return 'task';
  return found.list.type.name === 'ordered_list' ? 'ordered' : 'bullet';
}

export function hasAncestor(state: EditorState, name: string): boolean {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type.name === name) return true;
  return false;
}

export function linkAt(state: EditorState): LinkState | null {
  const type = state.schema.marks.link;
  if (!type) return null;
  const { $from, $to } = state.selection;
  if ($from.parent !== $to.parent) return null;
  // Rentang berturut-turut anak yang membawa mark link yang sama.
  const runs: { mark: import('prosemirror-model').Mark; from: number; to: number }[] = [];
  const start = $from.start();
  $from.parent.forEach((child, offset) => {
    const pos = start + offset;
    const mark = type.isInSet(child.marks);
    const last = runs[runs.length - 1];
    if (!mark) return;
    if (last && last.to === pos && last.mark.eq(mark)) last.to = pos + child.nodeSize;
    else runs.push({ mark, from: pos, to: pos + child.nodeSize });
  });
  const run = runs.find((r) => r.from <= $from.pos && $to.pos <= r.to && r.from < r.to);
  if (!run) return null;
  // Kursor tepat di tepi kiri link tidak dihitung berada di dalam link.
  if (state.selection.empty && $from.pos === run.from) return null;
  return { href: run.mark.attrs.href as string, from: run.from, to: run.to };
}

export function imageAt(state: EditorState): ImageState | null {
  const sel = state.selection;
  if (sel instanceof NodeSelection && sel.node.type.name === 'image') {
    const { src, alt, title } = sel.node.attrs as {
      src: string;
      alt: string;
      title: string | null;
    };
    return { pos: sel.from, src, alt, title };
  }
  return null;
}

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Kembalikan `prev` jika isi `next` sama, agar referensi snapshot stabil. */
export function stabilize(prev: EditorSnapshot | null, next: EditorSnapshot): EditorSnapshot {
  if (!prev) return next;
  const same =
    sameSet(prev.activeMarks, next.activeMarks) &&
    JSON.stringify(prev.blockType) === JSON.stringify(next.blockType) &&
    prev.listKind === next.listKind &&
    prev.inQuote === next.inQuote &&
    prev.inTable === next.inTable &&
    prev.canUndo === next.canUndo &&
    prev.canRedo === next.canRedo &&
    JSON.stringify(prev.slash) === JSON.stringify(next.slash) &&
    JSON.stringify(prev.link) === JSON.stringify(next.link) &&
    JSON.stringify(prev.image) === JSON.stringify(next.image) &&
    prev.zoom === next.zoom &&
    prev.readOnly === next.readOnly &&
    prev.dirty === next.dirty &&
    prev.notice === next.notice;
  return same ? prev : next;
}
