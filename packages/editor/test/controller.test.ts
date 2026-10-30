// SPDX-License-Identifier: MIT
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorController } from '../src';
import { FakeHost } from './fake-host';
import { strings } from './strings';

let mounted: HTMLElement[] = [];
afterEach(() => {
  mounted.forEach((el) => el.remove());
  mounted = [];
});

function setup(text: string, mode: 'editor' | 'host' = 'editor') {
  const host = new FakeHost(text, mode);
  const c = new EditorController({ text, host, strings });
  const el = document.createElement('div');
  document.body.append(el);
  mounted.push(el);
  c.mount(el);
  return { c, host, el };
}

/** Pilih teks `needle` di dokumen. */
function select(c: EditorController, needle: string) {
  let from = -1;
  c.state.doc.descendants((node, pos) => {
    if (from === -1 && node.isText && node.text?.includes(needle)) {
      from = pos + node.text.indexOf(needle);
    }
  });
  c.dispatch(
    c.state.tr.setSelection(TextSelection.create(c.state.doc, from, from + needle.length)),
  );
}

describe('EditorController', () => {
  it('mounts a contenteditable view with the parsed document', () => {
    const { el } = setup('# Judul\n\nIsi.\n');
    expect(el.querySelector('h1')?.textContent).toBe('Judul');
    expect(el.querySelector('[contenteditable="true"]')).not.toBeNull();
  });

  it('survives StrictMode double mount without duplicating the DOM', () => {
    const { c, el } = setup('a\n');
    c.unmount();
    c.mount(el);
    expect(el.querySelectorAll('.ProseMirror')).toHaveLength(1);
  });

  it('toggles marks and reports them in the snapshot', () => {
    const { c } = setup('hello world\n');
    select(c, 'world');
    c.commands.toggleMark('strong');
    expect(c.getSnapshot().activeMarks.has('strong')).toBe(true);
    expect(c.serialize()).toEqual({ ok: true, value: 'hello **world**\n' });
  });

  it('sets block types, lists, quote, table and hr', () => {
    const { c } = setup('a\n');
    select(c, 'a');
    c.commands.setBlock({ type: 'heading', level: 2 });
    expect(c.getSnapshot().blockType).toEqual({ type: 'heading', level: 2 });
    c.commands.setBlock({ type: 'paragraph' });
    c.commands.wrapList('task');
    expect(c.getSnapshot().listKind).toBe('task');
    expect(c.serialize()).toEqual({ ok: true, value: '- [ ] a\n' });
    c.commands.wrapList('ordered');
    expect(c.serialize()).toEqual({ ok: true, value: '1. a\n' });
    c.commands.wrapList('ordered');
    expect(c.getSnapshot().listKind).toBeNull();
    c.commands.toggleQuote();
    expect(c.getSnapshot().inQuote).toBe(true);
    expect(c.serialize()).toEqual({ ok: true, value: '> a\n' });
  });

  it('inserts a table and a horizontal rule', () => {
    const { c } = setup('a\n');
    select(c, 'a');
    c.commands.insertTable(2, 2);
    expect(c.getSnapshot().inTable).toBe(true);
    const out = c.serialize();
    expect(out.ok && out.value).toBe('a\n\n|  |  |\n| --- | --- |\n|  |  |\n');
  });

  it('undo and redo in editor history mode', () => {
    const { c } = setup('hello\n');
    select(c, 'hello');
    c.commands.toggleMark('em');
    expect(c.getSnapshot().canUndo).toBe(true);
    c.commands.undo();
    expect(c.serialize()).toEqual({ ok: true, value: 'hello\n' });
    c.commands.redo();
    expect(c.serialize()).toEqual({ ok: true, value: '*hello*\n' });
  });

  it('forwards undo to the host in host history mode', () => {
    const { c, host } = setup('hello\n', 'host');
    c.commands.undo();
    c.commands.redo();
    expect([host.undos, host.redos]).toEqual([1, 1]);
  });

  it('notifies doc changes and tracks dirty state', () => {
    const { c } = setup('hello\n');
    let changes = 0;
    c.onDocChange(() => changes++);
    select(c, 'hello');
    c.commands.toggleMark('strong');
    expect(changes).toBe(1);
    expect(c.getSnapshot().dirty).toBe(true);
    c.markSaved();
    expect(c.getSnapshot().dirty).toBe(false);
  });

  it('snapshot reference only changes when content changes', () => {
    const { c } = setup('hello\n');
    const a = c.getSnapshot();
    c.dispatch(c.state.tr.setMeta('noop', true));
    expect(c.getSnapshot()).toBe(a);
  });

  it('controller: guard failure blocks save and sets readOnly', () => {
    const { c } = setup('exa mple.com\n');
    // em pada "mple." tepat sebelum huruf tidak bisa ditulis sebagai markdown.
    c.dispatch(c.state.tr.delete(4, 5));
    select(c, 'mple.');
    c.commands.toggleMark('em');
    const r = c.serialize();
    expect(r.ok).toBe(false);
    expect(c.getSnapshot().readOnly?.reason).toBe('guard');
    c.clearReadOnly();
    expect(c.getSnapshot().readOnly).toBeNull();
  });

  it('zoom is clamped to 50–200 in steps of 10', () => {
    const { c } = setup('a\n');
    c.commands.setZoom(250);
    expect(c.getSnapshot().zoom).toBe(200);
    c.commands.setZoom(43);
    expect(c.getSnapshot().zoom).toBe(50);
  });
});
