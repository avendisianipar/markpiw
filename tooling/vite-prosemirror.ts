// SPDX-License-Identifier: LicenseRef-Proprietary
// Source ProseMirror upstream me-re-export tipe dengan `export { Tipe } from "./x"`. Di build
// bundler hal ini bisa di-shim, tetapi di dev server Vite browser memuat modul ESM satu per satu
// dan menolak ekspor yang tidak ada ("does not provide an export named 'Attrs'"). Plugin ini
// memindahkan nama-nama tipe ke `export type { … }` saat file dimuat; file vendor di disk tetap
// tidak diubah.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

const VENDOR_SRC = /[\\/]vendor[\\/]prosemirror[\\/]prosemirror-[^\\/]+[\\/]src[\\/][^\\/]+\.ts$/;
const REEXPORT = /export\s*\{([^}]*)\}\s*from\s*(["'])(\.{1,2}\/[^"']+)\2/g;
const TYPE_DECL = /export\s+(?:declare\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)/g;

const typeCache = new Map<string, Set<string>>();

function typeNamesOf(file: string): Set<string> {
  let names = typeCache.get(file);
  if (!names) {
    names = new Set();
    if (existsSync(file)) {
      for (const m of readFileSync(file, 'utf8').matchAll(TYPE_DECL)) names.add(m[1] as string);
    }
    typeCache.set(file, names);
  }
  return names;
}

/** Pisahkan nama tipe dari daftar re-export nilai di satu file source vendor. */
export function rewriteTypeReexports(code: string, file: string): string {
  return code.replace(REEXPORT, (statement, list: string, quote: string, spec: string) => {
    const target = resolve(dirname(file), `${spec.replace(/\.js$/, '')}.ts`);
    const types = typeNamesOf(target);
    const parts = list
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const isType = (part: string) => types.has(part.split(/\s+as\s+/)[0] as string);
    const typeParts = parts.filter(isType);
    if (typeParts.length === 0) return statement;
    const valueParts = parts.filter((p) => !isType(p));
    const from = `from ${quote}${spec}${quote}`;
    return [
      valueParts.length > 0 ? `export {${valueParts.join(', ')}} ${from}` : '',
      `export type {${typeParts.join(', ')}} ${from}`,
    ]
      .filter(Boolean)
      .join('; ');
  });
}

export function prosemirrorTypeReexports(): Plugin {
  return {
    name: 'markpiw-prosemirror-type-reexports',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] as string;
      if (!VENDOR_SRC.test(file)) return null;
      const out = rewriteTypeReexports(code, file);
      return out === code ? null : { code: out, map: null };
    },
  };
}
