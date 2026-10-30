// SPDX-License-Identifier: MIT
// NodeView vanilla (spesifikasi 4.4). Tidak ada HTML dari dokumen yang masuk ke DOM sebagai HTML.
import type { Node } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
import type { EditorProps, EditorView, NodeView } from 'prosemirror-view';
import type { EditorController } from '../controller';
import { renderMath, renderMermaid } from '../render';
import { isRelativePath, isSafeImageSrc } from '../safety';

type GetPos = () => number | undefined;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

class ImageView implements NodeView {
  readonly dom: HTMLElement;
  private node: Node;

  constructor(
    node: Node,
    private readonly controller: EditorController,
  ) {
    this.node = node;
    this.dom = el('span', 'mp-image');
    this.render();
  }

  private render(): void {
    const { src, alt, title } = this.node.attrs as {
      src: string;
      alt: string;
      title: string | null;
    };
    this.dom.replaceChildren();
    if (!isSafeImageSrc(src)) {
      this.missing(src);
      return;
    }
    const img = el('img');
    img.alt = alt;
    if (title) img.title = title;
    img.draggable = false;
    img.addEventListener('error', () => this.missing(src));
    this.dom.append(img);
    void this.controller.resolveImage(src).then((url) => {
      if (this.node.attrs.src !== src) return;
      if (url) img.setAttribute('src', url);
      else this.missing(src);
    });
  }

  private missing(src: string): void {
    const box = el('span', 'mp-image-missing');
    box.textContent = `${this.controller.strings.imageMissing}: ${src}`;
    this.dom.replaceChildren(box);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    const changed =
      node.attrs.src !== this.node.attrs.src || node.attrs.alt !== this.node.attrs.alt;
    this.node = node;
    if (changed) this.render();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  ignoreMutation(): boolean {
    return true;
  }
}

class TaskItemView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly box: HTMLInputElement;

  constructor(
    private node: Node,
    view: EditorView,
    getPos: GetPos,
    controller: EditorController,
  ) {
    this.dom = el('li', 'mp-task');
    const wrapper = el('span', 'mp-task-box');
    wrapper.contentEditable = 'false';
    this.box = el('input');
    this.box.type = 'checkbox';
    this.box.tabIndex = -1;
    this.box.checked = node.attrs.checked === true;
    this.box.addEventListener('mousedown', (event) => {
      event.preventDefault();
      const pos = getPos();
      if (pos !== undefined && view.editable) controller.commands.toggleTask(pos);
    });
    wrapper.append(this.box);
    this.contentDOM = el('div', 'mp-task-content');
    this.dom.append(wrapper, this.contentDOM);
    this.dom.dataset.checked = String(node.attrs.checked);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type || node.attrs.checked === null) return false;
    this.node = node;
    this.box.checked = node.attrs.checked === true;
    this.dom.dataset.checked = String(node.attrs.checked);
    return true;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: 'selection'; target: globalThis.Node },
  ): boolean {
    return !this.contentDOM.contains(mutation.target);
  }

  stopEvent(event: Event): boolean {
    return event.target === this.box;
  }
}

export type PreviewKind = 'mermaid' | 'math';

/** Code block yang punya pratinjau: ```mermaid (diagram) dan ```math (rumus, sintaks GitHub). */
export function previewKindOf(info: string): PreviewKind | null {
  const lang = info.trim().split(/\s+/)[0]?.toLowerCase();
  return lang === 'mermaid' || lang === 'math' ? lang : null;
}

/** Pratinjau hasil render di bawah source (tidak bisa diedit, tidak ikut ke file). */
export class Preview {
  readonly dom: HTMLElement;
  private source: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private url: string | null = null;
  private generation = 0;

  constructor(
    readonly kind: PreviewKind,
    private readonly strings: EditorController['strings'],
  ) {
    this.dom = el('div', `mp-preview mp-preview-${kind}`);
    this.dom.contentEditable = 'false';
  }

  update(source: string): void {
    if (source === this.source) return;
    const first = this.source === null;
    this.source = source;
    clearTimeout(this.timer);
    // Rumus murah dirender langsung; diagram ditunda selama user masih mengetik.
    if (this.kind === 'math' || first) void this.render(source);
    else this.timer = setTimeout(() => void this.render(source), 300);
  }

  private async render(source: string): Promise<void> {
    const generation = ++this.generation;
    if (source.trim() === '') {
      this.message(this.strings.previewEmpty, false);
      return;
    }
    if (this.kind === 'math') {
      const result = renderMath(source, true);
      if (result.ok) this.dom.innerHTML = result.html;
      else this.message(`${this.strings.previewError}: ${result.error}`, true);
      return;
    }
    if (this.url === null) this.message(this.strings.previewLoading, false);
    const result = await renderMermaid(source);
    if (generation !== this.generation) return;
    if (!result.ok) {
      this.message(`${this.strings.previewError}: ${result.error}`, true);
      return;
    }
    const img = el('img');
    img.alt = source;
    this.revoke();
    this.url = URL.createObjectURL(new Blob([result.html], { type: 'image/svg+xml' }));
    img.src = this.url;
    this.dom.replaceChildren(img);
  }

  private message(text: string, error: boolean): void {
    const box = el('div', error ? 'mp-preview-error' : 'mp-preview-note');
    box.textContent = text;
    this.revoke();
    this.dom.replaceChildren(box);
  }

  private revoke(): void {
    if (this.url !== null) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  destroy(): void {
    clearTimeout(this.timer);
    this.generation++;
    this.revoke();
  }
}

class CodeBlockView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly lang: HTMLInputElement;
  private preview: Preview | null = null;

  constructor(
    private node: Node,
    view: EditorView,
    getPos: GetPos,
    private readonly controller: EditorController,
  ) {
    this.dom = el('div', 'mp-code');
    const bar = el('div', 'mp-code-bar');
    bar.contentEditable = 'false';
    this.lang = el('input', 'mp-code-lang');
    this.lang.value = node.attrs.lang as string;
    this.lang.placeholder = controller.strings.codeLanguagePlaceholder;
    this.lang.spellcheck = false;
    this.lang.addEventListener('change', () => {
      const pos = getPos();
      if (pos === undefined || !view.editable) return;
      const lang = this.lang.value.trim();
      if (lang === this.node.attrs.lang) return;
      controller.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...this.node.attrs, lang }));
    });
    this.lang.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.lang.dispatchEvent(new Event('change'));
        view.focus();
      }
    });
    bar.append(this.lang);
    const pre = el('pre');
    this.contentDOM = el('code');
    pre.append(this.contentDOM);
    this.dom.append(bar, pre);
    this.syncPreview();
  }

  private syncPreview(): void {
    const kind = previewKindOf(this.node.attrs.lang as string);
    if (this.preview && this.preview.kind !== kind) {
      this.preview.destroy();
      this.preview.dom.remove();
      this.preview = null;
    }
    if (kind && !this.preview) {
      this.preview = new Preview(kind, this.controller.strings);
      this.dom.append(this.preview.dom);
    }
    this.preview?.update(this.node.textContent);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (document.activeElement !== this.lang) this.lang.value = node.attrs.lang as string;
    this.syncPreview();
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.lang;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: 'selection'; target: globalThis.Node },
  ): boolean {
    return !this.contentDOM.contains(mutation.target);
  }

  destroy(): void {
    this.preview?.destroy();
  }
}

/** Blok `$$`: source LaTeX bisa diedit, pratinjau rumus di bawahnya. */
class MathBlockView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly preview: Preview;

  constructor(
    private node: Node,
    controller: EditorController,
  ) {
    this.dom = el('div', 'mp-code mp-math-block');
    const bar = el('div', 'mp-code-bar');
    bar.contentEditable = 'false';
    const label = el('span', 'mp-code-label');
    label.textContent = controller.strings.mathBlockLabel;
    bar.append(label);
    const pre = el('pre');
    this.contentDOM = el('code');
    pre.append(this.contentDOM);
    this.preview = new Preview('math', controller.strings);
    this.dom.append(bar, pre, this.preview.dom);
    this.preview.update(node.textContent);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.preview.update(node.textContent);
    return true;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: 'selection'; target: globalThis.Node },
  ): boolean {
    return !this.contentDOM.contains(mutation.target);
  }

  destroy(): void {
    this.preview.destroy();
  }
}

/**
 * Rumus inline `$…$`: tampil sebagai hasil render. Saat dipilih (klik, panah, atau baru
 * disisipkan) muncul input LaTeX; Enter/klik di luar menyimpan, Esc membatalkan, panah di tepi
 * input keluar dari rumus.
 */
class MathInlineView implements NodeView {
  readonly dom: HTMLElement;
  private readonly rendered: HTMLElement;
  private input: HTMLInputElement | null = null;

  constructor(
    private node: Node,
    private readonly view: EditorView,
    private readonly getPos: GetPos,
    private readonly controller: EditorController,
  ) {
    this.dom = el('span', 'mp-math-inline');
    this.rendered = el('span', 'mp-math-rendered');
    this.dom.append(this.rendered);
    this.render(node.attrs.latex as string);
  }

  private render(latex: string): void {
    this.dom.title = `$${latex}$`;
    if (latex.trim() === '') {
      this.rendered.textContent = this.controller.strings.mathInlinePlaceholder;
      this.rendered.className = 'mp-math-rendered mp-math-empty';
      return;
    }
    const result = renderMath(latex, false);
    if (result.ok) {
      this.rendered.innerHTML = result.html;
      this.rendered.className = 'mp-math-rendered';
    } else {
      this.rendered.textContent = `$${latex}$`;
      this.rendered.className = 'mp-math-rendered mp-math-error';
      this.rendered.title = result.error;
    }
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.input) this.render(node.attrs.latex as string);
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode');
    if (this.view.editable) this.open();
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode');
    this.close(true);
  }

  private open(): void {
    if (this.input) return;
    const input = el('input', 'mp-math-input');
    input.value = this.node.attrs.latex as string;
    input.spellcheck = false;
    input.placeholder = this.controller.strings.mathInlinePlaceholder;
    input.setAttribute('aria-label', this.controller.strings.mathInlineLabel);
    input.addEventListener('input', () => this.render(input.value));
    input.addEventListener('keydown', (event) => {
      const atEnd =
        input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if (event.key === 'Enter' || (event.key === 'ArrowRight' && atEnd)) {
        event.preventDefault();
        this.leave(1);
      } else if (event.key === 'ArrowLeft' && atStart) {
        event.preventDefault();
        this.leave(-1);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close(false);
        this.view.focus();
      }
    });
    // Tidak menyimpan saat blur: menu toolbar mengembalikan fokus ke tombolnya setelah menutup.
    // Penyimpanan terjadi saat seleksi pindah (deselectNode), Enter, Esc, atau panah di tepi.
    this.input = input;
    this.dom.append(input);
    input.focus();
    // Rebut fokus kembali setelah menu/popover selesai memulihkan fokusnya (React Aria memakai
    // requestAnimationFrame; timer sebagai cadangan saat frame tidak berjalan, mis. tab latar).
    const refocus = () => {
      if (this.input === input && document.activeElement !== input) input.focus();
    };
    requestAnimationFrame(() => requestAnimationFrame(refocus));
    setTimeout(refocus, 120);
  }

  /** Simpan lalu taruh kursor teks sebelum (-1) atau sesudah (1) rumus. */
  private leave(side: 1 | -1): void {
    this.close(true);
    const pos = this.getPos();
    if (pos === undefined) return;
    const state = this.view.state;
    const node = state.doc.nodeAt(pos);
    const at = side === 1 ? pos + (node?.nodeSize ?? 1) : pos;
    this.controller.dispatch(
      state.tr.setSelection(
        TextSelection.near(state.doc.resolve(Math.min(at, state.doc.content.size))),
      ),
    );
    this.view.focus();
  }

  private close(commit: boolean): void {
    const input = this.input;
    if (!input) return;
    this.input = null;
    input.remove();
    const pos = this.getPos();
    const current = pos === undefined ? null : this.view.state.doc.nodeAt(pos);
    if (pos === undefined || current?.type !== this.node.type || !this.view.editable) {
      this.render(this.node.attrs.latex as string);
      return;
    }
    // Batal (Esc) mempertahankan LaTeX lama; rumus yang tetap kosong dihapus.
    const latex = commit ? input.value.trim() : (current.attrs.latex as string);
    const tr = this.view.state.tr;
    if (latex === '') tr.delete(pos, pos + current.nodeSize);
    else if (latex !== current.attrs.latex)
      tr.setNodeMarkup(pos, null, { ...current.attrs, latex });
    else {
      this.render(latex);
      return;
    }
    this.controller.dispatch(tr);
  }

  stopEvent(event: Event): boolean {
    return this.input !== null && event.target === this.input;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.input = null;
  }
}

class RawBlockView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;

  constructor(
    private node: Node,
    controller: EditorController,
  ) {
    this.dom = el('div', 'mp-raw');
    const label = el('div', 'mp-raw-label');
    label.contentEditable = 'false';
    label.textContent = `${controller.strings.rawBlockLabel} · ${node.attrs.kind as string}`;
    const pre = el('pre');
    this.contentDOM = el('code');
    pre.append(this.contentDOM);
    this.dom.append(label, pre);
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type || node.attrs.kind !== this.node.attrs.kind) return false;
    this.node = node;
    return true;
  }

  ignoreMutation(
    mutation: MutationRecord | { type: 'selection'; target: globalThis.Node },
  ): boolean {
    return !this.contentDOM.contains(mutation.target);
  }
}

const HTML_BREAK = /^<br\s*\/?>$/i;

/** HTML inline mentah; `<br>` (baris baru di sel tabel) ditampilkan sebagai pindah baris. */
function rawInlineView(node: Node): NodeView {
  const source = node.attrs.source as string;
  if (HTML_BREAK.test(source)) {
    const dom = el('span', 'mp-raw-br');
    dom.title = source;
    dom.append(el('br'));
    return { dom, ignoreMutation: () => true };
  }
  const dom = el('code', 'mp-raw-inline');
  dom.dataset.rawInline = '';
  dom.textContent = source;
  return { dom, ignoreMutation: () => true };
}

export function createNodeViews(
  controller: EditorController,
): NonNullable<EditorProps['nodeViews']> {
  return {
    image: (node) => new ImageView(node, controller),
    list_item: (node, view, getPos) => {
      if (node.attrs.checked === null) {
        const li = el('li');
        return {
          dom: li,
          contentDOM: li,
          update: (next: Node) => next.type === node.type && next.attrs.checked === null,
        };
      }
      return new TaskItemView(node, view, getPos, controller);
    },
    code_block: (node, view, getPos) => new CodeBlockView(node, view, getPos, controller),
    raw_block: (node) => new RawBlockView(node, controller),
    raw_inline: (node) => rawInlineView(node),
    math_block: (node) => new MathBlockView(node, controller),
    math_inline: (node, view, getPos) =>
      new MathInlineView(node, view, getPos as GetPos, controller),
  };
}

/** Path relatif di-resolve lewat host; URL absolut aman dipakai langsung. */
export function needsHostResolution(src: string): boolean {
  return isRelativePath(src);
}
