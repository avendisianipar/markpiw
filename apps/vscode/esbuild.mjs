// SPDX-License-Identifier: MIT
// Bundle extension host (spesifikasi 7.5): node, cjs, vscode eksternal.
import { writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const { metafile } = await build({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  legalComments: 'linked',
  metafile: true,
  logLevel: 'warning',
});

// Dibaca notices.mjs untuk THIRD_PARTY_NOTICES.txt.
writeFileSync('dist/extension.meta.json', JSON.stringify(metafile));
