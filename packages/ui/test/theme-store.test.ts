// SPDX-License-Identifier: LicenseRef-Proprietary
import { describe, expect, it } from 'vitest';
import { type ColorScheme, createThemeStore, type ThemeStoreOptions } from '../src';

function fakeSystem(initial: ColorScheme) {
  let scheme = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => scheme,
    subscribe: (fn: () => void) => void listeners.add(fn),
    change(next: ColorScheme) {
      scheme = next;
      listeners.forEach((fn) => fn());
    },
  };
}

function setup(
  overrides: Partial<Omit<ThemeStoreOptions, 'system'>> & { system?: ColorScheme } = {},
) {
  const system = fakeSystem(overrides.system ?? 'light');
  const saved: ColorScheme[] = [];
  const root = document.createElement('html');
  const store = createThemeStore({
    root,
    chosen: null,
    save: (next) => saved.push(next),
    ...overrides,
    system,
  });
  return { store, system, saved, root };
}

describe('createThemeStore', () => {
  it('follows the system scheme when nothing was chosen', () => {
    const { store, root } = setup({ system: 'dark' });
    expect(store.get()).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
  });

  it('a previous choice wins over the system scheme', () => {
    const { store, root } = setup({ system: 'dark', chosen: 'light' });
    expect(store.get()).toBe('light');
    expect(root.dataset.theme).toBe('light');
  });

  it('tracks system changes until the user picks a scheme', () => {
    const { store, system } = setup();
    system.change('dark');
    expect(store.get()).toBe('dark');
    store.set('light');
    system.change('dark');
    expect(store.get()).toBe('light');
  });

  it('set applies, saves and notifies', () => {
    const { store, saved, root } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    store.set('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(saved).toEqual(['dark']);
    expect(calls).toBe(1);
  });

  it('adopt applies a choice made elsewhere without saving it again', () => {
    const { store, saved, system } = setup();
    store.adopt('dark');
    expect(store.get()).toBe('dark');
    expect(saved).toEqual([]);
    system.change('light');
    expect(store.get()).toBe('dark');
  });

  it('never marks host colors unless asked to', () => {
    const { root } = setup();
    expect(root.hasAttribute('data-host-colors')).toBe(false);
  });

  it('keeps host colors while the scheme matches the host theme', () => {
    const { store, system, root } = setup({ hostColors: true });
    expect(root.hasAttribute('data-host-colors')).toBe(true);
    store.set('dark');
    expect(root.hasAttribute('data-host-colors')).toBe(false);
    system.change('dark');
    expect(root.hasAttribute('data-host-colors')).toBe(true);
    store.set('light');
    expect(root.hasAttribute('data-host-colors')).toBe(false);
  });
});
