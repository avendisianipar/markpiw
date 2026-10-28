// SPDX-License-Identifier: LicenseRef-Proprietary
import { TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { EditorController } from '../src';
import { FakeHost } from './fake-host';
import { strings } from './strings';

export function setup(text: string, mode: 'editor' | 'host' = 'editor') {
  const host = new FakeHost(text, mode);
  const c = new EditorController({ text, host, strings });
  const el = document.createElement('div');
  document.body.append(el);
  c.mount(el);
  const view = c.editorView as EditorView;
  return { c, host, el, view };
}

/** Taruh kursor di akhir dokumen (atau di akhir teks `needle`). */
export function cursorAt(c: EditorController, needle?: string) {
  let pos = c.state.doc.content.size - 1;
  if (needle !== undefined) {
    c.state.doc.descendants((node, p) => {
      if (node.isText && node.text?.includes(needle))
        pos = p + node.text.indexOf(needle) + needle.length;
    });
  }
  c.dispatch(c.state.tr.setSelection(TextSelection.near(c.state.doc.resolve(pos))));
}

/** Ketik teks karakter per karakter seperti pengguna (input rules ikut berjalan). */
export function type(view: EditorView, text: string) {
  for (const ch of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) =>
      f(view, from, to, ch, () => view.state.tr.insertText(ch, from, to)),
    );
    if (!handled) view.dispatch(view.state.tr.insertText(ch, from, to));
  }
}

/** Tekan tombol (mis. 'Enter', 'Tab', 'Mod-b'). */
export function press(view: EditorView, key: string) {
  const parts = key.split('-');
  const name = parts.pop() as string;
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  const event = new KeyboardEvent('keydown', {
    key: name,
    ctrlKey: mods.has('mod') || mods.has('ctrl'),
    shiftKey: mods.has('shift'),
    altKey: mods.has('alt'),
    bubbles: true,
    cancelable: true,
  });
  return view.someProp('handleKeyDown', (f) => f(view, event)) ?? false;
}

export const md = (c: EditorController) => {
  const r = c.serialize();
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};
