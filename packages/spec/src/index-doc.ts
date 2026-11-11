// SPDX-License-Identifier: MIT
// Indeks satu dokumen spec: setiap heading menjadi section beserta ID (bila judulnya diawali ID),
// rujukan ke ID lain, istilah kode (inline code), cuplikan isi, dan status task.
import { headingSlugs } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';

export type SpecKind = 'requirements' | 'design' | 'tasks';

export const SPEC_KINDS: readonly SpecKind[] = ['requirements', 'design', 'tasks'];

export const SPEC_FILES: Readonly<Record<SpecKind, string>> = {
  requirements: 'requirements.md',
  design: 'design.md',
  tasks: 'tasks.md',
};

/** Jenis dokumen spec dari nama file, atau null bila bukan salah satu file spec. */
export function specKindOf(fileName: string): SpecKind | null {
  const lower = fileName.toLowerCase();
  return SPEC_KINDS.find((kind) => SPEC_FILES[kind] === lower) ?? null;
}

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface SpecSection {
  /** Urutan heading di dokumen (sama dengan urutan daftar isi editor). */
  readonly index: number;
  readonly level: number;
  readonly title: string;
  /** Anchor gaya GitHub (`#slug`). */
  readonly slug: string;
  /** ID yang didefinisikan heading ini (mis. `FR-1`, `T3`), atau null. */
  readonly id: string | null;
  /** Token mirip ID yang disebut di section ini (selain ID-nya sendiri), unik, urut kemunculan. */
  readonly refs: readonly string[];
  /** Istilah kode (inline code) yang dinormalisasi, unik. */
  readonly terms: readonly string[];
  /** Awal isi section (teks polos, dipotong). */
  readonly snippet: string;
  /** Status task dari baris `Status: [ ]/[~]/[x]` atau dari checkbox; null bila tidak ada. */
  readonly status: TaskStatus | null;
}

export interface SpecDoc {
  readonly kind: SpecKind;
  readonly sections: readonly SpecSection[];
  /** Semua checkbox task list di dokumen. */
  readonly checkboxes: { readonly done: number; readonly total: number };
}

/** ID: `FR-1`, `NFR-2`, `AC-1.2`, `US-10`, atau pendek tanpa tanda hubung: `T1`, `R2`, `D3.1`. */
const ID = String.raw`(?:[A-Z][A-Z0-9]*-\d+(?:\.\d+)*|[A-Z]{1,3}\d+(?:\.\d+)*)`;
const DEFINITION = new RegExp(String.raw`^\s*(${ID})(?![\p{L}\p{N}_])`, 'u');
const REFERENCE = new RegExp(String.raw`(?<![\p{L}\p{N}_-])${ID}(?![\p{L}\p{N}_])`, 'gu');
const WHOLE_ID = new RegExp(String.raw`^${ID}$`, 'u');
const STATUS = /\bStatus\b\s*:?\s*\[([ x~X])\]/u;
const HTTP_METHOD = /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b\s*/;
const SNIPPET_MAX = 160;

/** Pola ID untuk dipakai ulang (decorations editor memakai daftar ID yang sudah dikenal). */
export function isSpecId(text: string): boolean {
  return WHOLE_ID.test(text);
}

/** ID di awal judul heading, atau null. */
export function definitionOf(title: string): string | null {
  return DEFINITION.exec(title)?.[1] ?? null;
}

/**
 * Normalisasi istilah kode: buang metode HTTP di depan dan `()` di belakang. Mengembalikan null
 * untuk istilah yang terlalu umum untuk menautkan section (tanpa huruf, terlalu pendek, metode
 * HTTP polos, nama file markdown).
 */
export function normalizeTerm(raw: string): string | null {
  let term = raw.trim().replace(HTTP_METHOD, '').trim();
  term = term.replace(/\(\)$/, '');
  if (term.length < 3 || !/\p{L}/u.test(term)) return null;
  if (/\.(md|markdown)$/i.test(term)) return null;
  return term;
}

interface Builder {
  index: number;
  level: number;
  title: string;
  id: string | null;
  text: string[];
  refs: string[];
  terms: string[];
  done: number;
  total: number;
}

function addUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

function scanRefs(builder: Builder, text: string): void {
  for (const match of text.matchAll(REFERENCE))
    if (match[0] !== builder.id) addUnique(builder.refs, match[0]);
}

/** Teks polos dan istilah kode satu blok teks. */
function inlineContent(node: Node): { text: string; codes: string[] } {
  let text = '';
  const codes: string[] = [];
  let code: string | null = null;
  node.forEach((child) => {
    if (child.isText) {
      const value = child.text ?? '';
      text += value;
      const isCode = child.marks.some((mark) => mark.type.name === 'code');
      if (isCode) code = (code ?? '') + value;
      else if (code !== null) {
        codes.push(code);
        code = null;
      }
    } else {
      if (code !== null) codes.push(code);
      code = null;
      text += ' ';
    }
  });
  if (code !== null) codes.push(code);
  return { text, codes };
}

function statusOf(builder: Builder): TaskStatus | null {
  const line = STATUS.exec(builder.text.join('\n'));
  if (line) {
    const mark = (line[1] ?? ' ').toLowerCase();
    return mark === 'x' ? 'done' : mark === '~' ? 'doing' : 'todo';
  }
  if (builder.total === 0) return null;
  if (builder.done === builder.total) return 'done';
  return builder.done > 0 ? 'doing' : 'todo';
}

function snippetOf(builder: Builder): string {
  const text = builder.text.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > SNIPPET_MAX ? `${text.slice(0, SNIPPET_MAX - 1).trimEnd()}…` : text;
}

/** Bangun indeks section dari dokumen ProseMirror hasil `parseMarkdown`. */
export function indexSpecDoc(kind: SpecKind, doc: Node): SpecDoc {
  const builders: Builder[] = [];
  let current: Builder | null = null;
  let done = 0;
  let total = 0;
  doc.descendants((node) => {
    const name = node.type.name;
    if (name === 'list_item' && node.attrs.checked !== null) {
      total++;
      if (node.attrs.checked === true) done++;
      if (current) {
        current.total++;
        if (node.attrs.checked === true) current.done++;
      }
    }
    if (!node.isTextblock) return true;
    // Code block dan blok mentah (HTML, frontmatter) tidak dipindai: isinya sering berupa diagram
    // atau contoh yang menyebut ID tanpa maksud merujuk.
    if (name === 'code_block' || name === 'raw_block') return false;
    const { text, codes } = inlineContent(node);
    if (name === 'heading') {
      const title = text.trim();
      current = {
        index: builders.length,
        level: node.attrs.level as number,
        title,
        id: definitionOf(title),
        text: [],
        refs: [],
        terms: [],
        done: 0,
        total: 0,
      };
      builders.push(current);
      scanRefs(current, title);
      return false;
    }
    if (!current) return false;
    current.text.push(text);
    scanRefs(current, text);
    for (const raw of codes) {
      if (WHOLE_ID.test(raw.trim())) continue;
      const term = normalizeTerm(raw);
      if (term) addUnique(current.terms, term);
    }
    return false;
  });
  const slugs = headingSlugs(builders.map((b) => b.title));
  return {
    kind,
    checkboxes: { done, total },
    sections: builders.map((b, i) => ({
      index: b.index,
      level: b.level,
      title: b.title,
      slug: slugs[i] ?? '',
      id: b.id,
      refs: b.refs,
      terms: b.terms,
      snippet: snippetOf(b),
      status: statusOf(b),
    })),
  };
}
