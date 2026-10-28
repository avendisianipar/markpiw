// SPDX-License-Identifier: LicenseRef-Proprietary
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  type VirtualElement,
} from '@floating-ui/dom';
import { type RefObject, useLayoutEffect } from 'react';

/** Posisikan `floating` di bawah sebuah titik/rect layar (virtual element Floating UI). */
export function useFloatingAt(
  floating: RefObject<HTMLElement | null>,
  rect: { left: number; top: number; bottom: number } | null,
  scrollRoot?: HTMLElement | null,
): void {
  useLayoutEffect(() => {
    const element = floating.current;
    if (!element || !rect) return;
    const reference: VirtualElement = {
      getBoundingClientRect: () =>
        new DOMRect(rect.left, rect.top, 0, Math.max(0, rect.bottom - rect.top)),
    };
    const update = () => {
      void computePosition(reference, element, {
        placement: 'bottom-start',
        strategy: 'fixed',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
      });
    };
    update();
    return autoUpdate(reference, element, update, {
      elementResize: false,
      layoutShift: false,
      ancestorScroll: Boolean(scrollRoot),
    });
  }, [floating, rect, scrollRoot]);
}
