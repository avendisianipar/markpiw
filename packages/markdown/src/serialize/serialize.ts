// SPDX-License-Identifier: LicenseRef-Proprietary
// Serializer dengan preservasi source (spesifikasi 3.3–3.4; algoritma di rencana Fase 1, Task 7).
import type { Node } from 'prosemirror-model';
import type { ParsedDoc, Profile, SourceEntry, SourceIndex } from '../types';
import { serializeFreshBlock } from './blocks';
import { type Ctx, ROOT_CTX, entryOf, freshContribution, sameContribution } from './context';

export interface SerializerState {
  readonly index: SourceIndex;
  readonly profile: Profile;
  readonly eol: '\n' | '\r\n';
}

export interface ChildrenResult {
  readonly text: string;
  /** Entri anak pertama dan terakhir yang dikeluarkan (jika ada). */
  readonly firstEntry: SourceEntry | undefined;
  readonly lastEntry: SourceEntry | undefined;
  readonly emitted: number;
}

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
    const stable = parentStable && e !== undefined && (e.prevKey === null) === first;

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
  const s: SerializerState = {
    index: parsed.index,
    profile: parsed.profile,
    eol: parsed.profile.eol,
  };
  const bom = s.profile.bom ? '﻿' : '';
  const r = serializeChildren(doc, ROOT_CTX, ROOT_CTX, true, s);
  if (r.emitted === 0) return bom + (s.index.size === 0 ? s.index.trailing : '');
  const leading = r.firstEntry?.prevKey === null ? s.index.leading : '';
  const trailing = r.lastEntry?.isLast ? s.index.trailing : s.profile.finalNewline ? s.eol : '';
  return bom + leading + r.text + trailing;
}
