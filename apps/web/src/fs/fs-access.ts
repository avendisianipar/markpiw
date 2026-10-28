// SPDX-License-Identifier: LicenseRef-Proprietary
// Adapter File System Access API (Chromium) ke DirectoryLike.
import { type DirectoryLike, type FileLike, type FileSnapshot, NotFoundError } from './types';

function wrapError(error: unknown, name: string): never {
  if (error instanceof DOMException && error.name === 'NotFoundError')
    throw new NotFoundError(name);
  throw error;
}

class AccessFile implements FileLike {
  readonly kind = 'file';
  constructor(private readonly handle: FileSystemFileHandle) {}

  get name(): string {
    return this.handle.name;
  }

  async getFile(): Promise<FileSnapshot> {
    const file = await this.handle.getFile();
    return {
      lastModified: file.lastModified,
      size: file.size,
      text: () => file.text(),
      arrayBuffer: () => file.arrayBuffer(),
      blob: () => file,
    };
  }

  async write(data: string | Uint8Array): Promise<void> {
    const writable = await this.handle.createWritable();
    await writable.write(typeof data === 'string' ? data : new Blob([data.slice()]));
    await writable.close();
  }
}

export class AccessDirectory implements DirectoryLike {
  readonly kind = 'directory';
  constructor(readonly handle: FileSystemDirectoryHandle) {}

  get name(): string {
    return this.handle.name;
  }

  async *entries(): AsyncIterable<FileLike | DirectoryLike> {
    for await (const handle of this.handle.values()) {
      yield handle.kind === 'file'
        ? new AccessFile(handle as FileSystemFileHandle)
        : new AccessDirectory(handle as FileSystemDirectoryHandle);
    }
  }

  async getDirectory(name: string, options?: { create?: boolean }): Promise<DirectoryLike> {
    try {
      return new AccessDirectory(
        await this.handle.getDirectoryHandle(name, { create: options?.create ?? false }),
      );
    } catch (error) {
      return wrapError(error, name);
    }
  }

  async getFile(name: string, options?: { create?: boolean }): Promise<FileLike> {
    try {
      return new AccessFile(
        await this.handle.getFileHandle(name, { create: options?.create ?? false }),
      );
    } catch (error) {
      return wrapError(error, name);
    }
  }
}
