// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parseExtensionMessage, parseWebviewMessage } from '../../src/protocol';
import { vscodeSchemeSource } from '../../webview/theme';

describe('theme messages', () => {
  const init = {
    type: 'init',
    text: '',
    version: 1,
    uiState: null,
    config: { assetsFolder: 'assets' },
  };

  it('init carries the saved theme, or null when never chosen', () => {
    expect(parseExtensionMessage({ ...init, theme: 'dark' })).toMatchObject({ theme: 'dark' });
    expect(parseExtensionMessage({ ...init, theme: null })).toMatchObject({ theme: null });
    expect(parseExtensionMessage({ ...init, theme: 'blue' })).toBeNull();
  });

  it('webview asks to save a theme; extension broadcasts it', () => {
    expect(parseWebviewMessage({ type: 'setTheme', theme: 'light' })).toEqual({
      type: 'setTheme',
      theme: 'light',
    });
    expect(parseWebviewMessage({ type: 'setTheme', theme: 'system' })).toBeNull();
    expect(parseExtensionMessage({ type: 'theme', theme: 'dark' })).toEqual({
      type: 'theme',
      theme: 'dark',
    });
  });
});

describe('vscodeSchemeSource', () => {
  const body = (className: string) => {
    const el = document.createElement('body');
    el.className = className;
    return el;
  };

  it('maps VS Code theme kinds to light/dark', () => {
    expect(vscodeSchemeSource(body('vscode-light')).get()).toBe('light');
    expect(vscodeSchemeSource(body('vscode-dark')).get()).toBe('dark');
    expect(vscodeSchemeSource(body('vscode-high-contrast')).get()).toBe('dark');
    expect(vscodeSchemeSource(body('vscode-high-contrast vscode-high-contrast-light')).get()).toBe(
      'light',
    );
  });

  it('notifies when the VS Code theme changes', async () => {
    const el = body('vscode-light');
    const source = vscodeSchemeSource(el);
    let calls = 0;
    source.subscribe(() => calls++);
    el.className = 'vscode-dark';
    await new Promise((r) => setTimeout(r, 0));
    expect(source.get()).toBe('dark');
    expect(calls).toBe(1);
  });
});
