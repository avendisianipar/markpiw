// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { listMarkdownTree } from '../src/fs/tree';
import { MemoryDirectory, readTextAt } from '../src/fs/memory';

const folder = () =>
  MemoryDirectory.from({
    'README.md': '# R\n',
    'notes.txt': 'x',
    docs: { 'a.md': 'a\n', deep: { 'b.md': 'b\n' }, img: { 'x.png': new Uint8Array([1]) } },
    empty: { 'x.txt': 'x' },
    '.git': { 'HEAD.md': 'x' },
    node_modules: { 'pkg.md': 'x' },
  });

describe('markdown tree', () => {
  it('lists only .md files and folders that contain .md, ignoring hidden/node_modules', async () => {
    const root = folder();
    const top = await listMarkdownTree(root);
    expect(top.map((e) => `${e.kind}:${e.name}`)).toEqual(['directory:docs', 'file:README.md']);
    const docs = top[0];
    if (docs?.kind !== 'directory') throw new Error('docs');
    const inner = await listMarkdownTree(docs.dir);
    expect(inner.map((e) => `${e.kind}:${e.name}`)).toEqual(['directory:deep', 'file:a.md']);
  });

  it('memory files track lastModified and size on write', async () => {
    const root = folder();
    const file = await root.getFile('README.md');
    const before = await file.getFile();
    await file.write('# Changed\n');
    const after = await file.getFile();
    expect(after.lastModified).toBeGreaterThan(before.lastModified);
    expect(after.size).toBe(10);
    expect(await readTextAt(root, ['README.md'])).toBe('# Changed\n');
  });
});
