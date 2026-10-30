// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { MemoryDirectory, readTextAt } from '../src/fs/memory';
import { WebFileHost } from '../src/host/web-host';

const setup = () =>
  MemoryDirectory.from({
    docs: { 'a.md': 'a\n', 'b.md': 'b\n' },
    'top.md': '![x](docs/../logo.png)\n',
  });

describe('WebFileHost', () => {
  it('reads and writes the file', async () => {
    const root = setup();
    const host = await WebFileHost.open(root, ['docs', 'a.md'], { onOpenFile: () => {} });
    expect(await host.readText()).toEqual({ ok: true, value: 'a\n' });
    expect((await host.writeText('A\n')).ok).toBe(true);
    expect(await readTextAt(root, ['docs', 'a.md'])).toBe('A\n');
  });

  it('detects a conflict when the file changed on disk', async () => {
    const root = setup();
    const host = await WebFileHost.open(root, ['docs', 'a.md'], { onOpenFile: () => {} });
    await (await (await root.getDirectory('docs')).getFile('a.md')).write('changed elsewhere\n');
    const r = await host.writeText('mine\n');
    expect(r).toEqual({ ok: false, error: { code: 'conflict', message: expect.any(String) } });
    expect(await readTextAt(root, ['docs', 'a.md'])).toBe('changed elsewhere\n');
    expect((await host.writeText('mine\n', { force: true })).ok).toBe(true);
  });

  it('saves assets by content hash next to the file, once', async () => {
    const root = setup();
    const host = await WebFileHost.open(root, ['docs', 'a.md'], { onOpenFile: () => {} });
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const first = await host.saveAsset(bytes, 'image/png');
    const second = await host.saveAsset(bytes, 'image/png');
    expect(first).toEqual({ ok: true, value: './assets/image-9f64a747.png' });
    expect(second).toEqual(first);
    const assets = await (await root.getDirectory('docs')).getDirectory('assets');
    const names: string[] = [];
    for await (const entry of assets.entries()) names.push(entry.name);
    expect(names).toEqual(['image-9f64a747.png']);
  });

  it('resolves images inside the root and rejects paths escaping it', async () => {
    const root = MemoryDirectory.from({
      docs: { 'a.md': '', 'p.png': new Uint8Array([1]) },
      'logo.png': new Uint8Array([2]),
    });
    const host = await WebFileHost.open(root, ['docs', 'a.md'], { onOpenFile: () => {} });
    expect(await host.resolveImageUrl('p.png')).toMatch(/^blob:|^data:/);
    expect(await host.resolveImageUrl('../logo.png')).toMatch(/^blob:|^data:/);
    expect(await host.resolveImageUrl('../../etc/passwd')).toBeNull();
    expect(await host.resolveImageUrl('missing.png')).toBeNull();
  });

  it('opens relative markdown links inside the app', async () => {
    const root = setup();
    const opened: string[][] = [];
    const host = await WebFileHost.open(root, ['docs', 'a.md'], {
      onOpenFile: (p) => opened.push(p),
    });
    host.openLink('b.md');
    host.openLink('../top.md#bagian');
    expect(opened).toEqual([['docs', 'b.md'], ['top.md']]);
  });
});
