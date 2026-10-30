// SPDX-License-Identifier: LicenseRef-Proprietary
// Daftar isi melayang di kanan canvas: garis tipis per heading; panel daftar muncul saat
// hover/fokus. Heading aktif mengikuti posisi gulir canvas.
import type { EditorSnapshot, HeadingInfo } from '@markpiw/editor';
import { type RefObject, useEffect, useState } from 'react';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';

const selectOutline = (s: EditorSnapshot) => s.outline;
/** Heading dianggap sedang dibaca bila puncaknya sudah melewati batas ini dari atas canvas. */
const ACTIVE_OFFSET = 80;

/** Indeks heading terakhir yang puncaknya sudah melewati bagian atas canvas. */
function useActiveHeading(
  canvas: RefObject<HTMLElement | null>,
  outline: readonly HeadingInfo[],
): number {
  const controller = useController();
  const [active, setActive] = useState(0);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const view = controller.editorView;
      if (!view) return;
      // Di dasar canvas heading terakhir tidak bisa digulir ke atas; anggap dialah yang aktif.
      const scrollable = element.scrollHeight > element.clientHeight;
      if (scrollable && element.scrollTop + element.clientHeight >= element.scrollHeight - 2) {
        setActive(outline.length - 1);
        return;
      }
      const limit = element.getBoundingClientRect().top + ACTIVE_OFFSET;
      let index = 0;
      outline.forEach((heading, i) => {
        const dom = view.nodeDOM(heading.pos);
        if (dom instanceof HTMLElement && dom.getBoundingClientRect().top <= limit) index = i;
      });
      setActive(index);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    element.addEventListener('scroll', schedule, { passive: true });
    return () => {
      element.removeEventListener('scroll', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [controller, canvas, outline]);
  return Math.min(active, outline.length - 1);
}

export function Outline({ canvas }: { readonly canvas: RefObject<HTMLElement | null> }) {
  const controller = useController();
  const outline = useEditorSnapshot(selectOutline);
  const active = useActiveHeading(canvas, outline);
  if (outline.length === 0) return null;
  return (
    <nav
      className="mp-outline"
      aria-label={t('outline.label')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') controller.focus();
      }}
    >
      <div className="mp-outline-rail" aria-hidden="true">
        {outline.map((heading, i) => (
          <span
            key={heading.pos}
            className="mp-outline-rail-line"
            data-level={heading.level}
            data-active={i === active || undefined}
          />
        ))}
      </div>
      <ul className="mp-outline-panel">
        {outline.map((heading, i) => (
          <li key={heading.pos}>
            <button
              type="button"
              className="mp-outline-item"
              data-level={heading.level}
              aria-current={i === active ? 'location' : undefined}
              onClick={() => controller.commands.goToHeading(heading.pos)}
            >
              {heading.text || t('outline.untitled')}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
