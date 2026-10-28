// SPDX-License-Identifier: LicenseRef-Proprietary
// Serialisasi ulang blok (rencana Fase 1, Task 8–9).
import type { Node } from 'prosemirror-model';
import type { Ctx } from './context';
import { escapeMinimal, reparseBlock } from './escape';
import { inlineWithCandidates } from './inline';
import type { SerializerState } from './serialize';

/** Info posisi untuk list_item: list induk dan indeks item. */
export interface FreshOptions {
  readonly list: Node | null;
  readonly itemIndex: number;
  readonly tightItem: boolean;
}

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

function paragraph(node: Node, ctx: Ctx, s: SerializerState): string {
  const inline = inlineWithCandidates(node, s.profile, s.eol, {
    inTable: false,
    inAtxHeading: false,
  });
  return prefixLines(escapeMinimal(inline.text, inline.candidates, node, reparseBlock), ctx, s.eol);
}

export function serializeFreshBlock(
  node: Node,
  ctx: Ctx,
  _stable: boolean,
  s: SerializerState,
  _opts?: FreshOptions,
): string {
  switch (node.type.name) {
    case 'paragraph':
      return paragraph(node, ctx, s);
    default:
      throw new Error(`fresh serialization not implemented for ${node.type.name}`);
  }
}
