// SPDX-License-Identifier: LicenseRef-Proprietary
// Mode terang/gelap web: pilihan pengguna disimpan di localStorage; tanpa pilihan, ikut sistem.
// Skema aktif dipasang sebagai data-theme di <html> dan dibaca oleh token --mp-* di theme.css.
import type { ColorScheme } from '@markpiw/ui';

const KEY = 'markpiw.theme';

export interface ThemeEnv {
  readonly root: HTMLElement;
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly media: {
    readonly matches: boolean;
    addEventListener(type: 'change', listener: () => void): void;
  } | null;
}

export interface ThemeStore {
  get(): ColorScheme;
  set(next: ColorScheme): void;
  subscribe(listener: () => void): () => void;
}

function stored(env: ThemeEnv): ColorScheme | null {
  try {
    const value = env.storage?.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function createThemeStore(env: ThemeEnv): ThemeStore {
  const system = (): ColorScheme => (env.media?.matches ? 'dark' : 'light');
  let chosen = stored(env);
  let current = chosen ?? system();
  const listeners = new Set<() => void>();

  const apply = (next: ColorScheme) => {
    current = next;
    env.root.dataset.theme = next;
    listeners.forEach((fn) => fn());
  };

  env.root.dataset.theme = current;
  env.media?.addEventListener('change', () => {
    if (chosen === null) apply(system());
  });

  return {
    get: () => current,
    set(next) {
      chosen = next;
      try {
        env.storage?.setItem(KEY, next);
      } catch {
        // Penyimpanan diblokir (mode privat): pilihan tetap berlaku untuk sesi ini.
      }
      apply(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const theme = createThemeStore({
  root: document.documentElement,
  storage: browserStorage(),
  media: typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null,
});
