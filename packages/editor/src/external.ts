// SPDX-License-Identifier: LicenseRef-Proprietary
// Spesifikasi 2.5: terapkan dokumen hasil parse ulang teks dari luar.
import type { Node } from 'prosemirror-model';
import type { EditorState, Transaction } from 'prosemirror-state';

/** Transaksi yang mengganti seluruh isi dokumen dengan `next`. */
export function applyExternalText(state: EditorState, next: Node): Transaction {
  return state.tr.replaceWith(0, state.doc.content.size, next.content);
}
