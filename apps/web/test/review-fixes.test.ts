// SPDX-License-Identifier: LicenseRef-Proprietary
// Regresi dari review akhir Fase 2–4 (web).
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryDirectory, readTextAt } from '../src/fs/memory';
import { WebFileHost } from '../src/host/web-host';
import { FileSession } from '../src/session';

afterEach(() => vi.useRealTimers());

const opts = { onOpenFile: () => {} };

function append(session: FileSession, s: string) {
  const c = session.controller;
  const end = c.state.doc.child(0).nodeSize - 1;
  c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, end)).insertText(s));
}

async function bytesAt(root: MemoryDirectory, name: string): Promise<number[]> {
  return [...new Uint8Array(await (await (await root.getFile(name)).getFile()).arrayBuffer())];
}

describe('external change while typing', () => {
  it('goes to conflict instead of dropping keystrokes typed during the disk read', async () => {
    const root = MemoryDirectory.from({ 'a.md': 'a\n' });
    const session = await FileSession.open(root, ['a.md'], opts);
    await (await root.getFile('a.md')).write('from git\n');
    const read = session.host.readText.bind(session.host);
    session.host.readText = async () => {
      const result = await read();
      append(session, 'TYPED'); // pengguna mengetik saat file dibaca
      return result;
    };
    await session.checkExternal();
    expect(session.status).toBe('conflict');
    expect(session.controller.serialize()).toEqual({ ok: true, value: 'aTYPED\n' });
  });
});

describe('pending image uploads', () => {
  it('does not save while an image upload is pending', async () => {
    const root = MemoryDirectory.from({ 'a.md': 'a\n' });
    const session = await FileSession.open(root, ['a.md'], opts);
    let finish: (v: { ok: true; value: string }) => void = () => {};
    session.host.saveAsset = () => new Promise((r) => (finish = r));
    const c = session.controller;
    c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, 2)));
    const done = c.commands.insertImageFile(
      new File([new Uint8Array([1])], 'x.png', { type: 'image/png' }),
    );
    await new Promise((r) => setTimeout(r, 0));
    await session.save();
    expect(await readTextAt(root, ['a.md'])).toBe('a\n');
    finish({ ok: true, value: './assets/x.png' });
    await done;
    await session.save();
    expect(await readTextAt(root, ['a.md'])).toBe('a![](./assets/x.png)\n');
  });
});

describe('encoding', () => {
  it('refuses to open files that are not valid UTF-8', async () => {
    const root = MemoryDirectory.from({
      'latin.md': new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x0a]),
    });
    const host = await WebFileHost.open(root, ['latin.md'], opts);
    const read = await host.readText();
    expect(read.ok).toBe(false);
    await expect(FileSession.open(root, ['latin.md'], opts)).rejects.toThrow(/UTF-8/);
  });

  it('keeps the UTF-8 BOM through an edit', async () => {
    const bom = [0xef, 0xbb, 0xbf];
    const root = MemoryDirectory.from({ 'b.md': new Uint8Array([...bom, 0x61, 0x0a]) });
    const session = await FileSession.open(root, ['b.md'], opts);
    append(session, '!');
    await session.save();
    expect(await bytesAt(root, 'b.md')).toEqual([...bom, 0x61, 0x21, 0x0a]);
  });
});

describe('restoring a draft', () => {
  it('goes to conflict when the file changed on disk after the draft was saved', async () => {
    const root = MemoryDirectory.from({ 'a.md': 'a\n' });
    const session = await FileSession.open(root, ['a.md'], opts);
    await session.restoreDraft({ text: 'draft\n', savedAt: 0 });
    expect(session.status).toBe('conflict');
    expect(await readTextAt(root, ['a.md'])).toBe('a\n');
  });

  it('writes the draft when the disk is older than the draft', async () => {
    const root = MemoryDirectory.from({ 'a.md': 'a\n' });
    const session = await FileSession.open(root, ['a.md'], opts);
    await session.restoreDraft({ text: 'draft\n', savedAt: Date.now() + 10 ** 12 });
    expect(await readTextAt(root, ['a.md'])).toBe('draft\n');
    expect(session.status).toBe('saved');
  });
});
