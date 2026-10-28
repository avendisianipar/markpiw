// SPDX-License-Identifier: LicenseRef-Proprietary
import { schema } from '@markpiw/markdown';
import { baseKeymap, chainCommands } from 'prosemirror-commands';
import { undoInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { type Command, type Plugin, TextSelection } from 'prosemirror-state';
import type { EditorController } from '../controller';
import { findList } from '../snapshot';
import { tableCommands } from '../table';

/** "```lang" / "~~~lang" + Enter di paragraf → code block. */
const codeFenceOnEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type !== schema.nodes.paragraph) return false;
  const m = /^(`{3,}|~{3,})([^`]*)$/.exec($from.parent.textContent);
  if (!m || $from.parentOffset !== $from.parent.content.size) return false;
  if (dispatch) {
    const fence = (m[1] as string)[0] === '`' ? '```' : '~~~';
    const tr = state.tr
      .delete($from.start(), $from.end())
      .setBlockType($from.start(), $from.start(), schema.nodes.code_block, {
        lang: (m[2] as string).trim(),
        fence,
        fenceLength: (m[1] as string).length,
      });
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** "---" / "***" / "___" + Enter di paragraf tingkat dokumen → garis pemisah. */
const hrOnEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type !== schema.nodes.paragraph || $from.depth !== 1) return false;
  const text = $from.parent.textContent;
  if (!/^(---|\*\*\*|___)$/.test(text)) return false;
  if (dispatch) {
    const start = $from.before();
    const tr = state.tr.replaceWith(start, $from.after(), [
      schema.nodes.horizontal_rule.create({ marker: text }),
      schema.nodes.paragraph.create(),
    ]);
    tr.setSelection(TextSelection.create(tr.doc, start + 2));
    dispatch(tr.scrollIntoView());
  }
  return true;
};

/** Split item list; item task baru dimulai belum dicentang. */
const splitItem: Command = (state, dispatch) => {
  const found = findList(state);
  const attrs = found && found.item.attrs.checked !== null ? { checked: false } : undefined;
  return splitListItem(schema.nodes.list_item, attrs)(state, dispatch);
};

const inTable: Command = (state) => tableCommands.goToCell(1)(state);

export function editorKeymap(controller: EditorController): Plugin {
  const c = controller.commands;
  const mark =
    (name: 'strong' | 'em' | 'strike' | 'code'): Command =>
    () =>
      c.toggleMark(name);
  const heading =
    (level: 1 | 2 | 3 | 4 | 5 | 6): Command =>
    () =>
      c.setBlock({ type: 'heading', level });
  return keymap({
    'Mod-b': mark('strong'),
    'Mod-i': mark('em'),
    'Mod-e': mark('code'),
    'Mod-Shift-x': mark('strike'),
    'Mod-k': () => {
      controller.openLinkEditor();
      return true;
    },
    'Mod-Alt-0': () => c.setBlock({ type: 'paragraph' }),
    'Mod-Alt-1': heading(1),
    'Mod-Alt-2': heading(2),
    'Mod-Alt-3': heading(3),
    'Mod-Alt-4': heading(4),
    'Mod-Alt-5': heading(5),
    'Mod-Alt-6': heading(6),
    'Mod-Shift-7': () => c.wrapList('ordered'),
    'Mod-Shift-8': () => c.wrapList('bullet'),
    'Mod-Shift-9': () => c.wrapList('task'),
    Tab: chainCommands(
      (state, dispatch) => (inTable(state) ? tableCommands.goToCell(1)(state, dispatch) : false),
      sinkListItem(schema.nodes.list_item),
    ),
    'Shift-Tab': chainCommands(
      (state, dispatch) => (inTable(state) ? tableCommands.goToCell(-1)(state, dispatch) : false),
      liftListItem(schema.nodes.list_item),
    ),
    Enter: chainCommands(
      codeFenceOnEnter,
      hrOnEnter,
      splitItem,
      liftListItem(schema.nodes.list_item),
    ),
    Backspace: undoInputRule,
    'Mod-z': () => c.undo(),
    'Mod-Shift-z': () => c.redo(),
    'Mod-y': () => c.redo(),
  });
}

export const baseKeys = (): Plugin => keymap(baseKeymap);
