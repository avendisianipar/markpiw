// SPDX-License-Identifier: LicenseRef-Proprietary
// Menjalankan test upstream ProseMirror (non-browser) terhadap source yang di-vendor.
import { readFileSync } from 'node:fs';
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

interface Exclusion {
  file: string;
  reason: string;
}

const exclusions = JSON.parse(
  readFileSync(new URL('./test-exclusions.json', import.meta.url), 'utf8'),
) as Exclusion[];

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'vendor-prosemirror',
    include: ['prosemirror-*/test/test-*.ts'],
    exclude: ['**/node_modules/**', ...exclusions.map((e) => e.file)],
    globals: true,
    setupFiles: ['./test-setup.ts'],
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
