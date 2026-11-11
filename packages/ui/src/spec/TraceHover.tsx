// SPDX-License-Identifier: MIT
// Kartu kecil saat chip ID di dokumen di-hover: section tujuan (jenis dokumen, ID, judul,
// cuplikan, status) dan tombol Buka. Untuk ID yang didefinisikan di heading ini sendiri, kartu
// menampilkan berapa bagian yang merujuknya.
import { ArrowRight } from 'lucide-react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { t } from '../strings/id';
import { useFloatingAt } from '../useFloating';
import { KindBadge, kindLabel, StatusIcon, titleWithoutId } from './parts';
import type { SpecApi } from './useSpec';

interface Hovered {
  readonly id: string;
  readonly definition: boolean;
  readonly rect: { left: number; top: number; bottom: number };
}

/** Jeda sebelum kartu ditutup, agar pointer sempat pindah dari chip ke kartu. */
const HIDE_DELAY = 220;
const SHOW_DELAY = 250;

const modKey = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

export function TraceHover(props: {
  readonly spec: SpecApi;
  readonly canvas: RefObject<HTMLElement | null>;
}) {
  const { spec, canvas } = props;
  const [hovered, setHovered] = useState<Hovered | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const timers = useRef<{
    show?: ReturnType<typeof setTimeout>;
    hide?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const pending = timers.current;
    const chipOf = (target: EventTarget | null) =>
      (target as Element | null)?.closest?.('[data-trace-id]') ?? null;
    const over = (event: MouseEvent) => {
      const chip = chipOf(event.target);
      if (!chip) return;
      clearTimeout(pending.hide);
      clearTimeout(pending.show);
      pending.show = setTimeout(() => {
        const r = chip.getBoundingClientRect();
        setHovered({
          id: chip.getAttribute('data-trace-id') ?? '',
          definition: chip.classList.contains('mp-trace-def'),
          rect: { left: r.left, top: r.top, bottom: r.bottom },
        });
      }, SHOW_DELAY);
    };
    const out = (event: MouseEvent) => {
      if (!chipOf(event.target)) return;
      clearTimeout(pending.show);
      pending.hide = setTimeout(() => setHovered(null), HIDE_DELAY);
    };
    const hide = () => {
      clearTimeout(pending.show);
      setHovered(null);
    };
    element.addEventListener('mouseover', over);
    element.addEventListener('mouseout', out);
    element.addEventListener('scroll', hide, { passive: true });
    element.addEventListener('keydown', hide);
    return () => {
      element.removeEventListener('mouseover', over);
      element.removeEventListener('mouseout', out);
      element.removeEventListener('scroll', hide);
      element.removeEventListener('keydown', hide);
      clearTimeout(pending.show);
      clearTimeout(pending.hide);
    };
  }, [canvas]);

  useFloatingAt(card, hovered?.rect ?? null);

  if (!hovered) return null;
  const { graph } = spec.snapshot;
  const ref = graph.definitions.get(hovered.id);
  const link = ref ? graph.link(ref) : null;
  if (!ref || !link) return null;
  const referencedBy = graph.trace(ref.kind, ref.index).incoming.length;
  const keep = () => clearTimeout(timers.current.hide);
  const leave = () => {
    timers.current.hide = setTimeout(() => setHovered(null), HIDE_DELAY);
  };
  return (
    <div
      ref={card}
      className="mp-popover mp-trace-card"
      role="tooltip"
      onMouseEnter={keep}
      onMouseLeave={leave}
    >
      <div className="mp-trace-card-head">
        <KindBadge kind={link.kind} />
        <span className="mp-trace-card-kind">{kindLabel(link.kind)}</span>
        {link.status && <StatusIcon status={link.status} />}
      </div>
      <div className="mp-trace-link-title mp-trace-card-title">
        <span className="mp-trace-link-id">{hovered.id}</span>
        <span>{titleWithoutId(link.title, link.id)}</span>
      </div>
      {link.snippet && <p className="mp-trace-card-snippet">{link.snippet}</p>}
      <div className="mp-trace-card-foot">
        {hovered.definition ? (
          <span className="mp-trace-card-meta">
            {t('trace.definedHere')} ·{' '}
            {referencedBy > 0
              ? t('trace.referencedBy', { count: referencedBy })
              : t('trace.notReferenced')}
          </span>
        ) : (
          <>
            <span className="mp-trace-card-meta">{t('trace.modClick', { mod: modKey() })}</span>
            <button
              type="button"
              className="mp-trace-card-open"
              onClick={() => {
                setHovered(null);
                spec.navigateToId(hovered.id);
              }}
            >
              {t('trace.open')}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
