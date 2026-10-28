// SPDX-License-Identifier: LicenseRef-Proprietary
import type { Node } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';
import { parseMarkdown, serializeMarkdown } from '../src';

/** Parse `text`, terapkan `change` ke dokumennya, lalu serialisasi ulang. */
export function edit(text: string, change: (tr: Transform, doc: Node) => void): string {
  const parsed = parseMarkdown(text);
  const tr = new Transform(parsed.doc);
  change(tr, parsed.doc);
  return serializeMarkdown(parsed, tr.doc);
}

/** Posisi karakter pertama `needle` di dalam satu text node. */
export function posOf(doc: Node, needle: string): number {
  let found = -1;
  doc.descendants((node, pos) => {
    if (found !== -1) return false;
    if (node.isText && node.text?.includes(needle)) {
      found = pos + node.text.indexOf(needle);
    }
    return true;
  });
  if (found === -1) throw new Error(`teks ${JSON.stringify(needle)} tidak ditemukan`);
  return found;
}

/** Posisi awal node pada path indeks anak dari root. */
export function childPos(doc: Node, path: number[]): number {
  let pos = 0;
  let node = doc;
  path.forEach((index, depth) => {
    if (depth > 0) pos += 1;
    for (let i = 0; i < index; i++) pos += node.child(i).nodeSize;
    node = node.child(index);
  });
  return pos;
}

/**
 * Setara `Transaction.insertText` (prosemirror-state) untuk `Transform`: ganti `from..to`
 * dengan `text`, mempertahankan mark teks di posisi itu.
 */
export function insertText(tr: Transform, text: string, from: number, to = from): Transform {
  const node = from < to ? tr.doc.nodeAt(from) : null;
  const marks = node?.isText ? node.marks : tr.doc.resolve(from).marks();
  return tr.replaceWith(from, to, tr.doc.type.schema.text(text, marks));
}
