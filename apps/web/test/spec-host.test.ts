// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { MemoryDirectory } from '../src/fs/memory';
import { WebFileHost } from '../src/host/web-host';

const setup = () =>
  MemoryDirectory.from(
    {
      'task-comments': {
        'requirements.md': '### FR-1 Tulis\n',
        'tasks.md': '### T1 — A\n\nFR-1\n',
      },
      'README.md': '# Root\n',
    },
    'repo',
  );

describe('WebFileHost siblings (spec trace)', () => {
  it('exposes file and folder names and reads files in the same folder', async () => {
    const root = setup();
    const host = await WebFileHost.open(root, ['task-comments', 'tasks.md'], {
      onOpenFile: () => {},
    });
    const siblings = host.siblings;
    expect(siblings.fileName).toBe('tasks.md');
    expect(siblings.folderName).toBe('task-comments');
    expect(await siblings.read('requirements.md')).toBe('### FR-1 Tulis\n');
    expect(await siblings.read('design.md')).toBeNull();
    expect(await siblings.read('../README.md')).toBeNull();
    expect(await siblings.read('tasks.md')).toBeNull();
  });

  it('uses the root folder name for files at the top level', async () => {
    const host = await WebFileHost.open(setup(), ['README.md'], { onOpenFile: () => {} });
    expect(host.siblings.folderName).toBe('repo');
  });

  it('relays change notices to listeners', async () => {
    const host = await WebFileHost.open(setup(), ['task-comments', 'tasks.md'], {
      onOpenFile: () => {},
    });
    let changes = 0;
    const sub = host.siblings.onChange(() => changes++);
    host.notifySiblings();
    sub.dispose();
    host.notifySiblings();
    expect(changes).toBe(1);
  });

  it('passes the decoded #anchor of a markdown link to onOpenFile', async () => {
    const opened: [string[], string | undefined][] = [];
    const host = await WebFileHost.open(setup(), ['task-comments', 'tasks.md'], {
      onOpenFile: (path, fragment) => opened.push([path, fragment]),
    });
    host.openLink('requirements.md#fr-1-tulis');
    host.openLink('requirements.md');
    host.openLink('design.md#caf%C3%A9');
    expect(opened).toEqual([
      [['task-comments', 'requirements.md'], 'fr-1-tulis'],
      [['task-comments', 'requirements.md'], undefined],
      [['task-comments', 'design.md'], 'café'],
    ]);
  });
});
