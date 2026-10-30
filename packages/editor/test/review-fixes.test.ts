// SPDX-License-Identifier: MIT
// Regresi dari review akhir Fase 2–4.
import { describe, expect, it } from 'vitest';
import { EditorController } from '../src';
import { FakeHost } from './fake-host';
import { strings } from './strings';
import { cursorAt, press, setup } from './util';

describe('host history mode keyboard', () => {
  it('Mod-Z is swallowed but not forwarded (VS Code already runs its own undo for the key)', () => {
    const { view, host } = setup('a\n', 'host');
    expect(press(view, 'Mod-z')).toBe(true);
    expect(press(view, 'Mod-Shift-z')).toBe(true);
    expect(press(view, 'Mod-y')).toBe(true);
    expect([host.undos, host.redos]).toEqual([0, 0]);
  });
});

describe('pending image uploads', () => {
  it('reports pending uploads until the asset is saved', async () => {
    let finish: (value: { ok: true; value: string }) => void = () => {};
    const host = new FakeHost('a\n');
    host.saveAsset = () => new Promise((resolve) => (finish = resolve));
    const { c } = setupWith(host);
    cursorAt(c, 'a');
    const done = c.commands.insertImageFile(
      new File([new Uint8Array([1])], 'x.png', { type: 'image/png' }),
    );
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(c.pendingUploads).toBe(1);
    finish({ ok: true, value: './assets/x.png' });
    await done;
    expect(c.pendingUploads).toBe(0);
  });
});

describe('links in read-only mode', () => {
  it('plain clicks on links never navigate', () => {
    const { c, el } = setup('[x](javascript:alert(1)) [y](https://x.io)\n');
    c.setReadOnly({ reason: 'host', message: 'ro' });
    for (const a of el.querySelectorAll('a')) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      a.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });
});

function setupWith(host: FakeHost) {
  const c = new EditorController({ text: host.text, host, strings });
  const el = document.createElement('div');
  document.body.append(el);
  c.mount(el);
  return { c, el, host };
}
