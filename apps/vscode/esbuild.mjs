// SPDX-License-Identifier: LicenseRef-Proprietary
// Bundle extension host (spesifikasi 7.5): node, cjs, vscode eksternal.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
  sourcemap: true,
  legalComments: 'linked',
  logLevel: 'warning',
});
