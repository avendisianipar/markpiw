// SPDX-License-Identifier: MIT
import { afterEach, describe, expect, it } from 'vitest';
import { traceKey } from '../src/plugins/trace';
import { cursorAt, setup } from './util';

afterEach(() => {
  document.body.innerHTML = '';
});

const md = (c: { serialize(): { ok: boolean; value?: string } }) => {
  const out = c.serialize();
  if (!out.ok) throw new Error('guard');
  return out.value;
};

const TEXT =
  '# Tasks\n\n### T1 — Schema\n\n**Requirements:** FR-1, FR-10 dan bukan FR-100x.\n\n```\nT1 → FR-1\n```\n\n### T2 — UI\n\nSetelah `T1`.\n';

describe('trace chips', () => {
  it('decorates known IDs only, outside code blocks, marking heading definitions', () => {
    const { c, el } = setup(TEXT);
    c.setTraceIds(new Set(['FR-1', 'FR-10', 'T1', 'T2']));
    const chips = [...el.querySelectorAll('[data-trace-id]')].map((n) => [
      n.getAttribute('data-trace-id'),
      n.classList.contains('mp-trace-def'),
    ]);
    expect(chips).toEqual([
      ['T1', true],
      ['FR-1', false],
      ['FR-10', false],
      ['T2', true],
      ['T1', false],
    ]);
  });

  it('never changes the markdown, dirty flag or undo history', () => {
    const { c } = setup(TEXT);
    c.setTraceIds(new Set(['FR-1', 'T1']));
    expect(md(c)).toBe(TEXT);
    expect(c.getSnapshot().dirty).toBe(false);
    expect(c.getSnapshot().canUndo).toBe(false);
  });

  it('follows document edits and an updated ID set', () => {
    const { c, el } = setup('Lihat FR-1.\n');
    c.setTraceIds(new Set(['FR-1']));
    expect(el.querySelectorAll('[data-trace-id]').length).toBe(1);
    c.applyExternalText('Lihat FR-1 dan FR-2.\n');
    expect(el.querySelectorAll('[data-trace-id]').length).toBe(1);
    c.setTraceIds(new Set(['FR-1', 'FR-2']));
    expect(el.querySelectorAll('[data-trace-id]').length).toBe(2);
    c.setTraceIds(new Set());
    expect(el.querySelectorAll('[data-trace-id]').length).toBe(0);
  });

  it('activates a chip on Mod+click only', () => {
    const { c, el } = setup('Lihat FR-1.\n');
    c.setTraceIds(new Set(['FR-1']));
    const got: string[] = [];
    c.onTraceActivate((id) => got.push(id));
    const chip = el.querySelector('[data-trace-id]') as HTMLElement;
    const view = c.editorView;
    const plugin = view && traceKey.get(view.state);
    const click = plugin?.props.handleClick;
    if (!view || !click) throw new Error('plugin');
    const event = (meta: boolean) => ({ metaKey: meta, ctrlKey: false, target: chip }) as never;
    expect(click.call(plugin, view, 7, event(false))).toBe(false);
    expect(click.call(plugin, view, 7, event(true))).toBe(true);
    expect(got).toEqual(['FR-1']);
  });
});

describe('section and reveal', () => {
  it('reports the heading that contains the cursor', () => {
    const { c } = setup('Pembuka\n\n# A\n\nisi a\n\n## B\n\nisi b\n');
    cursorAt(c, 'Pembuka');
    expect(c.getSnapshot().section).toBeNull();
    cursorAt(c, 'isi a');
    expect(c.getSnapshot().section).toBe(0);
    cursorAt(c, 'isi b');
    expect(c.getSnapshot().section).toBe(1);
    cursorAt(c, 'B');
    expect(c.getSnapshot().section).toBe(1);
  });

  it('reveals headings by GitHub slug or outline index', () => {
    const { c } = setup('# A\n\n### T1 — Schema: x\n\nisi\n\n## A\n\nlagi\n');
    expect(c.revealHeading('t1--schema-x')).toBe(true);
    expect(c.getSnapshot().section).toBe(1);
    expect(c.revealHeading('a-1')).toBe(true);
    expect(c.getSnapshot().section).toBe(2);
    expect(c.revealHeading(0)).toBe(true);
    expect(c.getSnapshot().section).toBe(0);
    expect(c.revealHeading('tidak-ada')).toBe(false);
  });

  it('handles same-document #anchors in the editor instead of the host', () => {
    const { c, host } = setup('# Satu\n\nisi\n\n## Dua Tiga\n\nisi\n');
    c.commands.openLink('#dua-tiga');
    expect(c.getSnapshot().section).toBe(1);
    expect(host.opened).toEqual([]);
    c.commands.openLink('#tidak-ada');
    c.commands.openLink('design.md#api');
    expect(host.opened).toEqual(['#tidak-ada', 'design.md#api']);
  });
});
