// SPDX-License-Identifier: LicenseRef-Proprietary
// mdast → dokumen ProseMirror (spesifikasi 3.2; aturan pemetaan di rencana Fase 1, Task 5).
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

type RawKind = 'frontmatter' | 'html' | 'definition' | 'footnote' | 'unknown';

/** Dilempar saat konstruksi mdast tidak muat di schema; node tingkat atas menjadi raw_block. */
class StructureFallback extends Error {}

/** Prefix lanjutan gabungan dari semua container leluhur. */
interface BuildCtx {
  readonly rest: string;
}

const ROOT_CTX: BuildCtx = { rest: '' };

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

export class DocBuilder {
  private readonly lines: LineIndex;
  private readonly definitions = new Map<string, { url: string; title: string | null }>();

  constructor(private readonly source: string) {
    this.lines = new LineIndex(source);
  }

  build(root: Root): Node {
    this.collectDefinitions(root);
    const blocks: Node[] = [];
    for (const child of root.children) blocks.push(...this.topLevel(child));
    if (blocks.length === 0) blocks.push(schema.nodes.paragraph.create());
    return schema.nodes.doc.create(null, blocks);
  }

  /** Slice dari awal baris `node` dimulai sampai akhir baris `node` berakhir. */
  private lineSlice(node: Nodes): string {
    return this.source.slice(this.lines.lineStart(start(node)), this.lines.lineEnd(end(node)));
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

  private topLevel(node: RootContent): Node[] {
    switch (node.type) {
      case 'html':
        return [this.raw('html', this.source.slice(start(node), end(node)))];
      case 'yaml':
        return [this.raw('frontmatter', this.source.slice(start(node), end(node)))];
      case 'definition':
        return [this.raw('definition', this.source.slice(start(node), end(node)))];
      case 'footnoteDefinition':
        return [this.raw('footnote', this.source.slice(start(node), end(node)))];
    }
    try {
      return this.block(node, ROOT_CTX);
    } catch {
      return [this.raw('unknown', this.lineSlice(node))];
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

  private block(node: RootContent, ctx: BuildCtx): Node[] {
    switch (node.type) {
      case 'paragraph':
        return [schema.nodes.paragraph.create(null, this.inline(node.children, []))];
      case 'heading':
        return [this.heading(node)];
      case 'blockquote':
        return [this.blockquote(node, ctx)];
      case 'list':
        return [this.list(node, ctx)];
      case 'code':
        return [this.code(node)];
      case 'thematicBreak':
        return [
          schema.nodes.horizontal_rule.create({
            marker: this.source.slice(start(node), end(node)).trim(),
          }),
        ];
      case 'table':
        return [this.table(node)];
      case 'html':
        return [this.nestedRaw('html', node, ctx)];
      case 'yaml':
        return [this.nestedRaw('frontmatter', node, ctx)];
      case 'definition':
        return [this.nestedRaw('definition', node, ctx)];
      case 'footnoteDefinition':
        return [this.nestedRaw('footnote', node, ctx)];
      default:
        return [this.nestedRaw('unknown', node, ctx)];
    }
  }

  private blocks(children: readonly RootContent[], ctx: BuildCtx): Node[] {
    const out: Node[] = [];
    for (const child of children) out.push(...this.block(child, ctx));
    return out;
  }

  private heading(node: Heading): Node {
    const style = this.source[start(node)] === '#' ? 'atx' : 'setext';
    return schema.nodes.heading.create(
      { level: node.depth, style },
      this.inline(node.children, []),
    );
  }

  private blockquote(node: Blockquote, ctx: BuildCtx): Node {
    const childCtx = { rest: ctx.rest + this.blockquotePrefix(node) };
    const content = this.blocks(node.children, childCtx);
    if (content.length === 0) content.push(schema.nodes.paragraph.create());
    return schema.nodes.blockquote.create(null, content);
  }

  /** Prefix blockquote: slice sampai awal anak pertama jika di baris yang sama, selain itu `> `. */
  protected blockquotePrefix(node: Blockquote): string {
    const first = node.children[0];
    if (first) {
      const from = start(node);
      const to = start(first);
      if (this.lines.lineStart(to) === this.lines.lineStart(from)) {
        return this.source.slice(from, to);
      }
    }
    return '> ';
  }

  private list(node: List, ctx: BuildCtx): Node {
    const tight = !(node.spread || node.children.some((item) => item.spread));
    const items = node.children.map((item) => this.listItem(item, ctx));
    const firstItem = node.children[0];
    const marker = firstItem ? this.source.slice(start(firstItem)) : '';
    if (node.ordered) {
      const delimiter = /^\d+([.)])/.exec(marker)?.[1] ?? '.';
      return schema.nodes.ordered_list.create({ start: node.start ?? 1, delimiter, tight }, items);
    }
    return schema.nodes.bullet_list.create({ marker: marker[0] ?? '-', tight }, items);
  }

  private listItem(item: ListItem, ctx: BuildCtx): Node {
    const first = item.children[0];
    if (first && first.type !== 'paragraph') {
      throw new StructureFallback('list item tidak diawali paragraph');
    }
    const childCtx = { rest: ctx.rest + this.itemRest(item) };
    const content = this.blocks(item.children, childCtx);
    if (content.length === 0) content.push(schema.nodes.paragraph.create());
    return schema.nodes.list_item.create({ checked: item.checked ?? null }, content);
  }

  /** Lebar marker+padding item sebagai spasi (tab dipertahankan). */
  protected itemRest(item: ListItem): string {
    const m = /^(\d+[.)]|[-*+])([ \t]*)/.exec(this.source.slice(start(item), start(item) + 16));
    if (!m) return '  ';
    return ' '.repeat((m[1] as string).length) + (m[2] as string);
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

  private table(node: Table): Node {
    const rows = node.children.map((row, r) =>
      schema.nodes.table_row.create(
        null,
        row.children.map((cell) =>
          schema.nodes.table_cell.create({ header: r === 0 }, this.inline(cell.children, [])),
        ),
      ),
    );
    return schema.nodes.table.create({ align: node.align ?? [] }, rows);
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
      case 'emphasis':
        out.push(
          ...this.inline(
            node.children,
            withMark(schema.marks.em.create({ delim: this.source[start(node)] })),
          ),
        );
        return;
      case 'strong':
        out.push(
          ...this.inline(
            node.children,
            withMark(
              schema.marks.strong.create({
                delim: this.source.slice(start(node), start(node) + 2),
              }),
            ),
          ),
        );
        return;
      case 'delete':
        out.push(...this.inline(node.children, withMark(schema.marks.strike.create())));
        return;
      case 'inlineCode':
        if (node.value === '') {
          out.push(this.rawInline(node, marks));
        } else {
          out.push(schema.text(node.value, withMark(schema.marks.code.create())));
        }
        return;
      case 'break': {
        const style = this.source[start(node)] === '\\' ? 'backslash' : 'spaces';
        out.push(schema.nodes.hard_break.create({ style }, null, marks));
        return;
      }
      case 'link': {
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

/** Bangun dokumen dari teks (tanpa BOM) dan mdast-nya. */
export function buildDoc(text: string, root: Root): Node {
  return new DocBuilder(text).build(root);
}
