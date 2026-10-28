// SPDX-License-Identifier: LicenseRef-Proprietary
// Konteks prefix baris dan kontribusi container (blockquote, list_item).
import type { Node } from 'prosemirror-model';
import type { Contribution, Profile, SourceEntry, SourceIndex, SrcKey } from '../types';

/** Prefix untuk baris pertama (`first`) dan baris lanjutan (`rest`) sebuah blok. */
export interface Ctx {
  first: string;
  rest: string;
}

export const ROOT_CTX: Readonly<Ctx> = { first: '', rest: '' };

const MARKER = /^(\d+[.)]|[-*+])([ \t]*)/;
const DEFAULT_BLOCKQUOTE: Contribution = { first: '> ', rest: '> ' };

export function entryOf(node: Node, index: SourceIndex): SourceEntry | undefined {
  const key = node.attrs.srcKey as SrcKey | null | undefined;
  return key == null ? undefined : index.get(key);
}

export function sameContribution(a: Contribution | null, b: Contribution | null): boolean {
  return a === b || (a !== null && b !== null && a.first === b.first && a.rest === b.rest);
}

/**
 * Gaya penomoran ordered list: `same` jika ≥ 2 item berentri bernomor sama, `increment` jika
 * nomornya berbeda, selain itu dari profil.
 */
export function orderedNumbering(
  list: Node,
  index: SourceIndex,
  profile: Profile,
): Profile['orderedNumbering'] {
  const numbers: number[] = [];
  list.forEach((item) => {
    const n = entryOf(item, index)?.listNumber;
    if (n != null) numbers.push(n);
  });
  if (numbers.length >= 2) return numbers.every((n) => n === numbers[0]) ? 'same' : 'increment';
  return profile.orderedNumbering;
}

/** Marker item ke-`itemIndex` di `list`: `-`/`*`/`+` atau `<n>.`/`<n>)`. */
export function itemMarker(
  list: Node,
  itemIndex: number,
  s: { readonly index: SourceIndex; readonly profile: Profile },
): string {
  if (list.type.name === 'ordered_list') {
    const start = list.attrs.start as number;
    const n = orderedNumbering(list, s.index, s.profile) === 'same' ? start : start + itemIndex;
    return `${n}${list.attrs.delimiter as string}`;
  }
  return (list.attrs.marker as string | null) ?? s.profile.bulletMarker;
}

/**
 * Kontribusi prefix yang akan dipakai jika `node` (blockquote atau list_item) diserialisasi
 * ulang sekarang. Untuk node yang tidak berubah konteksnya, hasilnya sama dengan
 * `entry.contribution`.
 */
export function freshContribution(
  node: Node,
  entry: SourceEntry | undefined,
  s: { readonly index: SourceIndex; readonly profile: Profile },
  itemIndex: number,
  list: Node | null,
): Contribution {
  if (node.type.name !== 'list_item') return entry?.contribution ?? DEFAULT_BLOCKQUOTE;

  const marker = list ? itemMarker(list, itemIndex, s) : s.profile.bulletMarker;
  let padding: string | null = null;
  const old = entry?.contribution;
  if (old) {
    const m = MARKER.exec(old.first);
    if (m && m[1] === marker && (m[2] as string).length > 0) padding = m[2] as string;
  }
  if (padding === null) {
    const indent = s.profile.listIndent;
    padding =
      typeof indent === 'number' && indent > marker.length + 1
        ? ' '.repeat(indent - marker.length)
        : ' ';
  }
  const checked = node.attrs.checked as boolean | null;
  const checkbox = checked === null ? '' : checked ? '[x] ' : '[ ] ';
  return { first: marker + padding + checkbox, rest: ' '.repeat(marker.length) + padding };
}
