// SPDX-License-Identifier: LicenseRef-Proprietary
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorController } from '../controller';
import type { SlashState } from '../snapshot';
import { placeholder, trailingParagraph } from './decorations';
import { markdownInputRules } from './inputrules';
import { baseKeys, editorKeymap } from './keymap';
import { linkClicks } from './link';

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
    editorKeymap(controller),
    markdownInputRules(),
  ];
  if (controller.host.historyMode === 'editor') plugins.push(history({ newGroupDelay: 500 }));
  plugins.push(
    linkClicks(controller),
    placeholder(controller.strings.placeholder),
    trailingParagraph(),
    gapCursor(),
    baseKeys(),
  );
  return plugins;
}
