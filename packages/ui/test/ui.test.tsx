// SPDX-License-Identifier: LicenseRef-Proprietary
import { EditorController } from '@markpiw/editor';
import { TextSelection } from 'prosemirror-state';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeHost } from '../../editor/test/fake-host';
import { type } from '../../editor/test/util';
import { MarkpiwEditor, type MarkpiwEditorProps, editorStrings } from '../src';

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = '';
});

function render(text: string, extra: Partial<MarkpiwEditorProps> = {}) {
  const host = new FakeHost(text);
  const controller = new EditorController({ text, host, strings: editorStrings });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    (root as Root).render(
      <StrictMode>
        <MarkpiwEditor
          controller={controller}
          fallbackText={() => text}
          recoveryActions={[{ label: 'Urungkan', onPress: () => controller.clearReadOnly() }]}
          colorScheme="light"
          onColorSchemeChange={() => {}}
          {...extra}
        />
      </StrictMode>,
    ),
  );
  return { controller, host, container };
}

function selectText(controller: EditorController, needle: string) {
  let from = -1;
  controller.state.doc.descendants((node, pos) => {
    if (from === -1 && node.isText && node.text?.includes(needle))
      from = pos + node.text.indexOf(needle);
  });
  act(() =>
    controller.dispatch(
      controller.state.tr.setSelection(
        TextSelection.create(controller.state.doc, from, from + needle.length),
      ),
    ),
  );
}

const button = (label: string) => document.querySelector(`[aria-label="${label}"]`) as HTMLElement;

describe('MarkpiwEditor', () => {
  it('mounts exactly one editor under StrictMode', () => {
    const { container } = render('# Halo\n');
    expect(container.querySelectorAll('.ProseMirror')).toHaveLength(1);
    expect(container.querySelector('h1')?.textContent).toBe('Halo');
  });

  it('Bold button toggles the mark and reflects aria-pressed', () => {
    const { controller } = render('halo dunia\n');
    selectText(controller, 'dunia');
    expect(button('Tebal').getAttribute('aria-pressed')).toBe('false');
    act(() => button('Tebal').click());
    expect(controller.serialize()).toEqual({ ok: true, value: 'halo **dunia**\n' });
    expect(button('Tebal').getAttribute('aria-pressed')).toBe('true');
  });

  it('shows the slash menu as a listbox while the editor keeps focus', () => {
    const { controller } = render('');
    act(() => {
      controller.dispatch(
        controller.state.tr.setSelection(TextSelection.create(controller.state.doc, 1)),
      );
      type(controller.editorView!, '/');
    });
    const options = document.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(12);
    expect(controller.editorView?.dom.getAttribute('aria-activedescendant')).toBe('mp-slash-text');
  });

  it('shows a read-only banner with recovery actions when the guard fails', () => {
    const { controller } = render('exa mple.com\n');
    act(() => controller.dispatch(controller.state.tr.delete(4, 5)));
    selectText(controller, 'mple.');
    act(() => {
      controller.commands.toggleMark('em');
      controller.serialize();
    });
    const banner = document.querySelector('[role="alert"]');
    expect(banner?.textContent).toContain('tidak bisa disimpan');
    act(() => (document.querySelector('.mp-banner .mp-button') as HTMLElement).click());
    expect(document.querySelector('.mp-banner')).toBeNull();
  });

  it('zoom buttons change the zoom percentage', () => {
    const { controller } = render('a\n');
    act(() => button('Perbesar').click());
    expect(controller.getSnapshot().zoom).toBe(110);
    expect(document.querySelector('.mp-zoom')?.textContent).toBe('110%');
  });

  it('theme toggle reflects the scheme and asks the host to switch', () => {
    const requested: string[] = [];
    render('a\n', { colorScheme: 'light', onColorSchemeChange: (next) => requested.push(next) });
    expect(button('Mode gelap').getAttribute('aria-pressed')).toBe('false');
    act(() => button('Mode gelap').click());
    expect(requested).toEqual(['dark']);
  });

  it('theme toggle switches back to light from dark', () => {
    const requested: string[] = [];
    render('a\n', { colorScheme: 'dark', onColorSchemeChange: (next) => requested.push(next) });
    expect(button('Mode gelap').getAttribute('aria-pressed')).toBe('true');
    act(() => button('Mode gelap').click());
    expect(requested).toEqual(['light']);
  });
});

describe('Outline', () => {
  const outline = () => document.querySelector('nav[aria-label="Daftar isi"]');
  const items = () =>
    [...document.querySelectorAll<HTMLButtonElement>('.mp-outline-item')].map((b) => ({
      text: b.textContent,
      level: b.dataset.level,
    }));

  it('lists the headings with their level and marks one as current', () => {
    render('# Judul\n\nIsi.\n\n## Bagian\n\n### Sub\n');
    expect(outline()).not.toBeNull();
    expect(items()).toEqual([
      { text: 'Judul', level: '1' },
      { text: 'Bagian', level: '2' },
      { text: 'Sub', level: '3' },
    ]);
    expect(document.querySelectorAll('.mp-outline-rail-line')).toHaveLength(3);
    expect(document.querySelectorAll('.mp-outline-item[aria-current="location"]')).toHaveLength(1);
    expect(document.querySelectorAll('.mp-outline-rail-line[data-active]')).toHaveLength(1);
  });

  it('moves the cursor to the clicked heading', () => {
    const { controller } = render('# Judul\n\nIsi.\n\n## Bagian\n');
    const target = [...document.querySelectorAll<HTMLElement>('.mp-outline-item')][1];
    act(() => target?.click());
    expect(controller.state.selection.$from.parent.textContent).toBe('Bagian');
  });

  it('follows document edits and hides without headings', () => {
    const { controller } = render('Hanya paragraf.\n');
    expect(outline()).toBeNull();
    act(() => controller.applyExternalText('# Baru\n'));
    expect(items()).toEqual([{ text: 'Baru', level: '1' }]);
  });

  it('tracks the scrolled heading and selects the last one at the bottom', async () => {
    const { container } = render('# Satu\n\n## Dua\n\n## Tiga\n');
    const canvas = container.querySelector('.mp-canvas') as HTMLElement;
    const headings = [...container.querySelectorAll<HTMLElement>('h1, h2')];
    let scrollTop = 0;
    // Layout palsu: heading berjarak 400px, canvas setinggi 500px dengan konten 1200px.
    headings.forEach((h, i) => {
      h.getBoundingClientRect = () => new DOMRect(0, 100 + i * 400 - scrollTop, 100, 30);
    });
    Object.defineProperty(canvas, 'clientHeight', { value: 500 });
    Object.defineProperty(canvas, 'scrollHeight', { value: 1200 });
    Object.defineProperty(canvas, 'scrollTop', { get: () => scrollTop });
    const scrollTo = async (top: number) => {
      scrollTop = top;
      await act(async () => {
        canvas.dispatchEvent(new Event('scroll'));
        await new Promise((resolve) => requestAnimationFrame(resolve));
      });
    };
    const current = () =>
      document.querySelector('.mp-outline-item[aria-current="location"]')?.textContent;

    await scrollTo(0);
    expect(current()).toBe('Satu');
    await scrollTo(450);
    expect(current()).toBe('Dua');
    // Di dasar canvas "Tiga" belum melewati atas, tetapi tetap dianggap aktif.
    await scrollTo(700);
    expect(current()).toBe('Tiga');
  });
});
