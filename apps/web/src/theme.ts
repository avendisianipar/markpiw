// SPDX-License-Identifier: MIT
// Tema web: "sistem" = prefers-color-scheme OS, pilihan pengguna disimpan di localStorage.
import { createThemeStore, type ColorScheme, type ThemeStore } from '@markpiw/ui';

const KEY = 'markpiw.theme';

export interface ThemeEnv {
  readonly root: HTMLElement;
  readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly media: {
    readonly matches: boolean;
    addEventListener(type: 'change', listener: () => void): void;
  } | null;
}

function stored(env: ThemeEnv): ColorScheme | null {
  try {
    const value = env.storage?.getItem(KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function createWebThemeStore(env: ThemeEnv): ThemeStore {
  return createThemeStore({
    root: env.root,
    chosen: stored(env),
    system: {
      get: () => (env.media?.matches ? 'dark' : 'light'),
      subscribe: (listener) => env.media?.addEventListener('change', listener),
    },
    save(next) {
      try {
        env.storage?.setItem(KEY, next);
      } catch {
        // Penyimpanan diblokir (mode privat): pilihan tetap berlaku untuk sesi ini.
      }
    },
  });
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const theme = createWebThemeStore({
  root: document.documentElement,
  storage: browserStorage(),
  media: typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null,
});
