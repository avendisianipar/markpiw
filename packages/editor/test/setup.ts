// SPDX-License-Identifier: MIT
// jsdom tidak punya layout; ProseMirror memanggil API geometri saat scroll/fokus.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
for (const proto of [Element.prototype, Range.prototype]) {
  Object.assign(proto, { getClientRects: emptyRects, getBoundingClientRect: zeroRect });
}
document.elementFromPoint = () => null;

// jsdom tidak punya ClipboardEvent (dipakai EditorView.pasteHTML/pasteText).
if (typeof globalThis.ClipboardEvent === 'undefined') {
  class ClipboardEventPolyfill extends Event {
    readonly clipboardData: DataTransfer | null = null;
  }
  Object.assign(globalThis, { ClipboardEvent: ClipboardEventPolyfill });
}
