// SPDX-License-Identifier: LicenseRef-Proprietary
// EditorController (spesifikasi 4.1): pemilik EditorState/EditorView, store snapshot untuk UI,
// perintah, dan pipeline serialisasi + guard. Tidak tahu soal React maupun file.
import type { Disposable, FileHost, Result } from '@markpiw/host';
import {
  type GuardFailure,
  type ParsedDoc,
  parseMarkdown,
  serializeMarkdown,
  verifyRoundTrip,
} from '@markpiw/markdown';
import { redoDepth, undoDepth } from 'prosemirror-history';
import { EditorState, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { EditorCommands } from './commands';
import { applyExternalText } from './external';
import { createNodeViews } from './nodeviews';
import { createPlugins, slashKey } from './plugins';
import { filterItems, runSlashItem } from './plugins/slash';
import { isRelativePath } from './safety';
import {
  activeMarks,
  blockTypeOf,
  type EditorSnapshot,
  hasAncestor,
  imageAt,
  linkAt,
  listKindOf,
  type Notice,
  type ReadOnlyState,
  type SlashState,
  stabilize,
} from './snapshot';
import { DEFAULT_EDITOR_STRINGS, type EditorStrings, type SlashItemId } from './strings';

export type UiRequest = 'image';

export interface EditorControllerOptions {
  /** Isi file markdown. */
  readonly text: string;
  readonly host: FileHost;
  readonly strings?: EditorStrings;
}

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;

export class EditorController {
  readonly host: FileHost;
  readonly strings: EditorStrings;
  readonly commands: EditorCommands;

  private parsedDoc: ParsedDoc;
  private editorState: EditorState;
  private view: EditorView | null = null;
  private snapshotValue: EditorSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly docListeners = new Set<() => void>();
  private readOnlyState: ReadOnlyState | null = null;
  private zoomValue = 100;
  private dirtyFlag = false;
  private noticeValue: Notice | null = null;
  private noticeId = 0;
  private linkEditorOpen = false;
  private readonly uiListeners = new Set<(request: UiRequest) => void>();
  private readonly imageCache = new Map<string, Promise<string | null>>();

  constructor(options: EditorControllerOptions) {
    this.host = options.host;
    this.strings = options.strings ?? DEFAULT_EDITOR_STRINGS;
    this.parsedDoc = parseMarkdown(options.text);
    this.zoomValue = clampZoom(options.host.restoreUiState()?.zoom ?? 100);
    this.commands = new EditorCommands({
      getState: () => this.editorState,
      getView: () => this.view,
      host: this.host,
      dispatch: (tr) => this.dispatch(tr),
      setZoom: (zoom) => this.setZoom(zoom),
      notify: (kind, message) => this.notify(kind, message),
      imageSaveFailedMessage: this.strings.imageSaveFailed,
    });
    this.editorState = EditorState.create({
      doc: this.parsedDoc.doc,
      plugins: createPlugins(this),
    });
  }

  get state(): EditorState {
    return this.editorState;
  }

  /** Hasil parse yang menjadi dasar preservasi source. */
  get parsed(): ParsedDoc {
    return this.parsedDoc;
  }

  get editorView(): EditorView | null {
    return this.view;
  }

  mount(element: HTMLElement): void {
    if (this.view) this.unmount();
    this.view = new EditorView(element, {
      state: this.editorState,
      dispatchTransaction: (tr) => this.dispatch(tr),
      editable: () => this.readOnlyState === null,
      nodeViews: createNodeViews(this),
      attributes: { class: 'mp-content', spellcheck: 'true' },
    });
    this.refreshSnapshot();
  }

  unmount(): void {
    this.view?.destroy();
    this.view = null;
  }

  focus(): void {
    this.view?.focus();
  }

  dispatch(tr: Transaction): void {
    this.editorState = this.editorState.apply(tr);
    this.view?.updateState(this.editorState);
    if (tr.docChanged && !tr.getMeta(EXTERNAL)) {
      this.dirtyFlag = true;
      for (const listener of [...this.docListeners]) listener();
    }
    this.refreshSnapshot();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot = (): EditorSnapshot => {
    if (!this.snapshotValue) this.snapshotValue = this.computeSnapshot();
    return this.snapshotValue;
  };

  onDocChange(listener: () => void): Disposable {
    this.docListeners.add(listener);
    return { dispose: () => this.docListeners.delete(listener) };
  }

  /**
   * Markdown dokumen saat ini. Output selalu diverifikasi guard round-trip; jika gagal,
   * editor menjadi read-only dan tidak ada yang boleh ditulis.
   */
  serialize(): Result<string, GuardFailure> {
    const out = serializeMarkdown(this.parsedDoc, this.editorState.doc);
    const verdict = verifyRoundTrip(out, this.editorState.doc);
    if (!verdict.ok) {
      this.setReadOnly({ reason: 'guard', failure: verdict.error });
      return verdict;
    }
    return { ok: true, value: out };
  }

  /** Tandai dokumen tersimpan (host memanggil ini setelah menulis/mengirim edit). */
  markSaved(): void {
    this.dirtyFlag = false;
    this.refreshSnapshot();
  }

  /** Spesifikasi 2.5: terapkan teks dari luar (undo VS Code, git, editor lain). */
  applyExternalText(text: string): void {
    const parsed = parseMarkdown(text);
    const tr = applyExternalText(this.editorState, parsed.doc);
    tr.setMeta(EXTERNAL, true).setMeta('addToHistory', false);
    this.parsedDoc = parsed;
    this.dirtyFlag = false;
    this.dispatch(tr);
  }

  /** Buka popover link (Mod-K atau tombol toolbar). */
  openLinkEditor(): void {
    this.linkEditorOpen = true;
    this.refreshSnapshot();
  }

  closeLinkEditor(): void {
    this.linkEditorOpen = false;
    this.refreshSnapshot();
  }

  setReadOnly(state: ReadOnlyState | null): void {
    this.readOnlyState = state;
    this.view?.setProps({});
    this.refreshSnapshot();
  }

  clearReadOnly(): void {
    this.setReadOnly(null);
  }

  setZoom(zoom: number): void {
    this.zoomValue = clampZoom(zoom);
    this.refreshSnapshot();
  }

  notify(kind: 'error' | 'info', message: string): void {
    this.noticeValue = { kind, message, id: ++this.noticeId };
    this.refreshSnapshot();
  }

  dismissNotice(): void {
    this.noticeValue = null;
    this.refreshSnapshot();
  }

  /** Hitung ulang snapshot; beri tahu subscriber hanya jika isinya berubah. */
  refreshSnapshot(): void {
    const next = stabilize(this.snapshotValue, this.computeSnapshot());
    if (next === this.snapshotValue) return;
    this.snapshotValue = next;
    for (const listener of [...this.listeners]) listener();
  }

  private slashSnapshot(): SlashState | null {
    const s = slashKey.getState(this.editorState);
    if (!s?.match) return null;
    let anchorRect: SlashState['anchorRect'] = null;
    try {
      const coords = this.view?.coordsAtPos(s.match.from);
      if (coords) anchorRect = { left: coords.left, top: coords.top, bottom: coords.bottom };
    } catch {
      anchorRect = null;
    }
    return {
      query: s.match.query,
      items: filterItems(s.match.query, this.strings),
      selectedIndex: s.selectedIndex,
      anchorRect,
    };
  }

  /** Jalankan item slash menu (dipanggil keyboard atau klik di UI). */
  runSlashItem(id: SlashItemId): void {
    runSlashItem(this, id);
    this.view?.focus();
  }

  /** Tutup slash menu tanpa menjalankan apa pun. */
  closeSlash(): void {
    this.dispatch(this.editorState.tr.setMeta(slashKey, { type: 'close' }));
  }

  /** Minta UI melakukan sesuatu yang butuh dialog (mis. memilih file gambar). */
  requestUi(request: UiRequest): void {
    for (const listener of [...this.uiListeners]) listener(request);
  }

  onUiRequest(listener: (request: UiRequest) => void): Disposable {
    this.uiListeners.add(listener);
    return { dispose: () => this.uiListeners.delete(listener) };
  }

  /** URL tampilan untuk `src` gambar (relatif di-resolve lewat host, dengan cache). */
  resolveImage(src: string): Promise<string | null> {
    let cached = this.imageCache.get(src);
    if (!cached) {
      cached = isRelativePath(src) ? this.host.resolveImageUrl(src) : Promise.resolve(src);
      this.imageCache.set(src, cached);
    }
    return cached;
  }

  private computeSnapshot(): EditorSnapshot {
    const state = this.editorState;
    const editorHistory = this.host.historyMode === 'editor';
    return {
      activeMarks: activeMarks(state),
      blockType: blockTypeOf(state),
      listKind: listKindOf(state),
      inQuote: hasAncestor(state, 'blockquote'),
      inTable: hasAncestor(state, 'table'),
      canUndo: editorHistory ? undoDepth(state) > 0 : true,
      canRedo: editorHistory ? redoDepth(state) > 0 : true,
      slash: this.slashSnapshot(),
      link: linkAt(state),
      linkEditor: this.linkEditorOpen,
      image: imageAt(state),
      zoom: this.zoomValue,
      readOnly: this.readOnlyState,
      dirty: this.dirtyFlag,
      notice: this.noticeValue,
    };
  }
}

/** Meta transaksi untuk perubahan dari luar (tidak memicu onDocChange/dirty). */
export const EXTERNAL = 'markpiw-external';

export function clampZoom(zoom: number): number {
  const stepped = Math.round(zoom / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, stepped));
}
