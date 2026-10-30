// SPDX-License-Identifier: MIT
// Alias nama paket prosemirror-* → source yang di-vendor, untuk resolve.alias Vite/Vitest.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface VendorPackage {
  name: string;
  version: string;
  tagSha: string;
  entry: string;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = JSON.parse(
  readFileSync(resolve(root, 'tooling/vendor/packages.json'), 'utf8'),
) as VendorPackage[];

export const prosemirrorAliases: Record<string, string> = Object.fromEntries(
  packages.map((p) => [p.name, resolve(root, 'vendor/prosemirror', p.name, p.entry)]),
);
