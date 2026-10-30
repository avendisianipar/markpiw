// SPDX-License-Identifier: MIT
// Aturan nama aset yang sama dengan web: image-<8 hex SHA-256>.<ext>.
import { createHash } from 'node:crypto';

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export function assetName(bytes: Uint8Array, mime: string): string | null {
  const ext = EXT[mime];
  if (!ext) return null;
  return `image-${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}.${ext}`;
}

/** Folder aset harus relatif dan tidak keluar dari folder dokumen. */
export function safeAssetsFolder(folder: string): string {
  const parts = folder.split(/[\\/]/).filter((p) => p !== '' && p !== '.');
  if (parts.length === 0 || parts.some((p) => p === '..')) return 'assets';
  return parts.join('/');
}
