// SPDX-License-Identifier: LicenseRef-Proprietary
import type { SourceEntry, SourceIndex, SrcKey } from './types';

/** Indeks source yang diisi saat parse. Key berurutan mulai dari 1. */
export class MutableSourceIndex implements SourceIndex {
  private readonly items: { -readonly [K in keyof SourceEntry]: SourceEntry[K] }[] = [];
  leading = '';
  trailing = '';

  get size(): number {
    return this.items.length;
  }

  get(key: SrcKey): SourceEntry | undefined {
    return this.items[key - 1];
  }

  /** Key yang akan diberikan oleh `add` berikutnya. */
  peekKey(): SrcKey {
    return (this.items.length + 1) as SrcKey;
  }

  add(e: Omit<SourceEntry, 'key' | 'parentKey'>): SrcKey {
    const key = this.peekKey();
    this.items.push({ ...e, key, parentKey: null });
    return key;
  }

  /** Catat `parent` sebagai container induk entri `child` (induk dibuat setelah anaknya). */
  setParent(child: SrcKey, parent: SrcKey): void {
    const entry = this.items[child - 1];
    if (entry) entry.parentKey = parent;
  }

  /** Buang entri dengan key > `size` (dipakai saat node tingkat atas jatuh ke raw_block). */
  truncate(size: number): void {
    this.items.length = size;
  }

  entries(): readonly SourceEntry[] {
    return this.items;
  }
}
