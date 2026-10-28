// SPDX-License-Identifier: LicenseRef-Proprietary
import { schema } from '@markpiw/markdown';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryDirectory, readTextAt } from '../src/fs/memory';
import { FileSession } from '../src/session';

afterEach(() => vi.useRealTimers());

function edit(session: FileSession, append: string) {
  const c = session.controller;
  const end = c.state.doc.child(0).nodeSize - 1;
  c.dispatch(c.state.tr.setSelection(TextSelection.create(c.state.doc, end)).insertText(append));
}

const files = () => MemoryDirectory.from({ 'a.md': 'a\n', 'b.md': 'b\n' });

describe('FileSession', () => {
  it('autosaves one second after the last change', async () => {
    vi.useFakeTimers();
    const root = files();
    const session = await FileSession.open(root, ['a.md'], { onOpenFile: () => {} });
    edit(session, '!');
    expect(session.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(999);
    expect(await readTextAt(root, ['a.md'])).toBe('a\n');
    await vi.advanceTimersByTimeAsync(1);
    expect(await readTextAt(root, ['a.md'])).toBe('a!\n');
    expect(session.status).toBe('saved');
  });

  it('web host: switching files flushes pending save to the old file', async () => {
    vi.useFakeTimers();
    const root = files();
    const a = await FileSession.open(root, ['a.md'], { onOpenFile: () => {} });
    edit(a, '?');
    await a.close();
    const b = await FileSession.open(root, ['b.md'], { onOpenFile: () => {} });
    expect(await readTextAt(root, ['a.md'])).toBe('a?\n');
    expect(await readTextAt(root, ['b.md'])).toBe('b\n');
    expect(b.controller.serialize()).toEqual({ ok: true, value: 'b\n' });
  });

  it('applies external changes when there is nothing pending', async () => {
    const root = files();
    const session = await FileSession.open(root, ['a.md'], { onOpenFile: () => {} });
    await (await root.getFile('a.md')).write('from git\n');
    await session.checkExternal();
    expect(session.controller.serialize()).toEqual({ ok: true, value: 'from git\n' });
    expect(session.status).toBe('saved');
  });

  it('enters conflict when the disk changed and there are local edits; resolves both ways', async () => {
    const root = files();
    const session = await FileSession.open(root, ['a.md'], { onOpenFile: () => {} });
    edit(session, 'L');
    await (await root.getFile('a.md')).write('disk\n');
    await session.save();
    expect(session.status).toBe('conflict');
    expect(await readTextAt(root, ['a.md'])).toBe('disk\n');
    await session.resolveConflict('mine');
    expect(await readTextAt(root, ['a.md'])).toBe('aL\n');
    edit(session, 'M');
    await (await root.getFile('a.md')).write('disk2\n');
    await session.save();
    await session.resolveConflict('disk');
    expect(session.controller.serialize()).toEqual({ ok: true, value: 'disk2\n' });
    expect(session.status).toBe('saved');
  });

  it('does not write anything when the guard fails', async () => {
    const root = MemoryDirectory.from({ 'a.md': 'exa mple.com\n' });
    const session = await FileSession.open(root, ['a.md'], { onOpenFile: () => {} });
    const c = session.controller;
    c.dispatch(c.state.tr.delete(4, 5));
    // em pada "mple." (posisi 4–9) tepat sebelum "com": tidak bisa ditulis sebagai markdown.
    c.dispatch(c.state.tr.addMark(4, 9, schema.marks.em.create()));
    await session.save();
    expect(session.status).toBe('readonly');
    expect(await readTextAt(root, ['a.md'])).toBe('exa mple.com\n');
  });
});
