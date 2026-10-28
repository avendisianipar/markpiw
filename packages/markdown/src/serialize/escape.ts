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
  const same = (md: string) => {
    const block = reparse(md);
    return block !== null && JSON.stringify(normalizeForCompare(block)) === target;
  };
  // Jalur cepat: jika semua escape bisa dihapus sekaligus, cukup satu kali parse.
  let all = blockMarkdown;
  for (let k = candidates.length - 1; k >= 0; k--) {
    const at = candidates[k] as number;
    all = all.slice(0, at) + all.slice(at + 1);
  }
  if (same(all)) return all;
  let md = blockMarkdown;
  let removed = 0;
  for (const offset of candidates) {
    const at = offset - removed;
    const trial = md.slice(0, at) + md.slice(at + 1);
    if (same(trial)) {
      md = trial;
      removed++;
    }
  }
  return md;
}

const parseDoc = (md: string) => buildDoc(md, toMdast(md)).doc;

/** Parse markdown sebagai dokumen berdiri sendiri; kembalikan bloknya jika tepat satu. */
export function reparseBlock(md: string): Node | null {
  const doc = parseDoc(md);
  return doc.childCount === 1 ? doc.child(0) : null;
}

/**
 * Seperti `reparseBlock`, tetapi definisi link dokumen (`definitions`, markdown) ikut di-parse
 * supaya link referensi di blok ter-resolve sama seperti di dokumen utuh.
 */
export function makeReparse(definitions: readonly string[]): (md: string) => Node | null {
  if (definitions.length === 0) return reparseBlock;
  const labelled = definitions.map((text) => ({
    text,
    label: (/^\[([^\]]*)\]/.exec(text)?.[1] ?? '').toLowerCase(),
  }));
  return (md) => {
    // Hanya definisi yang labelnya muncul di blok yang bisa memengaruhi parse-nya.
    const lower = md.toLowerCase();
    const used = md.includes('[') ? labelled.filter((d) => lower.includes(d.label)) : [];
    if (used.length === 0) return reparseBlock(md);
    const doc = parseDoc([md, ...used.map((d) => d.text)].join('\n\n'));
    return doc.childCount === used.length + 1 ? doc.child(0) : null;
  };
}
