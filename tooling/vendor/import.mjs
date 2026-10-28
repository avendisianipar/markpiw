// SPDX-License-Identifier: LicenseRef-Proprietary
// Impor satu paket ProseMirror dari tag kanonik ke vendor/prosemirror/<pkg>/.
// Usage: node tooling/vendor/import.mjs <pkg>
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const UPSTREAM = 'https://code.haverbeke.berlin/prosemirror';
const COPY = ['src', 'test', 'style', 'LICENSE', 'CHANGELOG.md', 'README.md', 'package.json'];
const OPTIONAL = new Set(['test', 'style']);

function fail(message) {
  console.error(`import.mjs: ${message}`);
  process.exit(1);
}

const name = process.argv[2];
if (!name) fail('usage: node tooling/vendor/import.mjs <pkg>');

const packages = JSON.parse(readFileSync(join(root, 'tooling/vendor/packages.json'), 'utf8'));
const entry = packages.find((p) => p.name === name);
if (!entry) fail(`paket "${name}" tidak ada di tooling/vendor/packages.json`);

const url = `${UPSTREAM}/${name}.git`;
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

// Ref tag dari remote: SHA objek tag (annotated) atau commit (lightweight).
const refs = git(
  ['ls-remote', url, `refs/tags/${entry.version}`, `refs/tags/${entry.version}^{}`],
  root,
)
  .split('\n')
  .filter(Boolean)
  .map((line) => line.split('\t'));
const tagRef = refs.find(([, ref]) => ref === `refs/tags/${entry.version}`);
if (!tagRef) fail(`tag ${entry.version} tidak ditemukan di ${url}`);
const tagSha = tagRef[0];
if (tagSha !== entry.tagSha) {
  fail(
    `SHA tag ${entry.version} di upstream (${tagSha}) tidak cocok dengan packages.json (${entry.tagSha})`,
  );
}

const tmp = mkdtempSync(join(tmpdir(), `markpiw-vendor-${name}-`));
try {
  git(
    [
      '-c',
      'advice.detachedHead=false',
      'clone',
      '--quiet',
      '--depth',
      '1',
      '--branch',
      entry.version,
      url,
      tmp,
    ],
    root,
  );
  const commitSha = git(['rev-parse', 'HEAD'], tmp);
  const peeled = refs.find(([, ref]) => ref === `refs/tags/${entry.version}^{}`);
  if (peeled && peeled[0] !== commitSha)
    fail(`commit hasil clone (${commitSha}) bukan commit tag (${peeled[0]})`);

  const upstreamVersion = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8')).version;
  if (upstreamVersion !== entry.version) {
    fail(
      `versi upstream package.json (${upstreamVersion}) tidak cocok dengan packages.json (${entry.version})`,
    );
  }

  const dest = join(root, 'vendor/prosemirror', name);
  rmSync(dest, { recursive: true, force: true });
  for (const item of COPY) {
    const from = join(tmp, item);
    if (existsSync(from)) cpSync(from, join(dest, item), { recursive: true });
    else if (!OPTIONAL.has(item)) fail(`${item} tidak ada di upstream ${name}@${entry.version}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(dest, 'VENDOR.md'),
    `# ${name} (vendored)

- Upstream: ${url}
- Versi: ${entry.version}
- SHA tag: ${tagSha}
- SHA commit: ${commitSha}
- Tanggal impor: ${today}
- Patches: none
- Pemilik: markpiw maintainers
- SLA sinkronisasi: ≤ 3 bulan setelah rilis minor upstream

File di direktori ini disalin utuh dari upstream dan tidak boleh diubah.
Perubahan hanya lewat \`vendor/prosemirror/patches/\`. Impor ulang dengan
\`node tooling/vendor/import.mjs ${name}\`.
`,
  );
  console.log(`${name}@${entry.version} → vendor/prosemirror/${name} (commit ${commitSha})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
