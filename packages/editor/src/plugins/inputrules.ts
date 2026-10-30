// SPDX-License-Identifier: MIT
// Shortcut markdown (spesifikasi 4.2). Delimiter/marker yang diketik disimpan ke atribut
// sehingga serializer menulis gaya yang sama.
import { schema } from '@markpiw/markdown';
import {
  InputRule,
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import type { Attrs, MarkType } from 'prosemirror-model';
import type { Plugin } from 'prosemirror-state';

/** `match[1]` = teks berdelimiter lengkap, `match[2]` = isi. */
function markRule(pattern: RegExp, type: MarkType, delim: string, attrs: Attrs | null): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const full = match[1] as string;
    const content = match[2] as string;
    const fullStart = start + (match[0].length - full.length);
    const $start = state.doc.resolve(fullStart);
    if ($start.parent.type.spec.code) return null;
    if (state.doc.rangeHasMark(fullStart, end, schema.marks.code)) return null;
    const contentStart = fullStart + delim.length;
    const contentEnd = contentStart + content.length;
    const tr = state.tr.delete(contentEnd, end).delete(fullStart, contentStart);
    tr.addMark(fullStart, fullStart + content.length, type.create(attrs ?? undefined));
    tr.removeStoredMark(type);
    return tr;
  });
}

/** `[ ] ` / `[x] ` di awal paragraf atau item list → task item. */
const taskRule = new InputRule(/^\[([ xX])\]\s$/, (state, match, start, end) => {
  const checked = match[1] !== ' ';
  const $start = state.doc.resolve(start);
  const tr = state.tr.delete(start, end);
  const itemDepth = $start.depth - 1;
  const item = itemDepth > 0 ? $start.node(itemDepth) : null;
  if (item?.type === schema.nodes.list_item && $start.index(itemDepth) === 0) {
    return tr.setNodeMarkup($start.before(itemDepth), null, { ...item.attrs, checked });
  }
  const range = tr.doc.resolve(start).blockRange();
  if (!range) return null;
  tr.wrap(range, [
    { type: schema.nodes.bullet_list, attrs: { marker: null, tight: true } },
    { type: schema.nodes.list_item, attrs: { checked } },
  ]);
  return tr;
});

const URL_END = /[\s<]/;
const TRAILING = /[.,:;!?'")*_~]+$/;

/** Autolink literal GFM: URL/www/email diubah menjadi link saat spasi diketik. */
const autolinkRule = new InputRule(
  /(?:^|[\s(*_~])((?:https?:\/\/|www\.)[^\s<]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)\s$/,
  (state, match, start, end) => {
    let text = match[1] as string;
    const trailing = TRAILING.exec(text)?.[0] ?? '';
    text = text.slice(0, text.length - trailing.length);
    if (text === '' || URL_END.test(text)) return null;
    const textStart = start + (match[0].length - (match[1] as string).length - 1);
    const textEnd = textStart + text.length;
    const $start = state.doc.resolve(textStart);
    if ($start.parent.type.spec.code) return null;
    if (state.doc.rangeHasMark(textStart, textEnd, schema.marks.link)) return null;
    if (state.doc.rangeHasMark(textStart, textEnd, schema.marks.code)) return null;
    const href =
      text.includes('@') && !text.includes('/')
        ? `mailto:${text}`
        : text.startsWith('www.')
          ? `http://${text}`
          : text;
    const mark = schema.marks.link.create({ href, title: null, kind: 'literal', refLabel: null });
    const tr = state.tr.addMark(textStart, textEnd, mark);
    tr.insertText(' ', end);
    tr.removeStoredMark(schema.marks.link);
    return tr;
  },
);

export function markdownInputRules(): Plugin {
  const { heading, blockquote, bullet_list, ordered_list } = schema.nodes;
  const { strong, em, strike, code } = schema.marks;
  return inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,6})\s$/, heading, (m) => ({ level: (m[1] as string).length })),
      wrappingInputRule(/^\s*>\s$/, blockquote),
      taskRule,
      wrappingInputRule(/^\s*([-+*])\s$/, bullet_list, (m) => ({ marker: m[1] })),
      wrappingInputRule(
        /^(\d{1,9})([.)])\s$/,
        ordered_list,
        (m) => ({ start: Number(m[1]), delimiter: m[2] }),
        (m, node) => node.childCount + (node.attrs.start as number) === Number(m[1]),
      ),
      markRule(/(?:^|[^`])(`([^`]+)`)$/, code, '`', null),
      markRule(/(?:^|[^*])(\*\*([^*\s](?:[^*]*[^*\s])?)\*\*)$/, strong, '**', { delim: '**' }),
      markRule(/(?:^|[^_\w])(__([^_\s](?:[^_]*[^_\s])?)__)$/, strong, '__', { delim: '__' }),
      markRule(/(?:^|[^*])(\*([^*\s](?:[^*]*[^*\s])?)\*)$/, em, '*', { delim: '*' }),
      markRule(/(?:^|[^_\w])(_([^_\s](?:[^_]*[^_\s])?)_)$/, em, '_', { delim: '_' }),
      markRule(/(?:^|[^~])(~~([^~\s](?:[^~]*[^~\s])?)~~)$/, strike, '~~', null),
      autolinkRule,
    ],
  });
}
