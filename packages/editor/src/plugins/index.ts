// SPDX-License-Identifier: MIT
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
import type { Plugin } from 'prosemirror-state';
import type { EditorController } from '../controller';
import { callouts } from './callout';
import { syntaxHighlight } from './highlight';
import { placeholder, tableAlignment, trailingParagraph } from './decorations';
import { markdownInputRules } from './inputrules';
import { baseKeys, editorKeymap } from './keymap';
import { linkClicks } from './link';
import { pastePlugin } from './paste';
import { slashPlugin } from './slash';

export { slashKey } from './slash';

/** Plugin editor sesuai urutan prioritas spesifikasi 4.2. */
export function createPlugins(controller: EditorController): Plugin[] {
  const plugins: Plugin[] = [
    slashPlugin(controller),
    editorKeymap(controller),
    markdownInputRules(),
  ];
  if (controller.host.historyMode === 'editor') plugins.push(history({ newGroupDelay: 500 }));
  plugins.push(
    pastePlugin(controller),
    linkClicks(controller),
    placeholder(controller.strings.placeholder),
    trailingParagraph(),
    tableAlignment(),
    callouts(controller.strings),
    syntaxHighlight(),
    gapCursor(),
    baseKeys(),
  );
  return plugins;
}
