// SPDX-License-Identifier: MIT
// Source tersembunyi (marker callout, tag HTML, source diagram) baru dimunculkan setelah
// pengguna menaruh kursor. Selection awal dokumen yang baru dibuka tidak dihitung, sehingga
// tampilan awal sama persis dengan GitHub.
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';

const activeKey = new PluginKey<boolean>('markpiwActiveSelection');

export function activeSelection(): Plugin<boolean> {
  return new Plugin<boolean>({
    key: activeKey,
    state: {
      init: () => false,
      apply: (tr, prev) => prev || tr.selectionSet,
    },
  });
}

/** True jika selection pengguna menyentuh rentang [from, to). */
export function selectionTouches(state: EditorState, from: number, to: number): boolean {
  if (activeKey.getState(state) !== true) return false;
  const { selection } = state;
  return selection.from < to && selection.to > from;
}

/** True jika kepala selection pengguna berada di [from, to]. */
export function headWithin(state: EditorState, from: number, to: number): boolean {
  if (activeKey.getState(state) !== true) return false;
  const { head } = state.selection;
  return head >= from && head <= to;
}
