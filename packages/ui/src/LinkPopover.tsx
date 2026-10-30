// SPDX-License-Identifier: MIT
// Popover link (spesifikasi 5.2): muncul saat kursor di link atau Mod-K.
import { type EditorSnapshot, isSafeHref } from '@markpiw/editor';
import { ExternalLink, Unlink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';
import { useFloatingAt } from './useFloating';

const selectLink = (s: EditorSnapshot) => s.link;
const selectEditor = (s: EditorSnapshot) => s.linkEditor;
const selectReadOnly = (s: EditorSnapshot) => s.readOnly !== null;
const selectFrom = (s: EditorSnapshot) => s.link?.from ?? null;

export function LinkPopover() {
  const controller = useController();
  const link = useEditorSnapshot(selectLink);
  const editing = useEditorSnapshot(selectEditor);
  const readOnly = useEditorSnapshot(selectReadOnly);
  const from = useEditorSnapshot(selectFrom);
  const [href, setHref] = useState(link?.href ?? '');
  const input = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => setHref(link?.href ?? ''), [link?.href]);
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const open = !readOnly && (editing || link !== null);
  const rect = useMemo(() => {
    if (!open) return null;
    const view = controller.editorView;
    if (!view) return null;
    try {
      const pos = from ?? view.state.selection.from;
      const c = view.coordsAtPos(pos);
      return { left: c.left, top: c.top, bottom: c.bottom };
    } catch {
      return null;
    }
  }, [controller, open, from]);
  useFloatingAt(ref, rect);
  if (!open) return null;

  const close = () => {
    controller.closeLinkEditor();
    controller.focus();
  };
  return createPortal(
    <form
      ref={ref}
      className="mp-popover mp-link-popover"
      style={{ position: 'fixed', left: 0, top: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        controller.commands.setLink(href);
        controller.closeLinkEditor();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <label className="mp-field">
        <span className="mp-visually-hidden">{t('link.url')}</span>
        <input
          ref={input}
          value={href}
          placeholder="https://…"
          onChange={(event) => setHref(event.target.value)}
          aria-label={t('link.url')}
        />
      </label>
      <button type="submit" className="mp-button">
        {t('link.apply')}
      </button>
      {link && (
        <>
          <button
            type="button"
            className="mp-icon-button"
            aria-label={t('link.open')}
            title={t('link.open')}
            disabled={!isSafeHref(link.href)}
            onClick={() => controller.commands.openLink(link.href)}
          >
            <ExternalLink size={16} aria-hidden />
          </button>
          <button
            type="button"
            className="mp-icon-button"
            aria-label={t('link.remove')}
            title={t('link.remove')}
            onClick={() => {
              controller.commands.removeLink();
              controller.closeLinkEditor();
            }}
          >
            <Unlink size={16} aria-hidden />
          </button>
        </>
      )}
    </form>,
    document.body,
  );
}
