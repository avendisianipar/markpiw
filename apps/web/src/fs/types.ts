// SPDX-License-Identifier: MIT
// Subset File System Access API yang dipakai markpiw; diimplementasikan oleh adapter FS Access
// asli (fs-access.ts) dan folder memori (memory.ts, untuk demo dan test).

export interface FileSnapshot {
  readonly lastModified: number;
  readonly size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Blob untuk URL objek (gambar). */
  blob(): Blob;
}

export interface FileLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<FileSnapshot>;
  write(data: string | Uint8Array): Promise<void>;
}

export interface DirectoryLike {
  readonly kind: 'directory';
  readonly name: string;
  entries(): AsyncIterable<FileLike | DirectoryLike>;
  getDirectory(name: string, options?: { create?: boolean }): Promise<DirectoryLike>;
  getFile(name: string, options?: { create?: boolean }): Promise<FileLike>;
}

export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}
