// SPDX-License-Identifier: MIT
// Potongan UI bersama untuk trace spec: label jenis dokumen, ikon status task, dan judul tanpa ID.
import type { SpecKind, TaskStatus } from '@markpiw/spec';
import { CircleCheck, CircleDashed, CircleDot } from 'lucide-react';
import { t } from '../strings/id';

export const kindLabel = (kind: SpecKind) => t(`spec.kind.${kind}`);

export function KindBadge({ kind }: { readonly kind: SpecKind }) {
  return (
    <span className="mp-trace-kind" data-kind={kind} title={kindLabel(kind)} aria-hidden="true">
      {t(`spec.short.${kind}`)}
    </span>
  );
}

export function StatusIcon({ status }: { readonly status: TaskStatus }) {
  const label = t(`trace.status.${status}`);
  const Icon = status === 'done' ? CircleCheck : status === 'doing' ? CircleDot : CircleDashed;
  return (
    <span className="mp-trace-status" data-status={status} title={label}>
      <Icon size={14} aria-hidden="true" />
      <span className="mp-visually-hidden">{label}</span>
    </span>
  );
}

/** Judul section tanpa ID di depannya (ID ditampilkan terpisah). */
export function titleWithoutId(title: string, id: string | null): string {
  if (!id || !title.startsWith(id)) return title;
  return title.slice(id.length).replace(/^[\s:—–\-.]+/u, '') || title;
}
