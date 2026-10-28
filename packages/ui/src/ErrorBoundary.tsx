// SPDX-License-Identifier: LicenseRef-Proprietary
import { Component, type ReactNode } from 'react';
import { t } from './strings/id';

/**
 * Jika editor crash, tampilkan teks markdown terakhir yang valid sebagai baca-saja dan
 * jangan menulis apa pun (spesifikasi 5.1).
 */
export class EditorErrorBoundary extends Component<
  { fallbackText: () => string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.error('markpiw: editor crash', error);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mp-crash">
        <div role="alert" className="mp-banner">
          {t('readonly.crash')}
        </div>
        <pre className="mp-crash-source">{this.props.fallbackText()}</pre>
      </div>
    );
  }
}
