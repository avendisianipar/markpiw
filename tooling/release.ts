// SPDX-License-Identifier: MIT
// Info rilis otomatis (workflow CI, job `release`): versi dari apps/vscode/package.json, tag
// `v<versi>`, dan catatan rilis dari docs/releases/<tag>.md atau bagian CHANGELOG versi itu.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ReleaseInfo {
  version: string;
  tag: string;
  notes: string;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Isi bagian `## [versi]` di CHANGELOG (tanpa judulnya), atau null jika tidak ada. */
export function changelogSection(changelog: string, version: string): string | null {
  const heading = new RegExp(`^## \\[${escape(version)}\\][^\\n]*$`, 'm');
  const match = heading.exec(changelog);
  if (!match) return null;
  const rest = changelog.slice(match.index + match[0].length);
  const next = /^## \[|^\[[^\]]+\]: /m.exec(rest);
  const body = (next ? rest.slice(0, next.index) : rest).trim();
  return body === '' ? null : body;
}

const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as { version: string };

/**
 * Info rilis untuk isi repository saat ini. Gagal (throw) jika versi web dan extension berbeda
 * atau CHANGELOG belum punya bagian untuk versi tersebut, agar rilis tidak terbit setengah jadi.
 */
export function releaseInfo(root: string): ReleaseInfo {
  const version = readJson(join(root, 'apps/vscode/package.json')).version;
  const web = readJson(join(root, 'apps/web/package.json')).version;
  if (web !== version)
    throw new Error(`Versi apps/web (${web}) berbeda dengan apps/vscode (${version}).`);
  const tag = `v${version}`;
  const section = changelogSection(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), version);
  if (section === null)
    throw new Error(`CHANGELOG.md belum punya bagian "## [${version}]" yang berisi perubahan.`);
  const notesFile = join(root, 'docs/releases', `${tag}.md`);
  const notes = existsSync(notesFile)
    ? readFileSync(notesFile, 'utf8')
    : `# Release ${version}\n\n${section}\n`;
  return { version, tag, notes };
}
