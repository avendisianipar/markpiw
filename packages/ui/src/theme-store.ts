// SPDX-License-Identifier: LicenseRef-Proprietary
// Mode terang/gelap, sama untuk web dan VS Code: tanpa pilihan pengguna, ikut skema "sistem"
// (OS di web, tema VS Code di webview); setelah memilih, pilihan disimpan host. Skema aktif
// dipasang sebagai data-theme di <html> dan dibaca token --mp-* di theme.css.
import type { ColorScheme } from './ThemeToggle';

export interface SchemeSource {
  get(): ColorScheme;
  subscribe(listener: () => void): void;
}

export interface ThemeStoreOptions {
  readonly root: HTMLElement;
  readonly system: SchemeSource;
  /** Pilihan tersimpan dari sesi sebelumnya, atau null bila belum pernah memilih. */
  readonly chosen: ColorScheme | null;
  readonly save: (next: ColorScheme) => void;
  /** VS Code: pakai warna tema host (data-host-colors) selama skemanya sama dengan host. */
  readonly hostColors?: boolean;
}

export interface ThemeStore {
  get(): ColorScheme;
  /** Pilihan pengguna: diterapkan dan disimpan. */
  set(next: ColorScheme): void;
  /** Pilihan dari tempat lain (mis. panel lain): diterapkan tanpa disimpan ulang. */
  adopt(next: ColorScheme): void;
  subscribe(listener: () => void): () => void;
}

export function createThemeStore(options: ThemeStoreOptions): ThemeStore {
  const { root, system } = options;
  let chosen = options.chosen;
  const listeners = new Set<() => void>();
  const current = () => chosen ?? system.get();

  const apply = () => {
    const scheme = current();
    root.dataset.theme = scheme;
    if (options.hostColors) root.toggleAttribute('data-host-colors', scheme === system.get());
    listeners.forEach((fn) => fn());
  };

  apply();
  system.subscribe(apply);

  return {
    get: current,
    set(next) {
      chosen = next;
      options.save(next);
      apply();
    },
    adopt(next) {
      chosen = next;
      apply();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
