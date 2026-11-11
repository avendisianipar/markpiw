// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parseExtensionMessage, parseWebviewMessage } from '../../src/protocol';
import { VsCodeFileHost } from '../../webview/vscode-host';

describe('spec trace messages', () => {
  it('init carries file and folder names and an optional reveal anchor', () => {
    const init = {
      type: 'init',
      text: '',
      version: 1,
      uiState: null,
      config: { assetsFolder: 'assets' },
      theme: null,
      fileName: 'tasks.md',
      folderName: 'task-comments',
    };
    expect(parseExtensionMessage({ ...init, reveal: 't1--schema' })).toMatchObject({
      fileName: 'tasks.md',
      folderName: 'task-comments',
      reveal: 't1--schema',
    });
    expect(parseExtensionMessage({ ...init, reveal: null })).toMatchObject({ reveal: null });
    expect(parseExtensionMessage(init)).toBeNull();
  });

  it('validates sibling and reveal messages', () => {
    expect(
      parseWebviewMessage({ type: 'readSiblings', requestId: 1, names: ['design.md'] }),
    ).toEqual({ type: 'readSiblings', requestId: 1, names: ['design.md'] });
    expect(parseWebviewMessage({ type: 'readSiblings', requestId: 1 })).toBeNull();
    expect(
      parseExtensionMessage({
        type: 'siblingsRead',
        requestId: 1,
        files: { 'design.md': '# D', 'tasks.md': null },
      }),
    ).not.toBeNull();
    expect(parseExtensionMessage({ type: 'siblingsChanged' })).toEqual({ type: 'siblingsChanged' });
    expect(parseExtensionMessage({ type: 'reveal', slug: 'fr-1' })).toEqual({
      type: 'reveal',
      slug: 'fr-1',
    });
    expect(parseExtensionMessage({ type: 'reveal' })).toBeNull();
  });

  it('webview host reads siblings through request/reply and relays change notices', async () => {
    const posted: unknown[] = [];
    const api = {
      postMessage: (m: unknown) => posted.push(m),
      getState: () => undefined,
      setState: () => {},
    };
    const host = new VsCodeFileHost(api as never, '', null, {
      fileName: 'requirements.md',
      folderName: 'spec',
    });
    const siblings = host.siblings;
    expect(siblings.fileName).toBe('requirements.md');
    expect(siblings.folderName).toBe('spec');
    const pending = siblings.read('design.md');
    expect(posted).toEqual([{ type: 'readSiblings', requestId: 1, names: ['design.md'] }]);
    host.handleReply({ type: 'siblingsRead', requestId: 1, files: { 'design.md': '# Desain' } });
    expect(await pending).toBe('# Desain');
    let changes = 0;
    const sub = siblings.onChange(() => changes++);
    host.notifySiblings();
    sub.dispose();
    host.notifySiblings();
    expect(changes).toBe(1);
  });
});
