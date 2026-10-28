// SPDX-License-Identifier: LicenseRef-Proprietary
import { baseKeymap } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorController } from '../controller';
import type { SlashState } from '../snapshot';

export interface SlashPluginState {
  readonly active: SlashState | null;
}

export const slashKey = new PluginKey<SlashPluginState>('markpiw-slash');

/** Plugin editor sesuai urutan prioritas spesifikasi 4.2. */
export function createPlugins(controller: EditorController): Plugin[] {
  const plugins: Plugin[] = [
    new Plugin<SlashPluginState>({
      key: slashKey,
      state: { init: () => ({ active: null }), apply: (_tr, value) => value },
    }),
    keymap({
      'Mod-z': () => controller.commands.undo(),
      'Mod-Shift-z': () => controller.commands.redo(),
      'Mod-y': () => controller.commands.redo(),
    }),
  ];
  if (controller.host.historyMode === 'editor') plugins.push(history({ newGroupDelay: 500 }));
  plugins.push(keymap(baseKeymap));
  return plugins;
}
