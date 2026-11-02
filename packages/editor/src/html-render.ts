// SPDX-License-Identifier: MIT
// Render HTML dokumen yang aman tanpa memasukkannya ke DOM sebagai HTML: source di-parse ke
// dokumen inert (DOMParser), lalu hanya teks dan tag inline dari daftar izin yang dibuat ulang
// lewat createElement. Atribut tidak pernah disalin.

type Align = 'left' | 'center' | 'right';

/** Tag inline yang dibuat ulang apa adanya (tanpa atribut). */
const SAFE_INLINE = new Set(['STRONG', 'B', 'EM', 'I', 'CODE', 'DEL', 'S', 'KBD', 'SUB', 'SUP']);
/** Tag inline yang boleh muncul di blok HTML yang dirender (`<a>` tampil tanpa href). */
const BLOCK_INLINE = new Set([...SAFE_INLINE, 'BR', 'A']);
const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const CLOSES_BLOCK = /<\/(p|div|h[1-6])\s*>$/i;
const ALIGN = /^(left|center|right)$/i;

function parseBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

/**
 * Salin teks dan tag inline aman dari `from` ke `to`. Tag lain dibuang (isinya tetap disalin);
 * dengan `strict`, fungsi mengembalikan false begitu ada tag di luar daftar izin.
 */
function copyInline(
  from: globalThis.Node,
  to: HTMLElement,
  allowed: Set<string>,
  strict: boolean,
): boolean {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === 3) to.append(child.textContent ?? '');
    else if (child.nodeType === 1) {
      const tag = (child as Element).tagName;
      if (!allowed.has(tag) && strict) return false;
      const target = allowed.has(tag) ? document.createElement(tag.toLowerCase()) : to;
      if (!copyInline(child, target, allowed, strict)) return false;
      if (target !== to) to.append(target);
    }
  }
  return true;
}

/** Isi `<summary>`: teks dan tag inline aman; tag lain dibuang, isinya tetap. */
export function renderSummary(html: string, into: HTMLElement): void {
  copyInline(parseBody(html), into, SAFE_INLINE, false);
}

export interface HtmlBlock {
  tag: string;
  align: Align | null;
}

/**
 * Blok HTML lengkap seperti `<p align="center"><em>Teks</em></p>` yang bisa dirender seperti
 * GitHub, atau null jika source berisi hal lain (tag pembuka saja, beberapa blok, gambar, dsb.).
 */
export function renderHtmlBlock(source: string): { block: HtmlBlock; dom: HTMLElement } | null {
  const text = source.trim();
  if (!CLOSES_BLOCK.test(text)) return null;
  const body = parseBody(text);
  const elements = Array.from(body.children);
  if (elements.length !== 1) return null;
  const outer = elements[0] as Element;
  if (!BLOCK_TAGS.has(outer.tagName)) return null;
  // Teks di luar elemen (mis. `x<p>..</p>`) berarti bukan satu blok utuh.
  if (Array.from(body.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()))
    return null;
  const tag = outer.tagName.toLowerCase();
  const alignAttr = outer.getAttribute('align') ?? '';
  const align = ALIGN.test(alignAttr) ? (alignAttr.toLowerCase() as Align) : null;
  const dom = document.createElement(tag);
  if (align) dom.className = `mp-html-align-${align}`;
  if (!copyInline(outer, dom, BLOCK_INLINE, true)) return null;
  if ((dom.textContent ?? '').trim() === '') return null;
  return { block: { tag, align }, dom };
}
