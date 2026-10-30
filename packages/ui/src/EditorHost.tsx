// SPDX-License-Identifier: MIT
import type { EditorController } from '@markpiw/editor';
import { memo, useLayoutEffect, useRef } from 'react';

/**
 * Div kosong tempat EditorView dipasang (spesifikasi 5.1). Tidak pernah me-render anak;
 * aman untuk StrictMode yang me-mount dua kali.
 */
export const EditorHost = memo(function EditorHost({
  controller,
}: {
  controller: EditorController;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    controller.mount(element);
    return () => controller.unmount();
  }, [controller]);
  return <div ref={ref} className="mp-editor-host" />;
});
