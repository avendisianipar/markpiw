// SPDX-License-Identifier: LicenseRef-Proprietary
// Perintah editor (spesifikasi 4.1). Semua perintah aman dipanggil kapan saja: jika tidak
// berlaku pada posisi kursor, perintah tidak melakukan apa-apa.
import type { FileHost } from '@markpiw/host';
import { schema } from '@markpiw/markdown';
import { lift, setBlockType, toggleMark as pmToggleMark, wrapIn } from 'prosemirror-commands';
import { redo as historyRedo, undo as historyUndo } from 'prosemirror-history';
import type { Node, NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import {
  type Command,
  type EditorState,
  NodeSelection,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { isSafeHref, isSafeImageSrc } from './safety';
import { findList, hasAncestor, linkAt, type ListKind } from './snapshot';
import { findCell, tableCommands, type TableAlign } from './table';

export interface CommandContext {
  getState(): EditorState;
  getView(): EditorView | null;
  readonly host: FileHost;
  dispatch(tr: Transaction): void;
  setZoom(zoom: number): void;
  notify(kind: 'error' | 'info', message: string): void;
  /** Tandai upload gambar yang sedang berjalan (host menunda simpan selama ada). */
  uploadStarted(): void;
  uploadFinished(): void;
  readonly imageSaveFailedMessage: string;
}

export type MarkCommandName = 'strong' | 'em' | 'strike' | 'code';
export type BlockCommand =
  | { type: 'paragraph' }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'code_block' };

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

export class EditorCommands {
  constructor(private readonly ctx: CommandContext) {}

  /** Jalankan perintah ProseMirror; kembalikan apakah berlaku. */
  run(command: Command): boolean {
    const { ctx } = this;
    const ok = command(ctx.getState(), (tr) => ctx.dispatch(tr), ctx.getView() ?? undefined);
    ctx.getView()?.focus();
    return ok;
  }

  toggleMark(name: MarkCommandName): boolean {
    const type = schema.marks[name];
    return this.run(pmToggleMark(type));
  }

  setBlock(block: BlockCommand): boolean {
    if (block.type === 'heading')
      return this.run(setBlockType(schema.nodes.heading, { level: block.level }));
    return this.run(setBlockType(schema.nodes[block.type]));
  }

  toggleQuote(): boolean {
    if (hasAncestor(this.ctx.getState(), 'blockquote')) return this.run(lift);
    return this.run(wrapIn(schema.nodes.blockquote));
  }

  wrapList(kind: ListKind): boolean {
    const found = findList(this.ctx.getState());
    const listType = kind === 'ordered' ? schema.nodes.ordered_list : schema.nodes.bullet_list;
    if (found) {
      const current: ListKind =
        found.item.attrs.checked !== null
          ? 'task'
          : found.list.type.name === 'ordered_list'
            ? 'ordered'
            : 'bullet';
      if (current === kind) return this.run(liftListItem(schema.nodes.list_item));
      return this.run((state, dispatch) => {
        if (dispatch)
          dispatch(convertList(state.tr, found.pos, found.list, listType, kind === 'task'));
        return true;
      });
    }
    const wrapped = this.run(wrapInList(listType));
    if (wrapped && kind === 'task') {
      const after = findList(this.ctx.getState());
      if (after)
        this.ctx.dispatch(
          convertList(this.ctx.getState().tr, after.pos, after.list, listType, true),
        );
    }
    return wrapped;
  }

  liftList(): boolean {
    return this.run(liftListItem(schema.nodes.list_item));
  }

  sinkList(): boolean {
    return this.run(sinkListItem(schema.nodes.list_item));
  }

  /** Ubah status checkbox task item di posisi `pos`. */
  toggleTask(pos: number): boolean {
    const node = this.ctx.getState().doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.list_item || node.attrs.checked === null) return false;
    this.ctx.dispatch(
      this.ctx
        .getState()
        .tr.setNodeMarkup(pos, null, { ...node.attrs, checked: !node.attrs.checked }),
    );
    return true;
  }

  insertTable(rows: number, cols: number): boolean {
    const cell = (header: boolean) => schema.nodes.table_cell.create({ header });
    const row = (header: boolean) =>
      schema.nodes.table_row.create(
        null,
        Array.from({ length: cols }, () => cell(header)),
      );
    const table = schema.nodes.table.create({ align: Array.from({ length: cols }, () => null) }, [
      row(true),
      ...Array.from({ length: Math.max(1, rows - 1) }, () => row(false)),
    ]);
    return this.insertBlock(table, (tr, at) => TextSelection.create(tr.doc, at + 3));
  }

  insertHorizontalRule(): boolean {
    return this.insertBlock(schema.nodes.horizontal_rule.create(), (tr, at) => {
      const after = at + 1;
      return TextSelection.near(tr.doc.resolve(Math.min(after, tr.doc.content.size)));
    });
  }

  insertCodeBlock(): boolean {
    return this.setBlock({ type: 'code_block' });
  }

  /** Sisipkan blok setelah textblock aktif (atau gantikan paragraf kosong). */
  private insertBlock(
    node: Node,
    select: (tr: Transaction, at: number) => import('prosemirror-state').Selection,
  ): boolean {
    const state = this.ctx.getState();
    const $from = state.selection.$from;
    let depth = $from.depth;
    while (depth > 0 && !$from.node(depth).isTextblock) depth--;
    const tr = state.tr;
    let at: number;
    const block = $from.node(depth);
    const insideTable = hasAncestor(state, 'table');
    if (
      depth > 0 &&
      block.type === schema.nodes.paragraph &&
      block.content.size === 0 &&
      !insideTable
    ) {
      at = $from.before(depth);
      tr.replaceWith(at, $from.after(depth), node);
    } else {
      // Naik ke anak tingkat dokumen jika di dalam tabel; selain itu sisipkan setelah blok aktif.
      const targetDepth = insideTable ? 1 : Math.max(depth, 1);
      at = $from.after(targetDepth);
      if (
        !tr.doc
          .resolve(at)
          .parent.canReplaceWith(tr.doc.resolve(at).index(), tr.doc.resolve(at).index(), node.type)
      ) {
        at = $from.after(1);
      }
      tr.insert(at, node);
    }
    tr.setSelection(select(tr, at)).scrollIntoView();
    this.ctx.dispatch(tr);
    this.ctx.getView()?.focus();
    return true;
  }

  tableAddRow(side: 'before' | 'after' = 'after'): boolean {
    return this.run(tableCommands.addRow(side));
  }
  tableAddColumn(side: 'before' | 'after' = 'after'): boolean {
    return this.run(tableCommands.addColumn(side));
  }
  tableDeleteRow(): boolean {
    return this.run(tableCommands.deleteRow());
  }
  tableDeleteColumn(): boolean {
    return this.run(tableCommands.deleteColumn());
  }
  tableSetAlign(align: TableAlign): boolean {
    return this.run(tableCommands.setAlign(align));
  }
  inTable(): boolean {
    return findCell(this.ctx.getState()) !== null;
  }

  setLink(href: string): boolean {
    const target = href.trim();
    if (target === '') return this.removeLink();
    const state = this.ctx.getState();
    const type = schema.marks.link;
    const mark = type.create({ href: target, title: null, kind: 'inline', refLabel: null });
    const existing = linkAt(state);
    const tr = state.tr;
    if (existing) {
      tr.removeMark(existing.from, existing.to, type).addMark(existing.from, existing.to, mark);
    } else if (!state.selection.empty) {
      tr.addMark(state.selection.from, state.selection.to, mark);
    } else {
      const text = schema.text(target, [mark]);
      tr.replaceSelectionWith(text, false);
    }
    this.ctx.dispatch(tr);
    this.ctx.getView()?.focus();
    return true;
  }

  removeLink(): boolean {
    const state = this.ctx.getState();
    const existing = linkAt(state);
    const [from, to] = existing
      ? [existing.from, existing.to]
      : [state.selection.from, state.selection.to];
    if (from === to) return false;
    this.ctx.dispatch(state.tr.removeMark(from, to, schema.marks.link));
    this.ctx.getView()?.focus();
    return true;
  }

  openLink(href: string): void {
    if (isSafeHref(href)) this.ctx.host.openLink(href);
  }

  insertImage(src: string, alt = ''): boolean {
    if (!isSafeImageSrc(src)) return false;
    const node = schema.nodes.image.create({ src, alt, title: null });
    this.ctx.dispatch(this.ctx.getState().tr.replaceSelectionWith(node).scrollIntoView());
    this.ctx.getView()?.focus();
    return true;
  }

  /**
   * Simpan file gambar lewat host lalu sisipkan. Selama menyimpan, gambar tampil dengan URL
   * `blob:` sementara; jika gagal, node dihapus dan notifikasi ditampilkan.
   */
  async insertImageFile(file: Blob, at?: number): Promise<boolean> {
    if (!IMAGE_MIMES.has(file.type)) return false;
    this.ctx.uploadStarted();
    try {
      return await this.uploadImage(file, at);
    } finally {
      this.ctx.uploadFinished();
    }
  }

  private async uploadImage(file: Blob, at?: number): Promise<boolean> {
    const temp =
      typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : 'blob:pending';
    const marker = `${temp}#${Math.random().toString(36).slice(2)}`;
    const node = schema.nodes.image.create({ src: marker, alt: '', title: null });
    const tr = this.ctx.getState().tr;
    if (at === undefined) tr.replaceSelectionWith(node);
    else tr.insert(at, node);
    this.ctx.dispatch(tr);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const saved = await this.ctx.host.saveAsset(bytes, file.type);
    const pos = findImage(this.ctx.getState().doc, marker);
    if (pos === null) return false;
    if (saved.ok) {
      const current = this.ctx.getState().doc.nodeAt(pos) as Node;
      this.ctx.dispatch(
        this.ctx.getState().tr.setNodeMarkup(pos, null, { ...current.attrs, src: saved.value }),
      );
    } else {
      this.ctx.dispatch(this.ctx.getState().tr.delete(pos, pos + 1));
      this.ctx.notify('error', this.ctx.imageSaveFailedMessage);
    }
    if (temp.startsWith('blob:') && typeof URL.revokeObjectURL === 'function')
      URL.revokeObjectURL(temp);
    return saved.ok;
  }

  setImageAttrs(pos: number, attrs: { src?: string; alt?: string }): boolean {
    const node = this.ctx.getState().doc.nodeAt(pos);
    if (!node || node.type !== schema.nodes.image) return false;
    if (attrs.src !== undefined && !isSafeImageSrc(attrs.src)) return false;
    const tr = this.ctx.getState().tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs });
    tr.setSelection(NodeSelection.create(tr.doc, pos));
    this.ctx.dispatch(tr);
    return true;
  }

  undo(): boolean {
    const { host } = this.ctx;
    if (host.historyMode === 'host') {
      host.undo?.();
      return true;
    }
    return this.run(historyUndo);
  }

  redo(): boolean {
    const { host } = this.ctx;
    if (host.historyMode === 'host') {
      host.redo?.();
      return true;
    }
    return this.run(historyRedo);
  }

  setZoom(zoom: number): void {
    this.ctx.setZoom(zoom);
  }
}

/** Ganti tipe list (bullet/ordered) dan status task item-nya. */
function convertList(
  tr: Transaction,
  pos: number,
  list: Node,
  type: NodeType,
  task: boolean,
): Transaction {
  const attrs = type === list.type ? list.attrs : { ...type.defaultAttrs, tight: list.attrs.tight };
  tr.setNodeMarkup(pos, type, attrs);
  list.forEach((item, offset) => {
    const itemPos = pos + 1 + offset;
    const checked = task ? (item.attrs.checked ?? false) : null;
    if (item.attrs.checked !== checked) tr.setNodeMarkup(itemPos, null, { ...item.attrs, checked });
  });
  return tr;
}

function findImage(doc: Node, src: string): number | null {
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found !== null) return false;
    if (node.type === schema.nodes.image && node.attrs.src === src) found = pos;
    return true;
  });
  return found;
}
