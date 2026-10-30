// SPDX-License-Identifier: MIT
// Gabungkan modul bundle extension host (metafile esbuild) dan webview (modules.json dari Vite)
// menjadi THIRD_PARTY_NOTICES.txt. Jalankan setelah kedua build selesai.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderNotices } from '../../tooling/third-party.ts';

const here = new URL('.', import.meta.url).pathname;
const read = (file) => JSON.parse(readFileSync(resolve(here, file), 'utf8'));

const modules = [
  ...Object.keys(read('dist/extension.meta.json').inputs).map((file) => resolve(here, file)),
  ...read('dist/webview/modules.json'),
];
const notices = renderNotices(modules);
writeFileSync(resolve(here, 'THIRD_PARTY_NOTICES.txt'), notices);
console.log(
  `THIRD_PARTY_NOTICES.txt: ${notices.match(/^\S+@\S+ \((?:npm|vendored)\)$/gm).length} komponen`,
);
