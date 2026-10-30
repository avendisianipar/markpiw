// SPDX-License-Identifier: MIT
// Spesifikasi 2.5: terapkan dokumen hasil parse ulang teks dari luar (undo VS Code, git, editor
// lain). Seluruh isi diganti agar indeks source baru konsisten dengan dokumen; seleksi dipetakan
// lewat anak tingkat atas yang sama di awal (prefix) dan akhir (suffix).
import type { Node } from 'prosemirror-model';
import { type EditorState, Selection, TextSelection, type Transaction } from 'prosemirror-state';

const same = (a: Node, b: Node) =>
  a.type === b.type && a.nodeSize === b.nodeSize && a.textContent === b.textContent;

export function applyExternalText(state: EditorState, next: Node): Transaction {
  const old = state.doc;
  let prefix = 0;
  let prefixSize = 0;
  while (
    prefix < old.childCount &&
    prefix < next.childCount &&
    same(old.child(prefix), next.child(prefix))
  ) {
    prefixSize += old.child(prefix).nodeSize;
    prefix++;
  }
  let suffix = 0;
  let suffixSize = 0;
  while (
    suffix < old.childCount - prefix &&
    suffix < next.childCount - prefix &&
    same(old.child(old.childCount - 1 - suffix), next.child(next.childCount - 1 - suffix))
  ) {
    suffixSize += old.child(old.childCount - 1 - suffix).nodeSize;
    suffix++;
  }

  const oldSize = old.content.size;
  const delta = next.content.size - oldSize;
  const map = (pos: number): number | null => {
    if (pos <= prefixSize) return pos;
    if (pos >= oldSize - suffixSize) return pos + delta;
    return null;
  };

  const tr = state.tr.replaceWith(0, oldSize, next.content);
  const anchor = map(state.selection.anchor);
  const head = map(state.selection.head);
  let selection: Selection;
  if (anchor !== null && head !== null) {
    try {
      selection = TextSelection.create(tr.doc, anchor, head);
    } catch {
      selection = Selection.near(tr.doc.resolve(head));
    }
  } else {
    selection = Selection.near(tr.doc.resolve(Math.min(prefixSize + 1, tr.doc.content.size)));
  }
  return tr.setSelection(selection);
}
