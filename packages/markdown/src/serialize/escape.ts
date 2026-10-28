// SPDX-License-Identifier: LicenseRef-Proprietary
// Escape minimal: mulai dari semua kandidat di-escape, lalu hapus escape dari kiri ke kanan
// selama hasil parse ulang tetap setara secara semantik.
import type { Node } from 'prosemirror-model';
import { buildDoc } from '../build';
import { toMdast } from '../mdast';
import { normalizeForCompare } from '../normalize';

/**
 * `blockMarkdown` berisi semua kandidat escape dalam keadaan ter-escape; `candidates` adalah
 * offset backslash-nya (urut naik). `reparse` mem-parse markdown satu blok dan mengembalikan
 * blok satu-satunya, atau `null`.
 */
export function escapeMinimal(
  blockMarkdown: string,
  candidates: readonly number[],
  node: Node,
  reparse: (md: string) => Node | null,
): string {
  if (candidates.length === 0) return blockMarkdown;
  const target = JSON.stringify(normalizeForCompare(node));
  let md = blockMarkdown;
  let removed = 0;
  for (const offset of candidates) {
    const at = offset - removed;
    const trial = md.slice(0, at) + md.slice(at + 1);
    const block = reparse(trial);
    if (block !== null && JSON.stringify(normalizeForCompare(block)) === target) {
      md = trial;
      removed++;
    }
  }
  return md;
}

/** Parse markdown sebagai dokumen berdiri sendiri; kembalikan bloknya jika tepat satu. */
export function reparseBlock(md: string): Node | null {
  const { doc } = buildDoc(md, toMdast(md));
  return doc.childCount === 1 ? doc.child(0) : null;
}
