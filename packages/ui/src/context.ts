// SPDX-License-Identifier: MIT
import type { EditorController, EditorSnapshot } from '@markpiw/editor';
import { createContext, useCallback, useContext, useRef, useSyncExternalStore } from 'react';

/** Hanya membawa instance controller (stabil); state dibaca lewat useEditorSnapshot. */
export const EditorContext = createContext<EditorController | null>(null);

export function useController(): EditorController {
  const controller = useContext(EditorContext);
  if (!controller) throw new Error('EditorContext tidak tersedia');
  return controller;
}

/**
 * Baca potongan snapshot editor. Komponen hanya di-render ulang bila hasil `selector`
 * berubah (dibandingkan dengan Object.is).
 */
export function useEditorSnapshot<T>(selector: (snapshot: EditorSnapshot) => T): T {
  const controller = useController();
  const last = useRef<{ snapshot: EditorSnapshot; value: T } | null>(null);
  const getValue = useCallback(() => {
    const snapshot = controller.getSnapshot();
    if (last.current?.snapshot === snapshot) return last.current.value;
    const value = selector(snapshot);
    if (last.current && Object.is(last.current.value, value)) {
      last.current = { snapshot, value: last.current.value };
    } else {
      last.current = { snapshot, value };
    }
    return last.current.value;
  }, [controller, selector]);
  return useSyncExternalStore(
    useCallback((listener) => controller.subscribe(listener), [controller]),
    getValue,
    getValue,
  );
}
