// SPDX-License-Identifier: LicenseRef-Proprietary
import { schema } from '@markpiw/markdown';
import { Plugin } from 'prosemirror-state';
import type { EditorController } from '../controller';

/** Mod+klik membuka link lewat host; klik biasa hanya menaruh kursor. */
export function linkClicks(controller: EditorController): Plugin {
  return new Plugin({
    props: {
      handleDOMEvents: {
        // Link di dokumen tidak pernah bernavigasi lewat klik biasa (juga saat read-only, ketika
        // contenteditable mati): membuka link hanya lewat Mod+klik atau popover.
        click(_view, event) {
          if ((event.target as Element | null)?.closest?.('a')) event.preventDefault();
          return false;
        },
      },
      handleClick(view, pos, event) {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const $pos = view.state.doc.resolve(pos);
        const mark =
          schema.marks.link.isInSet($pos.marks()) ??
          schema.marks.link.isInSet($pos.nodeAfter?.marks ?? []);
        if (!mark) return false;
        controller.commands.openLink(mark.attrs.href as string);
        return true;
      },
    },
  });
}
