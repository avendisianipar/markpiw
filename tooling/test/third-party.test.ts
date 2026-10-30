// SPDX-License-Identifier: MIT
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageDirOf, renderNotices } from '../third-party';

const root = resolve(import.meta.dirname, '../..');

function fakePackage(
  base: string,
  name: string,
  meta: Record<string, unknown>,
  license?: [string, string],
): string {
  const dir = join(base, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', ...meta }));
  if (license) writeFileSync(join(dir, license[0]), license[1]);
  return dir;
}

describe('packageDirOf', () => {
  it('maps a pnpm store path to the innermost package directory', () => {
    const store = '/r/node_modules/.pnpm/react-dom@19.3.1_react@19.3.1/node_modules';
    expect(packageDirOf(`${store}/react-dom/cjs/react-dom.production.js`)).toBe(
      `${store}/react-dom`,
    );
    expect(packageDirOf(`${store}/@floating-ui/dom/dist/floating-ui.dom.mjs?commonjs-proxy`)).toBe(
      `${store}/@floating-ui/dom`,
    );
  });

  it('maps vendored ProseMirror sources to their package directory', () => {
    expect(packageDirOf(`${root}/vendor/prosemirror/prosemirror-view/src/index.ts`)).toBe(
      `${root}/vendor/prosemirror/prosemirror-view`,
    );
    expect(packageDirOf(`${root}/vendor/prosemirror/prosemirror-view/style/prosemirror.css`)).toBe(
      `${root}/vendor/prosemirror/prosemirror-view`,
    );
  });

  it('ignores markpiw sources and virtual modules', () => {
    expect(packageDirOf(`${root}/packages/editor/src/index.ts`)).toBeNull();
    expect(packageDirOf('\0vite/preload-helper.js')).toBeNull();
  });
});

describe('renderNotices', () => {
  it('lists every package once, sorted, with its license text', () => {
    const base = mkdtempSync(join(tmpdir(), 'markpiw-notices-'));
    const b = fakePackage(base, 'b-pkg', { license: 'ISC' }, ['LICENSE', 'ISC text of b']);
    const a = fakePackage(base, '@scope/a', { license: 'MIT' }, ['license.md', 'MIT text of a']);
    const out = renderNotices([`${b}/index.js`, `${a}/x.js`, `${b}/other.js`, '/repo/src/own.ts']);
    expect(out.match(/b-pkg@1\.0\.0/g)).toHaveLength(1);
    expect(out.indexOf('@scope/a@1.0.0 (npm)')).toBeLessThan(out.indexOf('b-pkg@1.0.0 (npm)'));
    expect(out).toContain('MIT text of a');
    expect(out).toContain('ISC text of b');
  });

  it('marks vendored ProseMirror packages', () => {
    const out = renderNotices([`${root}/vendor/prosemirror/prosemirror-model/src/index.ts`]);
    expect(out).toMatch(/prosemirror-model@[\d.]+ \(vendored\)/);
    expect(out).toContain('Marijn Haverbeke');
  });

  it('uses the reviewed override for format, which ships no license file', () => {
    const base = mkdtempSync(join(tmpdir(), 'markpiw-notices-'));
    const dir = fakePackage(base, 'format', {});
    const out = renderNotices([`${dir}/format.js`]);
    expect(out).toContain('Copyright 2010 - 2014 Sami Samhuri');
    expect(out).toContain('Permission is hereby granted, free of charge');
  });

  it('fails on a package without a license file so new dependencies get reviewed', () => {
    const base = mkdtempSync(join(tmpdir(), 'markpiw-notices-'));
    const dir = fakePackage(base, 'mystery', { license: 'MIT' });
    expect(() => renderNotices([`${dir}/index.js`])).toThrow(/mystery@1\.0\.0/);
  });
});
