// SPDX-License-Identifier: LicenseRef-Proprietary
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';
import { prosemirrorTypeReexports } from '../../tooling/vite-prosemirror.ts';

const CSP =
  "default-src 'self'; img-src 'self' blob: https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'";

/** CSP (spesifikasi 6.6) hanya untuk build produksi; dev server butuh skrip inline HMR. */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'markpiw-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      ),
  };
}

export default defineConfig({
  base: './',
  plugins: [prosemirrorTypeReexports(), react(), contentSecurityPolicy()],
  resolve: { alias: prosemirrorAliases },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
});
