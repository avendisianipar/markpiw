// SPDX-License-Identifier: LicenseRef-Proprietary
// Serializer dengan preservasi source (spesifikasi 3.3–3.4; algoritma di rencana Fase 1, Task 7).
import type { Node } from 'prosemirror-model';
import type { ParsedDoc, Profile, SourceEntry, SourceIndex, SrcKey } from '../types';
import { serializeFreshBlock } from './blocks';
import { makeReparse } from './escape';
import type { LinkDefinition } from './inline';
import type { Nodes } from 'mdast';
import { toMdast } from '../mdast';
import { type Ctx, ROOT_CTX, entryOf, freshContribution, sameContribution } from './context';

export interface SerializerState {
  readonly index: SourceIndex;
  readonly profile: Profile;
  readonly eol: '\n' | '\r\n';
  /** Parse ulang satu blok (dengan definisi link dokumen) untuk escape minimal. */
  readonly reparse: (md: string) => Node | null;
  /** Definisi link dokumen, untuk menulis link referensi. */
  readonly definitions: readonly LinkDefinition[];
}

function linkDefinitions(markdown: string): LinkDefinition[] {
  const out: LinkDefinition[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'definition') {
      out.push({ label: node.label ?? node.identifier, url: node.url, title: node.title ?? null });
    }
    if ('children' in node) node.children.forEach(visit);
  };
  visit(toMdast(markdown));
  return out;
}

/** Teks semua definisi link di `doc`, untuk parse ulang blok yang memakai referensi. */
function definitionsOf(doc: Node): string[] {
  const defs: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'raw_block' && node.attrs.kind === 'definition') {
      defs.push(node.textContent);
    }
    return node.isBlock && !node.isTextblock;
  });
  return defs;
}

export interface ChildrenResult {
  readonly text: string;
  /** Entri anak pertama dan terakhir yang dikeluarkan (jika ada). */
  readonly firstEntry: SourceEntry | undefined;
  readonly lastEntry: SourceEntry | undefined;
  readonly emitted: number;
}

const NEW_PARENT = -1 as SrcKey;

function isEmptyParagraph(node: Node): boolean {
  return node.type.name === 'paragraph' && node.content.size === 0;
}

function isList(node: Node): boolean {
  return node.type.name === 'bullet_list' || node.type.name === 'ordered_list';
}

/**
 * Serialisasi anak-anak `parent`. `ctxFirst` untuk anak pertama yang dikeluarkan, `ctxOther`
 * untuk sisanya. `tightItem` = `parent` adalah list_item dari list yang tight.
 */
export function serializeChildren(
  parent: Node,
  ctxFirst: Ctx,
  ctxOther: Ctx,
  parentStable: boolean,
  s: SerializerState,
  tightItem = false,
): ChildrenResult {
  const list = isList(parent) ? parent : null;
  // Spesifikasi 3.3 aturan 1: verbatim hanya di container induk yang sama seperti di source.
  // Container baru (tanpa srcKey) tidak pernah cocok dengan entri mana pun.
  const parentKey =
    parent.type.name === 'doc' ? null : ((parent.attrs.srcKey as SrcKey | null) ?? NEW_PARENT);
  // Posisi anak pertama/lainnya hanya penting jika prefix baris pertamanya berbeda (list_item).
  const positional = ctxFirst.first !== ctxOther.first || ctxFirst.rest !== ctxOther.rest;
  let text = '';
  let prev: Node | null = null;
  let emitted = 0;
  let firstEntry: SourceEntry | undefined;
  let lastEntry: SourceEntry | undefined;

  parent.forEach((child, _offset, i) => {
    // Aturan 4: paragraf kosong dilewati, kecuali anak pertama list_item (item kosong).
    if (isEmptyParagraph(child) && !(parent.type.name === 'list_item' && i === 0)) return;

    const e = entryOf(child, s.index);
    const first = emitted === 0;
    const ctx = first ? ctxFirst : ctxOther;
    const stable =
      parentStable &&
      e !== undefined &&
      e.parentKey === parentKey &&
      (!positional || (e.prevKey === null) === first);

    let piece: string;
    if (
      stable &&
      (child === e.node || child.eq(e.node)) &&
      (!isContainer(child) ||
        sameContribution(freshContribution(child, e, s, i, list), e.contribution))
    ) {
      piece = e.text;
    } else {
      piece = serializeFreshBlock(child, ctx, stable, s, { list, itemIndex: i, tightItem });
    }

    if (prev !== null) {
      if (stable && e.prevKey !== null && prev.attrs.srcKey === e.prevKey) {
        text += e.sepBefore;
      } else {
        const tight = (list !== null && list.attrs.tight === true) || (tightItem && isList(child));
        text += tight ? s.eol : s.eol + ctxOther.rest.trimEnd() + s.eol;
      }
    }
    text += piece;
    prev = child;
    if (first) firstEntry = e;
    lastEntry = e;
    emitted++;
  });

  return { text, firstEntry, lastEntry, emitted };
}

function isContainer(node: Node): boolean {
  return node.type.name === 'blockquote' || node.type.name === 'list_item';
}

/** Serialisasi `doc` (hasil edit dari `parsed.doc`) kembali menjadi markdown. */
export function serializeMarkdown(parsed: ParsedDoc, doc: Node): string {
  const definitions = definitionsOf(doc);
  const s: SerializerState = {
    reparse: makeReparse(definitions),
    definitions: linkDefinitions(definitions.join('\n\n')),
    index: parsed.index,
    profile: parsed.profile,
    eol: parsed.profile.eol,
  };
  const bom = s.profile.bom ? '\uFEFF' : '';
  const r = serializeChildren(doc, ROOT_CTX, ROOT_CTX, true, s);
  if (r.emitted === 0) return bom + (s.index.size === 0 ? s.index.trailing : '');
  const atRoot = (e: SourceEntry | undefined) => e !== undefined && e.parentKey === null;
  const leading = atRoot(r.firstEntry) && r.firstEntry?.prevKey === null ? s.index.leading : '';
  const trailing =
    atRoot(r.lastEntry) && r.lastEntry?.isLast
      ? s.index.trailing
      : s.profile.finalNewline
        ? s.eol
        : '';
  return bom + leading + r.text + trailing;
}
