// SPDX-License-Identifier: MIT
import { gapCursor } from 'prosemirror-gapcursor';
import { history } from 'prosemirror-history';
import type { Plugin } from 'prosemirror-state';
import type { EditorController } from '../controller';
import { activeSelection } from './active';
import { callouts } from './callout';
import { syntaxHighlight } from './highlight';
import {
  emptyTableHeader,
  placeholder,
  previewBlocks,
  tableAlignment,
  trailingParagraph,
} from './decorations';
import { htmlLayout } from './html';
import { markdownInputRules } from './inputrules';
import { baseKeys, editorKeymap } from './keymap';
import { linkClicks } from './link';
import { pastePlugin } from './paste';
import { searchPlugin } from './search';
import { slashPlugin } from './slash';
import { tracePlugin } from './trace';

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
    tracePlugin((id) => controller.activateTrace(id)),
    placeholder(controller.strings.placeholder),
    trailingParagraph(),
    activeSelection(),
    tableAlignment(),
    emptyTableHeader(),
    callouts(controller.strings),
    htmlLayout(controller.strings.detailsToggle),
    previewBlocks(),
    searchPlugin(),
    syntaxHighlight(),
    gapCursor(),
    baseKeys(),
  );
  return plugins;
}
