// SPDX-License-Identifier: LicenseRef-Proprietary
import { EditorController } from '@markpiw/editor';
import { TextSelection } from 'prosemirror-state';
import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeHost } from '../../editor/test/fake-host';
import { type } from '../../editor/test/util';
import { MarkpiwEditor, editorStrings } from '../src';

let root: Root | null = null;
let container: HTMLElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = '';
});

function render(text: string) {
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
});
