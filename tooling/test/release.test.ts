// SPDX-License-Identifier: MIT
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { changelogSection, releaseInfo } from '../release';

const CHANGELOG = `# Changelog

## [Unreleased]

## [1.2.0] - 2026-11-05

### Changed

- Sesuatu berubah.

## [1.1.0] - 2026-11-02

### Added

- Fitur lama.

[Unreleased]: https://example.test/compare/v1.2.0...HEAD
[1.2.0]: https://example.test/compare/v1.1.0...v1.2.0
`;

function fakeRepo(versions: { vscode: string; web: string }, notes?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'markpiw-release-'));
  mkdirSync(join(root, 'apps/vscode'), { recursive: true });
  mkdirSync(join(root, 'apps/web'), { recursive: true });
  mkdirSync(join(root, 'docs/releases'), { recursive: true });
  writeFileSync(
    join(root, 'apps/vscode/package.json'),
    JSON.stringify({ version: versions.vscode }),
  );
  writeFileSync(join(root, 'apps/web/package.json'), JSON.stringify({ version: versions.web }));
  writeFileSync(join(root, 'CHANGELOG.md'), CHANGELOG);
  if (notes) writeFileSync(join(root, `docs/releases/v${versions.vscode}.md`), notes);
  return root;
}

describe('changelogSection', () => {
  it('mengambil isi satu versi sampai judul versi berikutnya', () => {
    expect(changelogSection(CHANGELOG, '1.2.0')).toBe('### Changed\n\n- Sesuatu berubah.');
  });

  it('bagian terakhir berhenti sebelum definisi link', () => {
    expect(changelogSection(CHANGELOG, '1.1.0')).toBe('### Added\n\n- Fitur lama.');
  });

  it('null untuk versi yang tidak ada atau bagian kosong', () => {
    expect(changelogSection(CHANGELOG, '9.9.9')).toBeNull();
    expect(changelogSection(CHANGELOG, '1.2')).toBeNull();
  });
});

describe('releaseInfo', () => {
  it('memakai docs/releases/<tag>.md jika ada', () => {
    const root = fakeRepo({ vscode: '1.2.0', web: '1.2.0' }, '# Release 1.2.0\n\nCatatan.\n');
    expect(releaseInfo(root)).toEqual({
      version: '1.2.0',
      tag: 'v1.2.0',
      notes: '# Release 1.2.0\n\nCatatan.\n',
    });
  });

  it('jatuh ke bagian CHANGELOG jika catatan rilis tidak ada', () => {
    const root = fakeRepo({ vscode: '1.2.0', web: '1.2.0' });
    expect(releaseInfo(root).notes).toBe('# Release 1.2.0\n\n### Changed\n\n- Sesuatu berubah.\n');
  });

  it('gagal jika versi web dan extension berbeda', () => {
    expect(() => releaseInfo(fakeRepo({ vscode: '1.2.0', web: '1.1.0' }))).toThrow(/berbeda/);
  });

  it('gagal jika CHANGELOG belum punya bagian versi itu', () => {
    expect(() => releaseInfo(fakeRepo({ vscode: '1.3.0', web: '1.3.0' }))).toThrow(/CHANGELOG/);
  });

  it('repository ini sendiri konsisten', () => {
    const info = releaseInfo(resolve(import.meta.dirname, '../..'));
    expect(info.tag).toBe(`v${info.version}`);
  });
});
