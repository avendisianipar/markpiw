// SPDX-License-Identifier: LicenseRef-Proprietary
// Serialisasi ulang blok (diisi di Task 8/9).
import type { Node } from 'prosemirror-model';
import type { Ctx } from './context';
import type { SerializerState } from './serialize';

/** Info posisi untuk list_item: list induk dan indeks item. */
export interface FreshOptions {
  readonly list: Node | null;
  readonly itemIndex: number;
  readonly tightItem: boolean;
}

export function serializeFreshBlock(
  _node: Node,
  _ctx: Ctx,
  _stable: boolean,
  _s: SerializerState,
  _opts?: FreshOptions,
): string {
  throw new Error('fresh serialization not implemented');
}
