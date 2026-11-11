// SPDX-License-Identifier: MIT
// Hubungkan SpecModel (paket spec) dengan editor: dokumen aktif dibaca live dari controller, ID
// yang dikenal dipasang sebagai chip, dan navigasi ke section lewat editor atau host.
import type { EditorController } from '@markpiw/editor';
import { SPEC_FILES, type SpecKind, SpecModel, type SpecSnapshot } from '@markpiw/spec';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

export interface SpecTarget {
  readonly kind: SpecKind;
  /** Urutan heading di dokumen tujuan. */
  readonly index?: number;
  /** Anchor heading di dokumen tujuan (untuk membuka file lain). */
  readonly slug?: string;
}

export interface SpecApi {
  readonly snapshot: SpecSnapshot;
  /** Pindah ke dokumen spec lain, atau ke section tertentu (di dokumen ini atau lainnya). */
  navigate(target: SpecTarget): void;
  /** Pindah ke section yang mendefinisikan `id`. */
  navigateToId(id: string): void;
}

const noop = () => () => {};
const nothing = () => null;

export function useSpec(controller: EditorController): SpecApi | null {
  const [model, setModel] = useState<SpecModel | null>(null);

  useEffect(() => {
    const siblings = controller.host.siblings;
    const created = siblings
      ? SpecModel.for({ siblings, activeDoc: () => controller.state.doc })
      : null;
    if (!created) return;
    setModel(created);
    void created.start();
    // Semua perubahan dokumen (ketikan, undo, perubahan dari luar) lewat snapshot editor.
    let doc = controller.state.doc;
    const unsubscribe = controller.subscribe(() => {
      if (controller.state.doc === doc) return;
      doc = controller.state.doc;
      created.activeChanged();
    });
    return () => {
      unsubscribe();
      created.dispose();
      setModel((current) => (current === created ? null : current));
    };
  }, [controller]);

  const snapshot = useSyncExternalStore(
    model ? model.subscribe : noop,
    model ? model.getSnapshot : nothing,
    model ? model.getSnapshot : nothing,
  );

  // Chip hanya untuk ID yang terdefinisi di salah satu dokumen spec.
  useEffect(() => {
    if (!snapshot) return;
    controller.setTraceIds(new Set(snapshot.graph.definitions.keys()));
  }, [controller, snapshot]);

  const navigate = useCallback(
    (target: SpecTarget) => {
      if (!snapshot) return;
      if (target.kind === snapshot.active) {
        if (target.index !== undefined) controller.revealHeading(target.index);
        return;
      }
      if (!snapshot.files[target.kind]) return;
      const file = SPEC_FILES[target.kind];
      controller.commands.openLink(target.slug ? `${file}#${target.slug}` : file);
    },
    [controller, snapshot],
  );

  const navigateToId = useCallback(
    (id: string) => {
      const ref = snapshot?.graph.definitions.get(id);
      const link = ref && snapshot?.graph.link(ref);
      if (link) navigate({ kind: link.kind, index: link.index, slug: link.slug });
    },
    [navigate, snapshot],
  );

  useEffect(() => {
    const sub = controller.onTraceActivate(navigateToId);
    return () => sub.dispose();
  }, [controller, navigateToId]);

  return useMemo(
    () => (snapshot ? { snapshot, navigate, navigateToId } : null),
    [snapshot, navigate, navigateToId],
  );
}
