// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Keybinding {
  key: string;
  mac?: string;
  command: string;
  when?: string;
}

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8'),
) as {
  contributes: { keybindings?: Keybinding[] };
};

describe('extension manifest', () => {
  // Shortcut markpiw yang juga dipakai VS Code; tanpa override, keduanya berjalan.
  it.each([
    'cmd+b',
    'cmd+i',
    'cmd+e',
    'cmd+shift+x',
    'cmd+k',
    'cmd+alt+1',
    'cmd+alt+0',
    'cmd+shift+7',
    'cmd+shift+8',
    'cmd+shift+9',
  ])('%s is claimed while markpiw is the active editor', (key) => {
    const binding = manifest.contributes.keybindings?.find((b) => b.mac === key);
    expect(binding?.when).toBe("activeCustomEditorId == 'markpiw.editor'");
    expect(binding?.key).toBe(key.replace('cmd', 'ctrl'));
  });
});
