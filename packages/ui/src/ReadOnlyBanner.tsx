// SPDX-License-Identifier: LicenseRef-Proprietary
import type { EditorSnapshot } from '@markpiw/editor';
import { useState } from 'react';
import { useEditorSnapshot } from './context';
import { t } from './strings/id';

export interface BannerAction {
  readonly label: string;
  readonly onPress: () => void;
}

const selectReadOnly = (s: EditorSnapshot) => s.readOnly;

/** Alasan editor read-only (guard gagal, izin, dll.) beserta aksi pemulihan dari host. */
export function ReadOnlyBanner({ actions }: { actions: readonly BannerAction[] }) {
  const readOnly = useEditorSnapshot(selectReadOnly);
  const [copied, setCopied] = useState(false);
  if (!readOnly) return null;
  const message = readOnly.reason === 'guard' ? t('readonly.guard') : readOnly.message;
  const diagnostics =
    readOnly.reason === 'guard'
      ? JSON.stringify({ markpiw: 'guard-failure', path: readOnly.failure.path }, null, 2)
      : null;
  return (
    <div role="alert" className="mp-banner">
      <span className="mp-banner-text">{message}</span>
      <span className="mp-banner-actions">
        {actions.map((action) => (
          <button key={action.label} type="button" className="mp-button" onClick={action.onPress}>
            {action.label}
          </button>
        ))}
        {diagnostics && (
          <button
            type="button"
            className="mp-button mp-button-quiet"
            onClick={() => {
              void navigator.clipboard?.writeText(diagnostics).then(() => setCopied(true));
            }}
          >
            {copied ? t('readonly.copied') : t('readonly.copyDiagnostics')}
          </button>
        )}
      </span>
    </div>
  );
}
