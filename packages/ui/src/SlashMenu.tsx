// SPDX-License-Identifier: LicenseRef-Proprietary
// Slash menu (spesifikasi 5.2): portal, posisi via Floating UI, pola listbox dengan
// aria-activedescendant di elemen editor; fokus tetap di editor.
import type { EditorSnapshot } from '@markpiw/editor';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';
import { useFloatingAt } from './useFloating';

const selectSlash = (s: EditorSnapshot) => s.slash;
const LISTBOX_ID = 'mp-slash-listbox';

export function SlashMenu() {
  const controller = useController();
  const slash = useEditorSnapshot(selectSlash);
  const ref = useRef<HTMLDivElement>(null);
  const rect = useMemo(() => slash?.anchorRect ?? null, [slash?.anchorRect]);
  useFloatingAt(ref, rect);

  const activeId = slash ? `mp-slash-${slash.items[slash.selectedIndex]?.id ?? ''}` : null;
  useEffect(() => {
    const dom = controller.editorView?.dom;
    if (!dom) return;
    if (slash && activeId) {
      dom.setAttribute('aria-controls', LISTBOX_ID);
      dom.setAttribute('aria-expanded', 'true');
      dom.setAttribute('aria-activedescendant', activeId);
    } else {
      dom.removeAttribute('aria-controls');
      dom.setAttribute('aria-expanded', 'false');
      dom.removeAttribute('aria-activedescendant');
    }
  }, [controller, slash, activeId]);

  useEffect(() => {
    document.getElementById(activeId ?? '')?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  if (!slash) return null;
  return createPortal(
    <div ref={ref} className="mp-slash" style={{ position: 'fixed', left: 0, top: 0 }}>
      <ul id={LISTBOX_ID} role="listbox" aria-label={t('slash.label')} className="mp-slash-list">
        {slash.items.map((item, index) => (
          <li
            key={item.id}
            id={`mp-slash-${item.id}`}
            role="option"
            aria-selected={index === slash.selectedIndex}
            className="mp-slash-item"
            onMouseDown={(event) => {
              event.preventDefault();
              controller.runSlashItem(item.id);
            }}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>,
    document.body,
  );
}
