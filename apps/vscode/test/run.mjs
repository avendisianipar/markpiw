// SPDX-License-Identifier: LicenseRef-Proprietary
// Test integrasi VS Code (spesifikasi 11) memakai VS Code yang terpasang (tanpa unduhan).
// Override lokasi dengan VSCODE_EXECUTABLE. Membuka jendela VS Code sementara.
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

const here = fileURLToPath(new URL('.', import.meta.url));
const executable =
  process.env.VSCODE_EXECUTABLE ??
  (process.platform === 'darwin'
    ? '/Applications/Visual Studio Code.app/Contents/MacOS/Code'
    : undefined);
const temp = mkdtempSync(join(tmpdir(), 'markpiw-vscode-test-'));
const workspace = join(temp, 'workspace');
cpSync(join(here, 'fixture'), workspace, { recursive: true });

try {
  await runTests({
    ...(executable ? { vscodeExecutablePath: executable } : {}),
    extensionDevelopmentPath: join(here, '..'),
    extensionTestsPath: join(here, 'suite.cjs'),
    launchArgs: [
      workspace,
      '--disable-extensions',
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      `--user-data-dir=${join(temp, 'user')}`,
      `--extensions-dir=${join(temp, 'extensions')}`,
    ],
  });
} finally {
  rmSync(temp, { recursive: true, force: true });
}
