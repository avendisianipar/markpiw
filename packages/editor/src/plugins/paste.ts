// SPDX-License-Identifier: MIT
// Paste & drop (spesifikasi 4.3) dan clipboard teks sebagai markdown.
import { parseMarkdown, schema, serializeMarkdown } from '@markpiw/markdown';
import { Fragment, type Node, Slice } from 'prosemirror-model';
import { Plugin } from 'prosemirror-state';
import type { EditorController } from '../controller';

const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);
const MARKDOWN_HINT =
  /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|>\s?|\d{1,9}[.)]\s|```|~~~|\|.*\|)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`/;
/** HTML dengan struktur semantik; tanpa ini (mis. dari editor kode) teks polos lebih tepat. */
const SEMANTIC_HTML = /<(h[1-6]|ul|ol|li|table|strong|b|em|i|a|blockquote|pre)[\s>]/i;
const DROP_ELEMENTS =
  'script, style, meta, link, title, template, iframe, object, embed, svg, math, o\\:p';

export function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_HINT.test(text);
}

function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => IMAGE_TYPES.has(f.type));
}

/**
 * Bersihkan HTML dari clipboard sebelum di-parse ProseMirror (dokumen inert): buang wrapper
 * Google Docs, ubah paragraf list Word (`mso-list`) menjadi `<ul><li>`, buang atribut gaya
 * dan elemen yang tidak relevan.
 */
export function cleanPastedHTML(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(DROP_ELEMENTS).forEach((el) => el.remove());
  doc.querySelectorAll('b[id^="docs-internal-guid"]').forEach((wrapper) => {
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
  });
  // Google Docs menandai tebal/miring lewat style span.
  doc.querySelectorAll('span[style]').forEach((span) => {
    const style = span.getAttribute('style') ?? '';
    let node: Element = span;
    if (/font-weight:\s*(700|bold)/.test(style)) node = wrap(doc, node, 'strong');
    if (/font-style:\s*italic/.test(style)) node = wrap(doc, node, 'em');
    if (/line-through/.test(style)) wrap(doc, node, 's');
  });
  // Word: paragraf dengan mso-list menjadi item list.
  let currentList: HTMLElement | null = null;
  doc.querySelectorAll('p').forEach((p) => {
    const style = p.getAttribute('style') ?? '';
    if (!/mso-list/.test(style) && !/MsoListParagraph/.test(p.className)) {
      currentList = null;
      return;
    }
    p.querySelectorAll('span[style*="mso-list:Ignore"], span[style*="mso-list: Ignore"]').forEach(
      (s) => s.remove(),
    );
    if (!currentList || currentList.nextElementSibling !== p) {
      currentList = doc.createElement('ul');
      p.before(currentList);
    }
    const li = doc.createElement('li');
    li.append(...Array.from(p.childNodes));
    currentList.append(li);
    p.remove();
  });
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (!['href', 'src', 'alt', 'title', 'start'].includes(attr.name))
        el.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

function wrap(doc: Document, el: Element, tag: string): Element {
  const wrapper = doc.createElement(tag);
  el.replaceWith(wrapper);
  wrapper.append(el);
  return wrapper;
}

/** Slice dari markdown; isi tingkat atas dibuka agar paragraf tunggal menyatu dengan teks. */
function markdownSlice(text: string): Slice {
  const doc = parseMarkdown(text).doc;
  return Slice.maxOpen(stripKeys(doc).content);
}

/** Node hasil paste tidak berasal dari source file ini: buang srcKey-nya. */
function stripKeys(node: Node): Node {
  if (node.isText) return node;
  const content: Node[] = [];
  node.forEach((child) => content.push(stripKeys(child)));
  const attrs = 'srcKey' in node.attrs ? { ...node.attrs, srcKey: null } : node.attrs;
  return node.type.create(attrs, Fragment.from(content), node.marks);
}

/** Markdown untuk slice (dipakai saat menyalin ke clipboard sebagai teks). */
export function sliceToMarkdown(slice: Slice): string {
  let content = slice.content;
  if (content.firstChild?.isInline)
    content = Fragment.from(schema.nodes.paragraph.create(null, content));
  try {
    const doc = schema.nodes.doc.create(
      null,
      stripKeys(schema.nodes.doc.create(null, content)).content,
    );
    return serializeMarkdown(parseMarkdown(''), doc).replace(/\n+$/, '');
  } catch {
    return slice.content.textBetween(0, slice.content.size, '\n\n');
  }
}

export function pastePlugin(controller: EditorController): Plugin {
  return new Plugin({
    props: {
      transformPastedHTML: cleanPastedHTML,
      clipboardTextSerializer: (slice) => sliceToMarkdown(slice),
      clipboardTextParser(text, $context) {
        if ($context.parent.type.spec.code || !looksLikeMarkdown(text))
          return null as unknown as Slice;
        return markdownSlice(text);
      },
      handlePaste(view, event) {
        const data = event.clipboardData;
        const files = imageFiles(data?.files);
        if (files.length > 0) {
          for (const file of files) void controller.commands.insertImageFile(file);
          return true;
        }
        const parent = view.state.selection.$from.parent;
        if (parent.type.spec.code) return false;
        const plain = data?.getData('text/plain') ?? '';
        const html = data?.getData('text/html') ?? '';
        if (plain && html && !SEMANTIC_HTML.test(html) && looksLikeMarkdown(plain)) {
          view.dispatch(view.state.tr.replaceSelection(markdownSlice(plain)).scrollIntoView());
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        for (const file of files) void controller.commands.insertImageFile(file, at);
        return true;
      },
    },
  });
}
