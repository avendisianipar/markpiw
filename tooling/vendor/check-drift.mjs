// SPDX-License-Identifier: MIT
// Bandingkan versi ProseMirror yang di-vendor dengan versi terbaru di npm.
// Exit 1 jika ada paket yang tertinggal satu rilis minor atau lebih (SLA ≤ 3 bulan).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const packages = JSON.parse(readFileSync(join(root, 'tooling/vendor/packages.json'), 'utf8'));

const parse = (v) => v.split('.').map(Number);

function status(vendored, latest) {
  const [vMaj, vMin, vPat] = parse(vendored);
  const [lMaj, lMin, lPat] = parse(latest);
  if (lMaj > vMaj) return 'major behind';
  if (lMaj === vMaj && lMin > vMin) return 'minor behind';
  if (lMaj === vMaj && lMin === vMin && lPat > vPat) return 'patch behind';
  return 'up-to-date';
}

const rows = packages.map(({ name, version }) => {
  const latest = execFileSync('npm', ['view', name, 'version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  return { name, version, latest, status: status(version, latest) };
});

const header = ['paket', 'vendor', 'npm latest', 'status'];
const table = [header, ...rows.map((r) => [r.name, r.version, r.latest, r.status])];
const widths = header.map((_, i) => Math.max(...table.map((row) => row[i].length)));
for (const row of table)
  console.log(
    row
      .map((cell, i) => cell.padEnd(widths[i]))
      .join(' | ')
      .trimEnd(),
  );

const behind = rows.filter((r) => r.status === 'minor behind' || r.status === 'major behind');
if (behind.length > 0) {
  console.error(
    `\n${behind.length} paket tertinggal ≥ 1 rilis minor: ${behind.map((r) => r.name).join(', ')}`,
  );
  process.exit(1);
}
