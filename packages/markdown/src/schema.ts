// SPDX-License-Identifier: MIT
// Schema GFM markpiw (spesifikasi 3.2). Atribut gaya bernilai `null` artinya "pakai profil".
import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import type { MarkName, NodeName } from './types';

const srcKey = { default: null };

const attr = (el: HTMLElement | string, name: string): string | null =>
  typeof el === 'string' ? null : el.getAttribute(name);

const nodes: Record<NodeName, NodeSpec> = {
  doc: { content: 'block+' },
  paragraph: {
    group: 'block',
    content: 'inline*',
    attrs: { srcKey },
    parseDOM: [{ tag: 'p' }],
    toDOM: (): DOMOutputSpec => ['p', 0],
  },
  heading: {
    group: 'block',
    content: 'inline*',
    defining: true,
    attrs: { level: { default: 1 }, style: { default: null }, srcKey },
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
    toDOM: (node): DOMOutputSpec => [`h${node.attrs.level as number}`, 0],
  },
  blockquote: {
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: { srcKey },
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: (): DOMOutputSpec => ['blockquote', 0],
  },
  bullet_list: {
    group: 'block',
    content: 'list_item+',
    attrs: { marker: { default: null }, tight: { default: true }, srcKey },
    parseDOM: [{ tag: 'ul' }],
    toDOM: (): DOMOutputSpec => ['ul', 0],
  },
  ordered_list: {
    group: 'block',
    content: 'list_item+',
    attrs: { start: { default: 1 }, delimiter: { default: '.' }, tight: { default: true }, srcKey },
    parseDOM: [{ tag: 'ol', getAttrs: (dom) => ({ start: Number(attr(dom, 'start') ?? 1) || 1 }) }],
    toDOM: (node): DOMOutputSpec =>
      node.attrs.start === 1 ? ['ol', 0] : ['ol', { start: String(node.attrs.start) }, 0],
  },
  list_item: {
    content: 'paragraph block*',
    defining: true,
    attrs: { checked: { default: null }, srcKey },
    parseDOM: [{ tag: 'li' }],
    toDOM: (node): DOMOutputSpec =>
      node.attrs.checked === null
        ? ['li', 0]
        : ['li', { 'data-checked': String(node.attrs.checked) }, 0],
  },
  code_block: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: {
      lang: { default: '' },
      fence: { default: null },
      fenceLength: { default: null },
      srcKey,
    },
    parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    toDOM: (): DOMOutputSpec => ['pre', ['code', 0]],
  },
  table: {
    group: 'block',
    content: 'table_row+',
    isolating: true,
    attrs: { align: { default: [] }, srcKey },
    parseDOM: [{ tag: 'table' }],
    toDOM: (): DOMOutputSpec => ['table', ['tbody', 0]],
  },
  table_row: {
    content: 'table_cell+',
    parseDOM: [{ tag: 'tr' }],
    toDOM: (): DOMOutputSpec => ['tr', 0],
  },
  table_cell: {
    content: 'inline*',
    isolating: true,
    attrs: { header: { default: false } },
    parseDOM: [
      { tag: 'th', attrs: { header: true } },
      { tag: 'td', attrs: { header: false } },
    ],
    toDOM: (node): DOMOutputSpec => [node.attrs.header ? 'th' : 'td', 0],
  },
  horizontal_rule: {
    group: 'block',
    attrs: { marker: { default: null }, srcKey },
    parseDOM: [{ tag: 'hr' }],
    toDOM: (): DOMOutputSpec => ['hr'],
  },
  math_block: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: { fenceLength: { default: null }, srcKey },
    parseDOM: [{ tag: 'pre[data-math]', preserveWhitespace: 'full' }],
    toDOM: (): DOMOutputSpec => ['pre', { 'data-math': '', class: 'mp-math-source' }, ['code', 0]],
  },
  raw_block: {
    group: 'block',
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    attrs: { kind: { default: 'unknown' }, srcKey },
    parseDOM: [
      {
        tag: 'pre[data-raw]',
        preserveWhitespace: 'full',
        getAttrs: (dom) => ({ kind: attr(dom, 'data-raw') ?? 'unknown' }),
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      'pre',
      { 'data-raw': node.attrs.kind as string, class: 'mp-raw-block' },
      ['code', 0],
    ],
  },
  text: { group: 'inline' },
  image: {
    group: 'inline',
    inline: true,
    draggable: true,
    attrs: { src: { default: '' }, alt: { default: '' }, title: { default: null } },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom) => ({
          src: attr(dom, 'src') ?? '',
          alt: attr(dom, 'alt') ?? '',
          title: attr(dom, 'title'),
        }),
      },
    ],
    toDOM: (node): DOMOutputSpec => {
      const { src, alt, title } = node.attrs as { src: string; alt: string; title: string | null };
      return ['img', title === null ? { src, alt } : { src, alt, title }];
    },
  },
  hard_break: {
    group: 'inline',
    inline: true,
    selectable: false,
    attrs: { style: { default: 'backslash' } },
    parseDOM: [{ tag: 'br' }],
    toDOM: (): DOMOutputSpec => ['br'],
  },
  soft_break: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: false,
    leafText: () => ' ',
    parseDOM: [{ tag: 'span.mp-soft-break' }],
    toDOM: (): DOMOutputSpec => ['span', { class: 'mp-soft-break' }, ' '],
  },
  math_inline: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: { latex: { default: '' }, delim: { default: '$' } },
    leafText: (node) => `$${node.attrs.latex as string}$`,
    parseDOM: [
      {
        tag: 'span[data-math-inline]',
        getAttrs: (dom) => ({ latex: attr(dom, 'data-latex') ?? '' }),
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      'span',
      { 'data-math-inline': '', 'data-latex': node.attrs.latex as string, class: 'mp-math-inline' },
      node.attrs.latex as string,
    ],
  },
  raw_inline: {
    group: 'inline',
    inline: true,
    atom: true,
    attrs: { source: { default: '' } },
    leafText: (node) => node.attrs.source as string,
    parseDOM: [
      {
        tag: 'code[data-raw-inline]',
        getAttrs: (dom) => ({ source: typeof dom === 'string' ? '' : (dom.textContent ?? '') }),
      },
    ],
    toDOM: (node): DOMOutputSpec => [
      'code',
      { 'data-raw-inline': '', class: 'mp-raw-inline' },
      node.attrs.source as string,
    ],
  },
};

// Urutan mark menentukan nesting: link paling luar, lalu strong, em, strike, code.
const marks: Record<MarkName, MarkSpec> = {
  link: {
    inclusive: false,
    attrs: {
      href: { default: '' },
      title: { default: null },
      kind: { default: 'inline' },
      refLabel: { default: null },
    },
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => ({ href: attr(dom, 'href') ?? '', title: attr(dom, 'title') }),
      },
    ],
    toDOM: (mark): DOMOutputSpec => {
      const { href, title } = mark.attrs as { href: string; title: string | null };
      return ['a', title === null ? { href } : { href, title }, 0];
    },
  },
  strong: {
    attrs: { delim: { default: null } },
    parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
    toDOM: (): DOMOutputSpec => ['strong', 0],
  },
  em: {
    attrs: { delim: { default: null } },
    parseDOM: [{ tag: 'em' }, { tag: 'i' }],
    toDOM: (): DOMOutputSpec => ['em', 0],
  },
  strike: {
    parseDOM: [{ tag: 'del' }, { tag: 's' }],
    toDOM: (): DOMOutputSpec => ['del', 0],
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: (): DOMOutputSpec => ['code', 0],
  },
};

export const schema: Schema<NodeName, MarkName> = new Schema<NodeName, MarkName>({
  nodes,
  marks,
});
