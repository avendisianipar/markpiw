// SPDX-License-Identifier: MIT
// Terapkan vendor/prosemirror/patches/*.patch berurutan nama (path relatif ke root repo).
// Patch yang sudah terpasang dilewati, sehingga skrip ini aman dijalankan berulang.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, 'vendor/prosemirror/patches');
const patches = readdirSync(dir)
  .filter((f) => f.endsWith('.patch'))
  .sort();

const gitApply = (args) => {
  try {
    execFileSync('git', ['apply', ...args], { cwd: root, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

for (const name of patches) {
  const file = join(dir, name);
  if (gitApply(['--reverse', '--check', file])) {
    console.log(`skip    ${name} (sudah terpasang)`);
    continue;
  }
  if (!gitApply(['--check', file])) {
    console.error(`vendor:patch: ${name} tidak bisa diterapkan; perbarui atau hapus patch ini.`);
    process.exit(1);
  }
  execFileSync('git', ['apply', file], { cwd: root, stdio: 'inherit' });
  console.log(`applied ${name}`);
}
if (patches.length === 0) console.log('vendor:patch: tidak ada patch.');
