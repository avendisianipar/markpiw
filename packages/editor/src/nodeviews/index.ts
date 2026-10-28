// SPDX-License-Identifier: LicenseRef-Proprietary
// NodeView vanilla (spesifikasi 4.4). Tidak ada HTML dari dokumen yang masuk ke DOM sebagai HTML.
import type { Node } from 'prosemirror-model';
import type { EditorProps, EditorView, NodeView } from 'prosemirror-view';
import type { EditorController } from '../controller';
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

class CodeBlockView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;
  private readonly lang: HTMLInputElement;

  constructor(
    private node: Node,
    view: EditorView,
    getPos: GetPos,
    controller: EditorController,
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
  }

  update(node: Node): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (document.activeElement !== this.lang) this.lang.value = node.attrs.lang as string;
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
  };
}

/** Path relatif di-resolve lewat host; URL absolut aman dipakai langsung. */
export function needsHostResolution(src: string): boolean {
  return isRelativePath(src);
}
