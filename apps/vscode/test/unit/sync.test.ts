// SPDX-License-Identifier: LicenseRef-Proprietary
import { EditorController } from '@markpiw/editor';
import { TextSelection } from 'prosemirror-state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeHost } from '../../../../packages/editor/test/fake-host';
import { applyChanges, parseWebviewMessage, type WebviewMessage } from '../../src/protocol';
import { WebviewSync } from '../../webview/sync';

afterEach(() => vi.useRealTimers());

function setup(text: string) {
  vi.useFakeTimers();
  const host = new FakeHost(text, 'host');
  const controller = new EditorController({ text, host });
  const sent: WebviewMessage[] = [];
  const sync = new WebviewSync(controller, (m) => sent.push(m), text, 1);
  const append = (s: string) => {
    const end = controller.state.doc.child(0).nodeSize - 1;
    controller.dispatch(
      controller.state.tr
        .setSelection(TextSelection.create(controller.state.doc, end))
        .insertText(s),
    );
  };
  return { controller, sent, sync, append };
}

describe('WebviewSync', () => {
  it('sends a minimal edit 200 ms after typing, based on the confirmed version', async () => {
    const { sent, append } = setup('halo\n');
    append('!');
    await vi.advanceTimersByTimeAsync(199);
    expect(sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([
      { type: 'edits', baseVersion: 1, changes: [{ from: 4, to: 4, insert: '!' }] },
    ]);
    expect(parseWebviewMessage(sent[0])).not.toBeNull();
  });

  it('vscode: rapid edits wait for confirmation and chain versions', async () => {
    const { sent, sync, append } = setup('a\n');
    append('1');
    await vi.advanceTimersByTimeAsync(200);
    append('2');
    await vi.advanceTimersByTimeAsync(200);
    append('3');
    await vi.advanceTimersByTimeAsync(200);
    expect(sent).toHaveLength(1);
    sync.onEditsApplied(2);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({
      type: 'edits',
      baseVersion: 2,
      changes: [{ from: 2, to: 2, insert: '23' }],
    });
    sync.onEditsApplied(3);
    let text = 'a\n';
    for (const m of sent) if (m.type === 'edits') text = applyChanges(text, m.changes);
    expect(text).toBe('a123\n');
  });

  it('external changes replace the document and reset the base', async () => {
    const { controller, sent, sync, append } = setup('a\n');
    sync.onExternalChange('undo result\n', 7);
    expect(controller.serialize()).toEqual({ ok: true, value: 'undo result\n' });
    append('!');
    await vi.advanceTimersByTimeAsync(200);
    expect(sent).toEqual([
      { type: 'edits', baseVersion: 7, changes: [{ from: 11, to: 11, insert: '!' }] },
    ]);
  });

  it('does not send anything when the guard fails', async () => {
    const { controller, sent } = setup('exa mple.com\n');
    controller.dispatch(controller.state.tr.delete(4, 5));
    controller.dispatch(
      controller.state.tr.addMark(4, 9, controller.state.schema.marks.em!.create()),
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(sent).toEqual([]);
    expect(controller.getSnapshot().readOnly?.reason).toBe('guard');
  });
});
