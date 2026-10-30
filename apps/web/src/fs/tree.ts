// SPDX-License-Identifier: MIT
import type { DirectoryLike, FileLike } from './types';

export type TreeEntry =
  | { readonly kind: 'file'; readonly name: string; readonly file: FileLike }
  | { readonly kind: 'directory'; readonly name: string; readonly dir: DirectoryLike };

const IGNORED = new Set(['node_modules']);
const isHidden = (name: string) => name.startsWith('.') || IGNORED.has(name);
const isMarkdown = (name: string) => /\.(md|markdown)$/i.test(name);

/** Apakah folder (rekursif, dibatasi kedalaman) memuat file markdown. */
async function containsMarkdown(dir: DirectoryLike, depth = 8): Promise<boolean> {
  if (depth < 0) return false;
  for await (const entry of dir.entries()) {
    if (isHidden(entry.name)) continue;
    if (entry.kind === 'file' && isMarkdown(entry.name)) return true;
    if (entry.kind === 'directory' && (await containsMarkdown(entry, depth - 1))) return true;
  }
  return false;
}

/**
 * Isi satu folder untuk file tree (spesifikasi 6.1): hanya `.md` dan folder yang memuat `.md`;
 * `.git`, `node_modules`, dan folder tersembunyi diabaikan. Folder dulu, lalu urut nama.
 */
export async function listMarkdownTree(dir: DirectoryLike): Promise<TreeEntry[]> {
  const out: TreeEntry[] = [];
  for await (const entry of dir.entries()) {
    if (isHidden(entry.name)) continue;
    if (entry.kind === 'file') {
      if (isMarkdown(entry.name)) out.push({ kind: 'file', name: entry.name, file: entry });
    } else if (await containsMarkdown(entry)) {
      out.push({ kind: 'directory', name: entry.name, dir: entry });
    }
  }
  return out.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1,
  );
}
