// SPDX-License-Identifier: LicenseRef-Proprietary
// Serialisasi ulang blok (rencana Fase 1, Task 9). Setiap baris non-pertama memakai `ctx.rest`;
// baris kosong memakai `ctx.rest.trimEnd()`; semua line break memakai `profile.eol`.
import type { Node } from 'prosemirror-model';
import type { Contribution } from '../types';
import { type Ctx, entryOf, freshContribution, sameContribution } from './context';
import { escapeMinimal } from './escape';
import { inlineWithCandidates } from './inline';
import { type SerializerState, serializeChildren } from './serialize';
import { serializeTable } from './table';

/** Info posisi untuk list_item: list induk dan indeks item. */
export interface FreshOptions {
  readonly list: Node | null;
  readonly itemIndex: number;
  readonly tightItem: boolean;
}

const DEFAULT_BLOCKQUOTE: Contribution = { first: '> ', rest: '> ' };

/** Tambahkan prefix `ctx` ke setiap baris `md` (baris kosong memakai `ctx.rest.trimEnd()`). */
export function prefixLines(md: string, ctx: Ctx, eol: string): string {
  return md
    .split(eol)
    .map((line, i) => {
      if (i === 0) return ctx.first + line;
      return line === '' ? ctx.rest.trimEnd() : ctx.rest + line;
    })
    .join(eol);
}

/** Pecah teks (mungkin campuran CRLF/LF) menjadi baris lalu gabungkan dengan `eol`. */
const relines = (text: string, eol: string) => text.split(/\r?\n/).join(eol);

function paragraph(node: Node, ctx: Ctx, s: SerializerState): string {
  if (node.content.size === 0) return ctx.first.trimEnd();
  const inline = inlineWithCandidates(node, s.profile, s.eol, {
    inTable: false,
    inAtxHeading: false,
    definitions: s.definitions,
  });
  return prefixLines(escapeMinimal(inline.text, inline.candidates, node, s.reparse), ctx, s.eol);
}

function heading(node: Node, ctx: Ctx, s: SerializerState): string {
  const level = node.attrs.level as number;
  let hardBreak = false;
  node.forEach((child) => {
    if (child.type.name === 'hard_break') hardBreak = true;
  });
  // ATX tidak bisa membawa hard break; setext (level 1–2) bisa.
  const style = hardBreak
    ? 'setext'
    : ((node.attrs.style as 'atx' | 'setext' | null) ?? s.profile.headingStyle);
  if (style === 'setext' && level <= 2 && node.content.size > 0) {
    const inline = inlineWithCandidates(node, s.profile, s.eol, {
      inTable: false,
      inAtxHeading: false,
      definitions: s.definitions,
    });
    const lastLine = inline.text.split(s.eol).pop() ?? '';
    const underline = (level === 1 ? '=' : '-').repeat(Math.max(3, lastLine.length));
    const md = escapeMinimal(inline.text + s.eol + underline, inline.candidates, node, s.reparse);
    return prefixLines(md, ctx, s.eol);
  }
  const hashes = '#'.repeat(level);
  if (node.content.size === 0) return ctx.first + hashes;
  const inline = inlineWithCandidates(
    node,
    s.profile,
    s.eol,
    { inTable: false, inAtxHeading: true, definitions: s.definitions },
    false,
  );
  const prefix = hashes + ' ';
  const candidates = inline.candidates.map((c) => c + prefix.length);
  return ctx.first + escapeMinimal(prefix + inline.text, candidates, node, s.reparse);
}

function codeBlock(node: Node, ctx: Ctx, s: SerializerState): string {
  const lang = node.attrs.lang as string;
  const content = node.textContent;
  const fenceAttr = node.attrs.fence as '```' | '~~~' | 'indented' | null;
  if (fenceAttr === 'indented' && lang === '' && content !== '') {
    const body = content
      .split(/\r?\n/)
      .map((line) => (line === '' ? '' : '    ' + line))
      .join(s.eol);
    return prefixLines(body, ctx, s.eol);
  }
  const fence = fenceAttr === '```' || fenceAttr === '~~~' ? fenceAttr : s.profile.fence;
  const ch = fence[0] as string;
  let longest = 0;
  for (const run of content.match(ch === '`' ? /`+/g : /~+/g) ?? []) {
    longest = Math.max(longest, run.length);
  }
  const marker = ch.repeat(Math.max((node.attrs.fenceLength as number | null) ?? 3, longest + 1));
  const lines = [marker + lang];
  if (content !== '') lines.push(relines(content, s.eol));
  lines.push(marker);
  return prefixLines(lines.join(s.eol), ctx, s.eol);
}

function blockquote(node: Node, ctx: Ctx, stable: boolean, s: SerializerState): string {
  const e = entryOf(node, s.index);
  const c = e?.contribution ?? DEFAULT_BLOCKQUOTE;
  const inner = { first: ctx.first + c.first, rest: ctx.rest + c.rest };
  const other = { first: ctx.rest + c.rest, rest: ctx.rest + c.rest };
  const childStable = stable && sameContribution(c, e?.contribution ?? null);
  const r = serializeChildren(node, inner, other, childStable, s);
  return r.emitted === 0 ? inner.first.trimEnd() : r.text;
}

function listItem(
  node: Node,
  ctx: Ctx,
  stable: boolean,
  s: SerializerState,
  opts: FreshOptions | undefined,
): string {
  const e = entryOf(node, s.index);
  const c = freshContribution(node, e, s, opts?.itemIndex ?? 0, opts?.list ?? null);
  const inner = { first: ctx.first + c.first, rest: ctx.rest + c.rest };
  const other = { first: ctx.rest + c.rest, rest: ctx.rest + c.rest };
  const childStable = stable && sameContribution(c, e?.contribution ?? null);
  const tight = opts?.list?.attrs.tight === true;
  const r = serializeChildren(node, inner, other, childStable, s, tight);
  return r.emitted === 0 ? inner.first.trimEnd() : r.text;
}

export function serializeFreshBlock(
  node: Node,
  ctx: Ctx,
  stable: boolean,
  s: SerializerState,
  opts?: FreshOptions,
): string {
  switch (node.type.name) {
    case 'paragraph':
      return paragraph(node, ctx, s);
    case 'heading':
      return heading(node, ctx, s);
    case 'code_block':
      return codeBlock(node, ctx, s);
    case 'horizontal_rule':
      return ctx.first + ((node.attrs.marker as string | null) ?? '---');
    case 'raw_block':
      return prefixLines(relines(node.textContent, s.eol), ctx, s.eol);
    case 'blockquote':
      return blockquote(node, ctx, stable, s);
    case 'bullet_list':
    case 'ordered_list':
      return serializeChildren(node, ctx, { first: ctx.rest, rest: ctx.rest }, stable, s).text;
    case 'list_item':
      return listItem(node, ctx, stable, s, opts);
    case 'table':
      return serializeTable(node, ctx, s);
    default:
      throw new Error(`markpiw: tidak bisa menserialisasi node ${node.type.name}`);
  }
}
