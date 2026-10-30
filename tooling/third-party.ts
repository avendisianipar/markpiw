// SPDX-License-Identifier: MIT
// THIRD_PARTY_NOTICES dari modul yang benar-benar masuk bundle (bukan daftar tulisan tangan), agar
// setiap dependensi baru otomatis ikut tercantum beserta teks lisensinya.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

const NODE_MODULES_PKG = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/;
const VENDORED_PKG = /^(.*[\\/]vendor[\\/]prosemirror[\\/]prosemirror-[^\\/]+)[\\/]/;
const LICENSE_FILE = /^licen[cs]e(\.md|\.txt)?$/i;

const MIT_TEMPLATE = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

/**
 * Paket tanpa file lisensi. Isi hanya setelah lisensinya diperiksa manual; paket tanpa file
 * lisensi yang tidak ada di sini menggagalkan build.
 */
const LICENSE_OVERRIDES: Record<string, string> = {
  // Lisensi hanya disebut di Readme.md paket (format@0.2.2, dependensi `fault`).
  format: `MIT License\n\nCopyright 2010 - 2014 Sami Samhuri <sami@samhuri.net>\n\n${MIT_TEMPLATE}`,
};

/** Direktori paket pihak ketiga pemilik sebuah modul bundle, atau null untuk kode markpiw. */
export function packageDirOf(id: string): string | null {
  if (id.startsWith('\0')) return null;
  const file = id.split('?')[0] as string;
  return (VENDORED_PKG.exec(file) ?? NODE_MODULES_PKG.exec(file))?.[1] ?? null;
}

/** Teks THIRD_PARTY_NOTICES untuk sekumpulan path modul yang dibundel. */
export function renderNotices(moduleIds: Iterable<string>): string {
  const sections = new Map<string, string>();
  for (const id of moduleIds) {
    const dir = packageDirOf(id);
    if (!dir) continue;
    const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
    };
    if (meta.name.startsWith('@markpiw/')) continue;
    const key = `${meta.name}@${meta.version}`;
    if (sections.has(key)) continue;
    const file = existsSync(dir) ? readdirSync(dir).find((f) => LICENSE_FILE.test(f)) : undefined;
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : LICENSE_OVERRIDES[meta.name];
    if (!text) {
      throw new Error(
        `${key} (${dir}) tidak punya file lisensi. Periksa lisensinya, lalu tambahkan ke LICENSE_OVERRIDES di tooling/third-party.ts.`,
      );
    }
    const origin = VENDORED_PKG.test(`${dir}/`) ? 'vendored' : 'npm';
    sections.set(key, `${key} (${origin})\n\n${text}`);
  }
  const sorted = [...sections].sort(([a], [b]) => a.localeCompare(b)).map(([, s]) => s);
  return `markpiw membundel komponen pihak ketiga berikut.\n\n${sorted.join(`\n\n${'-'.repeat(72)}\n\n`)}\n`;
}

function chunkModuleIds(bundle: Record<string, { type: string; moduleIds?: readonly string[] }>) {
  return Object.values(bundle).flatMap((out) =>
    out.type === 'chunk' ? (out.moduleIds ?? []) : [],
  );
}

/** Tulis THIRD_PARTY_NOTICES.txt ke output build. */
export function thirdPartyNotices(fileName = 'THIRD_PARTY_NOTICES.txt'): Plugin {
  return {
    name: 'markpiw-third-party-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      this.emitFile({ type: 'asset', fileName, source: renderNotices(chunkModuleIds(bundle)) });
    },
  };
}

/** Tulis daftar modul bundle (JSON) untuk digabung dengan bundle lain sebelum notices dibuat. */
export function bundledModules(fileName: string): Plugin {
  return {
    name: 'markpiw-bundled-modules',
    apply: 'build',
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName,
        source: JSON.stringify(chunkModuleIds(bundle)),
      });
    },
  };
}
