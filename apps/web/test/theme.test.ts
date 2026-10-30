// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { createThemeStore, type ThemeEnv } from '../src/theme';

function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches,
    addEventListener: (_: 'change', fn: () => void) => listeners.add(fn),
    removeEventListener: (_: 'change', fn: () => void) => listeners.delete(fn),
    flip(next: boolean) {
      this.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

function env(overrides: Partial<ThemeEnv> = {}): ThemeEnv {
  return {
    root: document.createElement('html'),
    storage: fakeStorage(),
    media: fakeMedia(false),
    ...overrides,
  };
}

describe('theme store', () => {
  it('follows the system preference when nothing is stored', () => {
    const e = env({ media: fakeMedia(true) });
    const store = createThemeStore(e);
    expect(store.get()).toBe('dark');
    expect(e.root.dataset.theme).toBe('dark');
  });

  it('prefers the stored choice over the system preference', () => {
    const e = env({ media: fakeMedia(true), storage: fakeStorage({ 'markpiw.theme': 'light' }) });
    expect(createThemeStore(e).get()).toBe('light');
    expect(e.root.dataset.theme).toBe('light');
  });

  it('set applies, persists and notifies', () => {
    const storage = fakeStorage();
    const e = env({ storage });
    const store = createThemeStore(e);
    let calls = 0;
    store.subscribe(() => calls++);
    store.set('dark');
    expect(store.get()).toBe('dark');
    expect(e.root.dataset.theme).toBe('dark');
    expect(storage.data.get('markpiw.theme')).toBe('dark');
    expect(calls).toBe(1);
  });

  it('tracks system changes until the user picks a theme', () => {
    const media = fakeMedia(false);
    const store = createThemeStore(env({ media }));
    media.flip(true);
    expect(store.get()).toBe('dark');
    store.set('light');
    media.flip(true);
    expect(store.get()).toBe('light');
  });

  it('ignores invalid stored values', () => {
    const store = createThemeStore(env({ storage: fakeStorage({ 'markpiw.theme': 'blue' }) }));
    expect(store.get()).toBe('light');
  });

  it('keeps working when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createThemeStore(env({ storage: broken, media: null }));
    expect(store.get()).toBe('light');
    store.set('dark');
    expect(store.get()).toBe('dark');
  });
});
