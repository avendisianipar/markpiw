// SPDX-License-Identifier: LicenseRef-Proprietary
// "Sistem" di webview = jenis tema VS Code, dibaca dari class yang dipasang VS Code di <body>
// dan ikut berubah saat pengguna mengganti tema.
import type { ColorScheme, SchemeSource } from '@markpiw/ui';

function scheme(body: HTMLElement): ColorScheme {
  const c = body.classList;
  if (c.contains('vscode-high-contrast-light') || c.contains('vscode-light')) return 'light';
  return c.contains('vscode-dark') || c.contains('vscode-high-contrast') ? 'dark' : 'light';
}

export function vscodeSchemeSource(body: HTMLElement): SchemeSource {
  return {
    get: () => scheme(body),
    subscribe(listener) {
      new MutationObserver(listener).observe(body, {
        attributes: true,
        attributeFilter: ['class'],
      });
    },
  };
}
