// SPDX-License-Identifier: MIT
import type { EditorSnapshot } from '@markpiw/editor';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';
import { useFloatingAt } from './useFloating';

const selectImage = (s: EditorSnapshot) => s.image;
const selectReadOnly = (s: EditorSnapshot) => s.readOnly !== null;

/** Edit alt dan URL gambar yang sedang dipilih. */
export function ImagePopover() {
  const controller = useController();
  const image = useEditorSnapshot(selectImage);
  const readOnly = useEditorSnapshot(selectReadOnly);
  const [alt, setAlt] = useState('');
  const [src, setSrc] = useState('');
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    setAlt(image?.alt ?? '');
    setSrc(image?.src ?? '');
  }, [image?.alt, image?.src]);
  const rect = useMemo(() => {
    const view = controller.editorView;
    if (!image || !view) return null;
    try {
      const c = view.coordsAtPos(image.pos);
      return { left: c.left, top: c.top, bottom: c.bottom };
    } catch {
      return null;
    }
  }, [controller, image]);
  useFloatingAt(ref, rect);
  if (!image || readOnly) return null;
  return createPortal(
    <form
      ref={ref}
      className="mp-popover mp-image-popover"
      style={{ position: 'fixed', left: 0, top: 0 }}
      onSubmit={(event) => {
        event.preventDefault();
        controller.commands.setImageAttrs(image.pos, { alt, src });
        controller.focus();
      }}
    >
      <input
        value={alt}
        onChange={(e) => setAlt(e.target.value)}
        aria-label={t('image.alt')}
        placeholder={t('image.alt')}
      />
      <input
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        aria-label={t('image.src')}
        placeholder={t('image.src')}
      />
      <button type="submit" className="mp-button">
        {t('image.apply')}
      </button>
    </form>,
    document.body,
  );
}
