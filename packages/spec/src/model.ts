// SPDX-License-Identifier: MIT
// Store trace untuk satu file spec yang sedang dibuka: dokumen aktif diambil langsung dari editor
// (live), file saudara dibaca lewat host dan dibaca ulang saat host memberi tahu ada perubahan.
import type { Disposable, SiblingFiles } from '@markpiw/host';
import { parseMarkdown } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { buildSpecGraph, type SpecGraph } from './graph';
import {
  indexSpecDoc,
  SPEC_FILES,
  SPEC_KINDS,
  type SpecDoc,
  type SpecKind,
  specKindOf,
} from './index-doc';

export interface SpecSnapshot {
  /** Nama spec (nama folder). */
  readonly name: string;
  readonly active: SpecKind;
  /** File spec mana saja yang ada di folder. */
  readonly files: Readonly<Record<SpecKind, boolean>>;
  readonly graph: SpecGraph;
  /** True sampai file saudara selesai dibaca pertama kali. */
  readonly loading: boolean;
}

export interface SpecModelOptions {
  readonly siblings: SiblingFiles;
  /** Dokumen file aktif saat ini (dari editor). */
  readonly activeDoc: () => Node;
  /** Jeda sebelum dokumen aktif diindeks ulang setelah berubah (ms). */
  readonly debounceMs?: number;
}

export const SPEC_DEBOUNCE_MS = 300;

export class SpecModel {
  readonly active: SpecKind;
  private readonly siblings: SiblingFiles;
  private readonly activeDoc: () => Node;
  private readonly debounceMs: number;
  private readonly texts = new Map<SpecKind, string | null>();
  private readonly docs = new Map<SpecKind, SpecDoc>();
  private activeIndexed: { doc: Node; index: SpecDoc } | null = null;
  private snapshotValue: SpecSnapshot;
  private readonly listeners = new Set<() => void>();
  private subscription: Disposable | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private disposed = false;
  private loaded = false;

  /** Model untuk host ini, atau null bila file aktif bukan file spec. */
  static for(options: SpecModelOptions): SpecModel | null {
    const kind = specKindOf(options.siblings.fileName);
    return kind ? new SpecModel(kind, options) : null;
  }

  private constructor(kind: SpecKind, options: SpecModelOptions) {
    this.active = kind;
    this.siblings = options.siblings;
    this.activeDoc = options.activeDoc;
    this.debounceMs = options.debounceMs ?? SPEC_DEBOUNCE_MS;
    this.snapshotValue = this.compute();
  }

  /** Mulai membaca file saudara dan memantau perubahannya. */
  start(): Promise<void> {
    this.subscription = this.siblings.onChange(() => void this.reload());
    return this.reload();
  }

  dispose(): void {
    this.disposed = true;
    this.subscription?.dispose();
    this.subscription = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SpecSnapshot => this.snapshotValue;

  /** Dokumen aktif berubah: indeks ulang setelah jeda singkat. */
  activeChanged(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.refresh();
    }, this.debounceMs);
  }

  /** Indeks ulang sekarang (mis. setelah perubahan dari luar atau untuk test). */
  refresh(): void {
    if (this.disposed) return;
    const next = this.compute();
    this.snapshotValue = next;
    for (const listener of [...this.listeners]) listener();
  }

  /** Baca ulang semua file saudara; hanya yang isinya berubah yang di-parse ulang. */
  async reload(): Promise<void> {
    const generation = ++this.generation;
    const others = SPEC_KINDS.filter((kind) => kind !== this.active);
    const texts = await Promise.all(
      others.map(async (kind) => {
        try {
          return await this.siblings.read(SPEC_FILES[kind]);
        } catch {
          return null;
        }
      }),
    );
    if (this.disposed || generation !== this.generation) return;
    let changed = !this.loaded;
    others.forEach((kind, i) => {
      const text = texts[i] ?? null;
      if (this.texts.has(kind) && this.texts.get(kind) === text) return;
      changed = true;
      this.texts.set(kind, text);
      if (text === null) {
        this.docs.delete(kind);
        return;
      }
      try {
        this.docs.set(kind, indexSpecDoc(kind, parseMarkdown(text).doc));
      } catch {
        this.docs.delete(kind);
      }
    });
    this.loaded = true;
    if (changed) this.refresh();
  }

  private indexActive(): SpecDoc {
    const doc = this.activeDoc();
    if (this.activeIndexed?.doc !== doc)
      this.activeIndexed = { doc, index: indexSpecDoc(this.active, doc) };
    return this.activeIndexed.index;
  }

  private compute(): SpecSnapshot {
    const docs: Partial<Record<SpecKind, SpecDoc>> = { [this.active]: this.indexActive() };
    for (const [kind, doc] of this.docs) if (kind !== this.active) docs[kind] = doc;
    const files = {
      requirements: docs.requirements !== undefined,
      design: docs.design !== undefined,
      tasks: docs.tasks !== undefined,
    };
    return {
      name: this.siblings.folderName,
      active: this.active,
      files,
      graph: buildSpecGraph(docs),
      loading: !this.loaded,
    };
  }
}
