// SPDX-License-Identifier: LicenseRef-Proprietary
// mdast → dokumen ProseMirror + indeks source (spesifikasi 3.2–3.3; aturan di rencana Fase 1,
// Task 5 dan 6).
import type {
  Blockquote,
  Code,
  Definition,
  Heading,
  List,
  ListItem,
  Nodes,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from 'mdast';
import type { Mark, Node } from 'prosemirror-model';
import { LineIndex } from './lines';
import { schema } from './schema';
import { MutableSourceIndex } from './source-index';
import type { Contribution, SourceEntry, SrcKey } from './types';

type RawKind = 'frontmatter' | 'html' | 'definition' | 'footnote' | 'unknown';

/** Dilempar saat konstruksi mdast tidak muat di schema; node tingkat atas menjadi raw_block. */
class StructureFallback extends Error {}

/** Prefix lanjutan gabungan dari semua container leluhur. */
interface BuildCtx {
  readonly rest: string;
}

/** Posisi sebuah node di antara saudara-saudaranya di source. */
interface Sibling {
  readonly prevKey: SrcKey | null;
  readonly prevEnd: number | null;
  readonly isLast: boolean;
  /**
   * Offset awal minimum: awal baris setelah saudara sebelumnya. Posisi mdast bisa tumpang
   * tindih dengan saudara sebelumnya (heading setext mencakup definisi link di atasnya).
   */
  readonly minStart: number;
}

type EntryExtras = Partial<
  Pick<SourceEntry, 'contribution' | 'listNumber' | 'tableLines' | 'tableAligned'>
>;

const ROOT_CTX: BuildCtx = { rest: '' };
const MARKER = /^(\d+[.)]|[-*+])([ \t]*)/;

function start(node: Nodes): number {
  const offset = node.position?.start.offset;
  if (offset === undefined) throw new StructureFallback('mdast node tanpa posisi');
  return offset;
}

function end(node: Nodes): number {
  const offset = node.position?.end.offset;
  if (offset === undefined) throw new StructureFallback('mdast node tanpa posisi');
  return offset;
}

/**
 * Buang prefix lanjutan container (`ctx.rest`) dari awal sebuah baris. Toleran terhadap
 * baris lazy (prefix `>` tidak ada) dan variasi spasi/tab.
 */
function stripPrefix(line: string, rest: string): string {
  let i = 0;
  for (const ch of rest) {
    if (ch === '>') {
      let j = i;
      while (j < line.length && j - i < 3 && line[j] === ' ') j++;
      if (line[j] !== '>') break;
      i = j + 1;
    } else if (line[i] === ' ' || line[i] === '\t') {
      i++;
    } else if (ch !== ' ' && ch !== '\t') {
      break;
    }
  }
  return line.slice(i);
}

/** Lebar marker+padding sebagai spasi; tab di padding dipertahankan. */
function markerRest(first: string): string {
  const m = MARKER.exec(first);
  if (!m) return '  ';
  return ' '.repeat((m[1] as string).length) + (m[2] as string);
}

export class DocBuilder {
  private readonly lines: LineIndex;
  private readonly definitions = new Map<string, { url: string; title: string | null }>();
  private readonly index = new MutableSourceIndex();

  constructor(private readonly source: string) {
    this.lines = new LineIndex(source);
  }

  build(root: Root): { doc: Node; index: MutableSourceIndex } {
    this.collectDefinitions(root);
    const blocks = this.siblings(root.children, (child, sib) => this.topLevel(child, sib));
    const first = root.children[0];
    const last = root.children[root.children.length - 1];
    if (first && last) {
      this.index.leading = this.source.slice(0, this.lines.lineStart(start(first)));
      this.index.trailing = this.source.slice(this.lines.lineEnd(end(last)));
    } else {
      this.index.trailing = this.source;
    }
    if (blocks.length === 0) blocks.push(schema.nodes.paragraph.create());
    return { doc: schema.nodes.doc.create(null, blocks), index: this.index };
  }

  /** Konversi anak-anak berurutan sambil melacak saudara sebelumnya di source. */
  private siblings<T extends Nodes>(
    children: readonly T[],
    convert: (child: T, sib: Sibling) => Node,
  ): Node[] {
    const out: Node[] = [];
    let prevKey: SrcKey | null = null;
    let prevEnd: number | null = null;
    children.forEach((child, i) => {
      const minStart = prevEnd === null ? 0 : this.nextLineStart(prevEnd);
      const isLast = i === children.length - 1;
      const node = convert(child, { prevKey, prevEnd, isLast, minStart });
      out.push(node);
      prevKey = (node.attrs.srcKey as SrcKey | null) ?? null;
      prevEnd = end(child);
    });
    return out;
  }

  /** Awal baris setelah baris yang memuat `offset`. */
  private nextLineStart(offset: number): number {
    const nl = this.source.indexOf('\n', offset);
    return nl === -1 ? this.source.length : nl + 1;
  }

  /** Daftarkan entri indeks untuk `node` dan kembalikan node dengan `srcKey`-nya. */
  private keyed(node: Node, md: Nodes, sib: Sibling, extras: EntryExtras = {}): Node {
    const from = this.lines.lineStart(Math.max(start(md), sib.minStart));
    const keyedNode = node.type.create(
      { ...node.attrs, srcKey: this.index.peekKey() },
      node.content,
      node.marks,
    );
    this.index.add({
      node: keyedNode,
      text: this.source.slice(from, this.lines.lineEnd(end(md))),
      prevKey: sib.prevKey,
      sepBefore:
        sib.prevEnd === null ? '' : this.source.slice(this.lines.lineEnd(sib.prevEnd), from),
      isLast: sib.isLast,
      contribution: null,
      listNumber: null,
      tableLines: null,
      tableAligned: false,
      ...extras,
    });
    return keyedNode;
  }

  private collectDefinitions(node: Nodes): void {
    if (node.type === 'definition') {
      const def = node as Definition;
      if (!this.definitions.has(def.identifier)) {
        this.definitions.set(def.identifier, { url: def.url, title: def.title ?? null });
      }
    }
    if ('children' in node) for (const child of node.children) this.collectDefinitions(child);
  }

  private topLevel(node: RootContent, sib: Sibling): Node {
    const exact = (kind: RawKind) =>
      this.keyed(this.raw(kind, this.source.slice(start(node), end(node))), node, sib);
    switch (node.type) {
      case 'html':
        return exact('html');
      case 'yaml':
        return exact('frontmatter');
      case 'definition':
        return exact('definition');
      case 'footnoteDefinition':
        return exact('footnote');
    }
    const size = this.index.size;
    try {
      return this.block(node, ROOT_CTX, sib);
    } catch {
      this.index.truncate(size);
      const text = this.source.slice(
        this.lines.lineStart(Math.max(start(node), sib.minStart)),
        this.lines.lineEnd(end(node)),
      );
      return this.keyed(this.raw('unknown', text), node, sib);
    }
  }

  private raw(kind: RawKind, text: string): Node {
    return schema.nodes.raw_block.create({ kind }, text === '' ? null : schema.text(text));
  }

  /** Raw di dalam container: pakai `value` jika ada, selain itu slice tanpa prefix lanjutan. */
  private nestedRaw(kind: RawKind, node: Nodes, ctx: BuildCtx): Node {
    if ('value' in node && typeof node.value === 'string') return this.raw(kind, node.value);
    const [first = '', ...others] = this.source.slice(start(node), end(node)).split('\n');
    const text = [first, ...others.map((line) => stripPrefix(line, ctx.rest))].join('\n');
    return this.raw(kind, text);
  }

  private block(node: RootContent, ctx: BuildCtx, sib: Sibling): Node {
    switch (node.type) {
      case 'paragraph':
        return this.keyed(
          schema.nodes.paragraph.create(null, this.inline(node.children, [])),
          node,
          sib,
        );
      case 'heading':
        return this.keyed(this.heading(node), node, sib);
      case 'blockquote':
        return this.blockquote(node, ctx, sib);
      case 'list':
        return this.keyed(this.list(node, ctx), node, sib);
      case 'code':
        return this.keyed(this.code(node), node, sib);
      case 'thematicBreak': {
        const marker = this.source.slice(start(node), end(node)).trim();
        return this.keyed(schema.nodes.horizontal_rule.create({ marker }), node, sib);
      }
      case 'table':
        return this.table(node, ctx, sib);
      case 'html':
        return this.keyed(this.nestedRaw('html', node, ctx), node, sib);
      case 'yaml':
        return this.keyed(this.nestedRaw('frontmatter', node, ctx), node, sib);
      case 'definition':
        return this.keyed(this.nestedRaw('definition', node, ctx), node, sib);
      case 'footnoteDefinition':
        return this.keyed(this.nestedRaw('footnote', node, ctx), node, sib);
      default:
        return this.keyed(this.nestedRaw('unknown', node, ctx), node, sib);
    }
  }

  private heading(node: Heading): Node {
    const style = this.source[start(node)] === '#' ? 'atx' : 'setext';
    return schema.nodes.heading.create(
      { level: node.depth, style },
      this.inline(node.children, []),
    );
  }

  private blockquote(node: Blockquote, ctx: BuildCtx, sib: Sibling): Node {
    const contribution = this.blockquoteContribution(node);
    const childCtx = { rest: ctx.rest + contribution.rest };
    const content = this.siblings(node.children, (child, s) => this.block(child, childCtx, s));
    if (content.length === 0) content.push(schema.nodes.paragraph.create());
    return this.keyed(schema.nodes.blockquote.create(null, content), node, sib, { contribution });
  }

  /** Slice sampai awal anak pertama jika di baris yang sama, selain itu `> `. */
  private blockquoteContribution(node: Blockquote): Contribution {
    const first = node.children[0];
    if (first) {
      const from = start(node);
      const to = start(first);
      if (this.lines.lineStart(to) === this.lines.lineStart(from)) {
        const prefix = this.source.slice(from, to);
        return { first: prefix, rest: prefix };
      }
    }
    return { first: '> ', rest: '> ' };
  }

  private list(node: List, ctx: BuildCtx): Node {
    const tight = !(node.spread || node.children.some((item) => item.spread));
    const items = this.siblings(node.children, (item, s) =>
      this.listItem(item, ctx, s, node.ordered === true),
    );
    const firstItem = node.children[0];
    const marker = firstItem ? this.source.slice(start(firstItem), start(firstItem) + 12) : '';
    if (node.ordered) {
      const delimiter = /^\d+([.)])/.exec(marker)?.[1] ?? '.';
      return schema.nodes.ordered_list.create({ start: node.start ?? 1, delimiter, tight }, items);
    }
    return schema.nodes.bullet_list.create({ marker: marker[0] ?? '-', tight }, items);
  }

  private listItem(item: ListItem, ctx: BuildCtx, sib: Sibling, ordered: boolean): Node {
    const first = item.children[0];
    if (first && first.type !== 'paragraph') {
      throw new StructureFallback('list item tidak diawali paragraph');
    }
    const from = start(item);
    const head = this.source.slice(from, this.lines.lineEnd(from));
    let contribution: Contribution | null = null;
    if (first && this.lines.lineStart(start(first)) === this.lines.lineStart(from)) {
      const prefix = this.source.slice(from, start(first));
      contribution = { first: prefix, rest: markerRest(prefix) };
    }
    const childCtx = { rest: ctx.rest + (contribution?.rest ?? markerRest(head)) };
    const content = this.siblings(item.children, (child, s) => this.block(child, childCtx, s));
    if (content.length === 0) content.push(schema.nodes.paragraph.create());
    const listNumber = ordered ? Number(/^\d+/.exec(head)?.[0] ?? NaN) : null;
    return this.keyed(
      schema.nodes.list_item.create({ checked: item.checked ?? null }, content),
      item,
      sib,
      { contribution, listNumber: Number.isNaN(listNumber) ? null : listNumber },
    );
  }

  private code(node: Code): Node {
    const at = start(node);
    const ch = this.source[at];
    const fence = ch === '`' ? '```' : ch === '~' ? '~~~' : 'indented';
    let fenceLength: number | null = null;
    if (fence !== 'indented') {
      let i = at;
      while (this.source[i] === ch) i++;
      fenceLength = i - at;
    }
    const lang = node.lang ? node.lang + (node.meta ? ` ${node.meta}` : '') : '';
    return schema.nodes.code_block.create(
      { lang, fence, fenceLength },
      node.value === '' ? null : schema.text(node.value),
    );
  }

  private table(node: Table, ctx: BuildCtx, sib: Sibling): Node {
    const rows = node.children.map((row, r) =>
      schema.nodes.table_row.create(
        null,
        row.children.map((cell) =>
          schema.nodes.table_cell.create({ header: r === 0 }, this.inline(cell.children, [])),
        ),
      ),
    );
    const [first = '', ...others] = this.source
      .slice(start(node), this.lines.lineEnd(end(node)))
      .split(/\r?\n/);
    const tableLines = [first, ...others.map((line) => stripPrefix(line, ctx.rest))];
    const tableAligned =
      tableLines.length >= 2 && tableLines.every((line) => line.length === first.length);
    return this.keyed(schema.nodes.table.create({ align: node.align ?? [] }, rows), node, sib, {
      tableLines,
      tableAligned,
    });
  }

  private inline(children: readonly PhrasingContent[], marks: readonly Mark[]): Node[] {
    const out: Node[] = [];
    for (const child of children) this.inlineNode(child, marks, out);
    return out;
  }

  private inlineNode(node: PhrasingContent, marks: readonly Mark[], out: Node[]): void {
    const withMark = (mark: Mark) => mark.addToSet(marks);
    switch (node.type) {
      case 'text':
        this.text(node.value, marks, out);
        return;
      case 'emphasis': {
        const em = schema.marks.em.create({ delim: this.source[start(node)] });
        out.push(...this.inline(node.children, withMark(em)));
        return;
      }
      case 'strong': {
        const delim = this.source.slice(start(node), start(node) + 2);
        out.push(...this.inline(node.children, withMark(schema.marks.strong.create({ delim }))));
        return;
      }
      case 'delete':
        out.push(...this.inline(node.children, withMark(schema.marks.strike.create())));
        return;
      case 'inlineCode':
        if (node.value === '') out.push(this.rawInline(node, marks));
        else out.push(schema.text(node.value, withMark(schema.marks.code.create())));
        return;
      case 'break': {
        const style = this.source[start(node)] === '\\' ? 'backslash' : 'spaces';
        out.push(schema.nodes.hard_break.create({ style }, null, marks));
        return;
      }
      case 'link': {
        if (node.children.length === 0) {
          out.push(this.rawInline(node, marks));
          return;
        }
        const ch = this.source[start(node)];
        const kind = ch === '<' ? 'autolink' : ch === '[' ? 'inline' : 'literal';
        const link = schema.marks.link.create({
          href: node.url,
          title: node.title ?? null,
          kind,
          refLabel: null,
        });
        out.push(...this.inline(node.children, withMark(link)));
        return;
      }
      case 'linkReference': {
        if (node.children.length === 0) {
          out.push(this.rawInline(node, marks));
          return;
        }
        const def = this.definitions.get(node.identifier);
        const refLabel =
          node.referenceType === 'full'
            ? (node.label ?? node.identifier)
            : node.referenceType === 'collapsed'
              ? ''
              : null;
        const link = schema.marks.link.create({
          href: def?.url ?? '',
          title: def?.title ?? null,
          kind: 'reference',
          refLabel,
        });
        out.push(...this.inline(node.children, withMark(link)));
        return;
      }
      case 'image':
        out.push(
          schema.nodes.image.create(
            { src: node.url, alt: node.alt ?? '', title: node.title ?? null },
            null,
            marks,
          ),
        );
        return;
      default:
        out.push(this.rawInline(node, marks));
    }
  }

  private text(value: string, marks: readonly Mark[], out: Node[]): void {
    value.split(/\r?\n/).forEach((segment, i) => {
      if (i > 0) out.push(schema.nodes.soft_break.create(null, null, marks));
      if (segment !== '') out.push(schema.text(segment, marks));
    });
  }

  private rawInline(node: PhrasingContent, marks: readonly Mark[]): Node {
    return schema.nodes.raw_inline.create(
      { source: this.source.slice(start(node), end(node)) },
      null,
      marks,
    );
  }
}

/** Bangun dokumen dan indeks source dari teks (tanpa BOM) dan mdast-nya. */
export function buildDoc(text: string, root: Root): { doc: Node; index: MutableSourceIndex } {
  return new DocBuilder(text).build(root);
}
