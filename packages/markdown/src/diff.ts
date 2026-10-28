// SPDX-License-Identifier: LicenseRef-Proprietary
import type { TextChange } from '@markpiw/host';

const isHigh = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

/**
 * Perubahan minimal dari `oldText` ke `newText`: prefix dan suffix bersama dipangkas, sisanya
 * satu `TextChange`. Batas tidak pernah membelah surrogate pair.
 */
export function diffText(oldText: string, newText: string): TextChange[] {
  if (oldText === newText) return [];
  const max = Math.min(oldText.length, newText.length);
  let prefix = 0;
  while (prefix < max && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++;
  if (prefix > 0 && isHigh(oldText.charCodeAt(prefix - 1))) prefix--;

  let suffix = 0;
  while (
    suffix < max - prefix &&
    oldText.charCodeAt(oldText.length - 1 - suffix) ===
      newText.charCodeAt(newText.length - 1 - suffix)
  ) {
    suffix++;
  }
  if (suffix > 0 && isLow(oldText.charCodeAt(oldText.length - suffix))) suffix--;

  return [
    {
      from: prefix,
      to: oldText.length - suffix,
      insert: newText.slice(prefix, newText.length - suffix),
    },
  ];
}
