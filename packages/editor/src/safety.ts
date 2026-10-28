// SPDX-License-Identifier: LicenseRef-Proprietary
// Spesifikasi 4.5: link dan gambar hanya dibuka/dimuat dari skema yang aman.

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** `http:`, `https:`, `mailto:`, path relatif, atau `#anchor`. */
export function isSafeHref(href: string): boolean {
  const m = SCHEME.exec(href.trim());
  if (!m) return true;
  return ['http', 'https', 'mailto'].includes((m[1] as string).toLowerCase());
}

/** Path relatif, `https:`, atau `blob:`. */
export function isSafeImageSrc(src: string): boolean {
  const value = src.trim();
  if (value === '') return false;
  const m = SCHEME.exec(value);
  if (!m) return !value.startsWith('//');
  return ['https', 'blob'].includes((m[1] as string).toLowerCase());
}

/** Path relatif (bukan URL absolut, bukan protocol-relative, bukan anchor). */
export function isRelativePath(target: string): boolean {
  return !SCHEME.test(target) && !target.startsWith('//') && !target.startsWith('#');
}
