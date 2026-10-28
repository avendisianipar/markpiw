// SPDX-License-Identifier: LicenseRef-Proprietary
// Kumpulkan lisensi komponen pihak ketiga yang dibundel ke THIRD_PARTY_NOTICES.txt.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const sections = [];

for (const pkg of readdirSync(join(root, 'vendor/prosemirror'))
  .filter((d) => d.startsWith('prosemirror-'))
  .sort()) {
  const dir = join(root, 'vendor/prosemirror', pkg);
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version;
  sections.push(
    `${pkg}@${version} (vendored)\n\n${readFileSync(join(dir, 'LICENSE'), 'utf8').trim()}`,
  );
}

const npm = [
  'react',
  'react-dom',
  'scheduler',
  'react-aria-components',
  '@floating-ui/dom',
  '@floating-ui/core',
  'lucide-react',
  'valibot',
  'orderedmap',
  'rope-sequence',
  'w3c-keyname',
  'mdast-util-from-markdown',
  'mdast-util-gfm',
  'mdast-util-frontmatter',
  'micromark',
  'micromark-extension-gfm',
  'micromark-extension-frontmatter',
];
const seen = new Set();
for (const name of npm) {
  let dir;
  for (const base of ['apps/vscode', 'packages/ui', 'packages/markdown', 'vendor/prosemirror']) {
    try {
      dir = dirname(
        createRequire(join(root, base, 'package.json')).resolve(`${name}/package.json`),
      );
      break;
    } catch {
      // coba lokasi berikutnya
    }
  }
  if (!dir || seen.has(name)) continue;
  seen.add(name);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((f) => /^licen[cs]e(\.md|\.txt)?$/i.test(f));
  const text = file
    ? readFileSync(join(dir, file), 'utf8').trim()
    : `License: ${meta.license ?? 'lihat paket'}`;
  sections.push(`${name}@${meta.version} (npm)\n\n${text}`);
}

writeFileSync(
  join(root, 'apps/vscode/THIRD_PARTY_NOTICES.txt'),
  `markpiw membundel komponen pihak ketiga berikut.\n\n${sections.join('\n\n' + '-'.repeat(72) + '\n\n')}\n`,
);
console.log(`THIRD_PARTY_NOTICES.txt: ${sections.length} komponen`);
