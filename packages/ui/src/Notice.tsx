// SPDX-License-Identifier: LicenseRef-Proprietary
import type { EditorSnapshot } from '@markpiw/editor';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';

const selectNotice = (s: EditorSnapshot) => s.notice;

/** Notifikasi singkat dari editor (mis. gagal menyimpan gambar). Hilang sendiri setelah 6 dtk. */
export function Notice() {
  const controller = useController();
  const notice = useEditorSnapshot(selectNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => controller.dismissNotice(), 6000);
    return () => clearTimeout(timer);
  }, [controller, notice]);
  if (!notice) return null;
  return (
    <div
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={`mp-notice mp-notice-${notice.kind}`}
    >
      <span>{notice.message}</span>
      <button
        type="button"
        className="mp-icon-button"
        aria-label={t('notice.dismiss')}
        onClick={() => controller.dismissNotice()}
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
