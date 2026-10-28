// SPDX-License-Identifier: LicenseRef-Proprietary
// jsdom tidak punya layout; ProseMirror memanggil API geometri saat scroll/fokus.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
for (const proto of [Element.prototype, Range.prototype]) {
  Object.assign(proto, { getClientRects: emptyRects, getBoundingClientRect: zeroRect });
}
document.elementFromPoint = () => null;
