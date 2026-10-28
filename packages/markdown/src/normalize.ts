// SPDX-License-Identifier: LicenseRef-Proprietary
// Bentuk semantik sebuah node untuk perbandingan (escape minimal dan guard round-trip).
// Membuang informasi gaya penulisan yang tidak mengubah arti markdown.
import type { Mark, Node } from 'prosemirror-model';

const STYLE_ATTRS = new Set([
  'srcKey',
  'marker',
  'style',
  'fence',
  'fenceLength',
  'delim',
  'kind',
  'refLabel',
  'tight',
  'delimiter',
]);

/** Textblock yang soft break-nya ditulis sebagai spasi (heading, sel tabel). */
const SINGLE_LINE = new Set(['heading', 'table_cell']);

type Attrs = Record<string, unknown>;

interface NormMark {
  type: string;
  attrs?: Attrs;
}

type Item =
  | { text: string; marks: NormMark[]; code: boolean }
  | { br: 'soft' | 'hard' }
  | { node: string; attrs: Attrs; marks: NormMark[] };

function semanticAttrs(attrs: Record<string, unknown>): Attrs | undefined {
  const out: Attrs = {};
  for (const key of Object.keys(attrs).sort()) {
    if (!STYLE_ATTRS.has(key)) out[key] = attrs[key];
  }
  return Object.keys(out).length === 0 ? undefined : out;
}

function normMarks(marks: readonly Mark[]): NormMark[] {
  return marks.map((m) => {
    const attrs = semanticAttrs(m.attrs);
    return attrs ? { type: m.type.name, attrs } : { type: m.type.name };
  });
}

const sameMarks = (a: NormMark[], b: NormMark[]) => JSON.stringify(a) === JSON.stringify(b);
const isWs = (s: string) => /^[ \t]*$/.test(s);

function flatten(block: Node): Item[] {
  const items: Item[] = [];
  const softBreak = (): Item => ({ br: 'soft' });
  block.forEach((child) => {
    const marks = normMarks(child.marks);
    if (child.isText && child.marks.some((m) => m.type.name === 'code')) {
      // CommonMark: line ending di dalam code span setara dengan spasi.
      items.push({ text: (child.text ?? '').replace(/\r\n|\r|\n/g, ' '), marks, code: true });
    } else if (child.isText) {
      (child.text ?? '').split(/\r\n|\r|\n/).forEach((segment, i) => {
        if (i > 0) items.push(softBreak());
        if (segment !== '') items.push({ text: segment, marks, code: false });
      });
    } else if (child.type.name === 'soft_break') {
      items.push(softBreak());
    } else if (child.type.name === 'hard_break') {
      items.push({ br: 'hard' });
    } else {
      items.push({ node: child.type.name, attrs: semanticAttrs(child.attrs) ?? {}, marks });
    }
  });
  return items;
}

/** Trim spasi/tab di awal dan akhir setiap baris (dipisah break). */
function trimLines(items: Item[]): Item[] {
  const out: Item[] = [];
  let line: Item[] = [];
  const flush = () => {
    while (line.length > 0) {
      const first = line[0] as Item;
      if (!('text' in first)) break;
      const text = first.text.replace(/^[ \t]+/, '');
      if (text === '') line.shift();
      else {
        line[0] = { ...first, text };
        break;
      }
    }
    while (line.length > 0) {
      const last = line[line.length - 1] as Item;
      if (!('text' in last)) break;
      const text = last.text.replace(/[ \t]+$/, '');
      if (text === '') line.pop();
      else {
        line[line.length - 1] = { ...last, text };
        break;
      }
    }
    out.push(...line);
    line = [];
  };
  for (const item of items) {
    if ('br' in item) {
      flush();
      out.push(item);
    } else {
      line.push(item);
    }
  }
  flush();
  return out;
}

/** Pecah teks non-code menjadi potongan whitespace / non-whitespace. */
function splitWhitespace(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    if ('text' in item && !item.code) {
      for (const piece of item.text.match(/[ \t]+|[^ \t]+/g) ?? []) {
        out.push({ ...item, text: piece });
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

/** Mark pada whitespace hanya dipertahankan jika konten di kedua sisinya juga punya mark itu. */
function dropEdgeMarks(items: Item[]): Item[] {
  const content = (i: number) => {
    const item = items[i];
    return (
      item !== undefined && !('br' in item) && !('text' in item && !item.code && isWs(item.text))
    );
  };
  const neighbor = (from: number, step: number): Item | null => {
    for (let i = from + step; i >= 0 && i < items.length; i += step) {
      const item = items[i] as Item;
      if ('br' in item) return null;
      if (content(i)) return item;
    }
    return null;
  };
  // Mark pada whitespace tidak selalu bisa ditulis (mis. setelah mark bersilangan), jadi
  // bentuk kanoniknya: whitespace membawa irisan mark tetangga kiri dan kanannya (tanpa code).
  return items.map((item, i) => {
    if (!('text' in item) || item.code || !isWs(item.text)) return item;
    const before = neighbor(i, -1);
    const after = neighbor(i, 1);
    if (before === null || after === null || !('marks' in before) || !('marks' in after)) {
      return { ...item, marks: [] };
    }
    const marks = before.marks.filter(
      (m) => m.type !== 'code' && after.marks.some((x) => sameMarks([x], [m])),
    );
    return { ...item, marks };
  });
}

function mergeTexts(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      'text' in prev &&
      'text' in item &&
      prev.code === item.code &&
      sameMarks(prev.marks, item.marks)
    ) {
      out[out.length - 1] = { ...prev, text: prev.text + item.text };
    } else {
      out.push(item);
    }
  }
  return out.map(
    (item) => ('text' in item ? { text: item.text, marks: item.marks } : item) as Item,
  );
}

/** Di heading/sel tabel, soft break (setelah baris di-trim) setara dengan satu spasi. */
function joinSoftBreaks(items: Item[], block: Node): Item[] {
  if (!SINGLE_LINE.has(block.type.name)) return items;
  const joined = items.map((item) =>
    'br' in item && item.br === 'soft' ? { text: ' ', marks: [], code: false } : item,
  );
  return trimLines(joined);
}

/** Break di tepi blok dan soft break tepat setelah break lain tidak bermakna. */
function collapseBreaks(items: Item[]): Item[] {
  const out: Item[] = [];
  for (const item of items) {
    if ('br' in item) {
      const prev = out[out.length - 1];
      if (prev === undefined || (item.br === 'soft' && 'br' in prev)) continue;
    }
    out.push(item);
  }
  while (out.length > 0 && 'br' in (out[out.length - 1] as Item)) out.pop();
  return out;
}

function normalizeInline(block: Node): unknown[] {
  const lines = joinSoftBreaks(collapseBreaks(trimLines(flatten(block))), block);
  return mergeTexts(dropEdgeMarks(splitWhitespace(lines)));
}

function isEmptyParagraph(node: Node): boolean {
  return node.type.name === 'paragraph' && node.content.size === 0;
}

/** Struktur JSON semantik `node`; dua node setara jika hasilnya sama. */
export function normalizeForCompare(node: Node): unknown {
  const type = node.type.name;
  const attrs = semanticAttrs(node.attrs);
  const base = attrs ? { type, attrs } : { type };
  if (type === 'raw_block') {
    return { ...base, text: node.textContent.replace(/[ \t\r]+$/gm, '').replace(/\n+$/, '') };
  }
  if (node.type.spec.code) return { ...base, text: node.textContent };
  if (node.isTextblock) return { ...base, inline: normalizeInline(node) };
  if (node.isLeaf) return base;
  const content: unknown[] = [];
  node.forEach((child, _offset, i) => {
    if (isEmptyParagraph(child) && !(type === 'list_item' && i === 0)) return;
    content.push(normalizeForCompare(child));
  });
  return { ...base, content };
}
