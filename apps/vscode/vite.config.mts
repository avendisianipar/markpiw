// SPDX-License-Identifier: LicenseRef-Proprietary
// Bundle webview (spesifikasi 7.5): satu JS + satu CSS dengan nama tetap, tanpa code splitting.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';
import { prosemirrorTypeReexports } from '../../tooling/vite-prosemirror.ts';

export default defineConfig({
  plugins: [prosemirrorTypeReexports(), react()],
  resolve: { alias: prosemirrorAliases },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist/webview',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: false,
    sourcemap: false,
    rolldownOptions: {
      input: 'webview/main.tsx',
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.[ext]',
        codeSplitting: false,
      },
    },
  },
});
