// SPDX-License-Identifier: LicenseRef-Proprietary
import type { Node } from 'prosemirror-model';

export type BlockNodeName =
  | 'paragraph'
  | 'heading'
  | 'blockquote'
  | 'bullet_list'
  | 'ordered_list'
  | 'list_item'
  | 'code_block'
  | 'table'
  | 'table_row'
  | 'table_cell'
  | 'horizontal_rule'
  | 'raw_block';
export type InlineNodeName = 'text' | 'image' | 'hard_break' | 'soft_break' | 'raw_inline';
export type NodeName = 'doc' | BlockNodeName | InlineNodeName;
export type MarkName = 'strong' | 'em' | 'strike' | 'code' | 'link';

/** Kunci ke entri indeks source. Node baru memiliki `srcKey: null`. */
export type SrcKey = number & { readonly __brand: 'SrcKey' };

/** Prefix yang ditambahkan container (blockquote, list_item) ke baris anak-anaknya. */
export interface Contribution {
  readonly first: string;
  readonly rest: string;
}

/** Gaya penulisan dominan sebuah file, dipakai untuk node yang diserialisasi ulang. */
export interface Profile {
  bulletMarker: '-' | '*' | '+';
  emDelim: '*' | '_';
  strongDelim: '**' | '__';
  fence: '```' | '~~~';
  headingStyle: 'atx' | 'setext';
  listIndent: 'marker+1' | number;
  orderedNumbering: 'increment' | 'same';
  tablePadding: 'compact' | 'aligned';
  eol: '\n' | '\r\n';
  finalNewline: boolean;
  bom: boolean;
}

export interface SourceEntry {
  readonly key: SrcKey;
  /** Node ProseMirror hasil parse. */
  readonly node: Node;
  /** Baris-baris utuh (dengan prefix container), tanpa terminator baris terakhir. */
  readonly text: string;
  /** Container induk di source (`null` = dokumen). Verbatim hanya di induk yang sama. */
  readonly parentKey: SrcKey | null;
  /** Saudara sebelumnya di source; `null` jika anak pertama. */
  readonly prevKey: SrcKey | null;
  /** Teks source antara akhir `text` saudara sebelumnya dan awal `text` ini. */
  readonly sepBefore: string;
  /** Anak terakhir parent-nya di source. */
  readonly isLast: boolean;
  /** blockquote & list_item: prefix yang ditambahkan ke anak-anaknya. */
  readonly contribution: Contribution | null;
  /** list_item dalam ordered_list: nomor di source. */
  readonly listNumber: number | null;
  /** table: baris header, delimiter, dan body (tanpa prefix container). */
  readonly tableLines: readonly string[] | null;
  /** table: semua baris source sama panjang. */
  readonly tableAligned: boolean;
}

export interface SourceIndex {
  get(key: SrcKey): SourceEntry | undefined;
  readonly leading: string;
  readonly trailing: string;
  readonly size: number;
}

export interface ParsedDoc {
  readonly doc: Node;
  readonly index: SourceIndex;
  readonly profile: Profile;
}

export interface GuardFailure {
  readonly path: readonly number[];
  readonly expected: string;
  readonly actual: string;
}
