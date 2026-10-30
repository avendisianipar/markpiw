// SPDX-License-Identifier: MIT
import { type DirectoryLike, type FileLike, type FileSnapshot, NotFoundError } from './types';

type Tree = { [name: string]: string | Uint8Array | Tree };

let clock = 1_700_000_000_000;
const tick = () => ++clock;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class MemoryFile implements FileLike {
  readonly kind = 'file';
  private bytes: Uint8Array;
  private modified = tick();

  constructor(
    readonly name: string,
    content: string | Uint8Array,
  ) {
    this.bytes = typeof content === 'string' ? encoder.encode(content) : content;
  }

  async getFile(): Promise<FileSnapshot> {
    const bytes = this.bytes;
    const type = this.name.endsWith('.svg')
      ? 'image/svg+xml'
      : this.name.endsWith('.png')
        ? 'image/png'
        : '';
    return {
      lastModified: this.modified,
      size: bytes.byteLength,
      text: async () => decoder.decode(bytes),
      arrayBuffer: async () => bytes.slice().buffer,
      blob: () => new Blob([bytes.slice()], { type }),
    };
  }

  async write(data: string | Uint8Array): Promise<void> {
    this.bytes = typeof data === 'string' ? encoder.encode(data) : data;
    this.modified = tick();
  }
}

/** Folder di memori (mode demo dan test). */
export class MemoryDirectory implements DirectoryLike {
  readonly kind = 'directory';
  private readonly children = new Map<string, MemoryFile | MemoryDirectory>();

  constructor(readonly name: string) {}

  static from(tree: Tree, name = 'demo'): MemoryDirectory {
    const dir = new MemoryDirectory(name);
    for (const [key, value] of Object.entries(tree)) {
      if (typeof value === 'string' || value instanceof Uint8Array)
        dir.children.set(key, new MemoryFile(key, value));
      else dir.children.set(key, MemoryDirectory.from(value, key));
    }
    return dir;
  }

  async *entries(): AsyncIterable<FileLike | DirectoryLike> {
    yield* [...this.children.values()];
  }

  async getDirectory(name: string, options?: { create?: boolean }): Promise<DirectoryLike> {
    const found = this.children.get(name);
    if (found instanceof MemoryDirectory) return found;
    if (found || !options?.create) throw new NotFoundError(name);
    const dir = new MemoryDirectory(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFile(name: string, options?: { create?: boolean }): Promise<FileLike> {
    const found = this.children.get(name);
    if (found instanceof MemoryFile) return found;
    if (found || !options?.create) throw new NotFoundError(name);
    const file = new MemoryFile(name, '');
    this.children.set(name, file);
    return file;
  }
}

/** Baca teks file pada path (segmen) dari root. */
export async function readTextAt(root: DirectoryLike, path: readonly string[]): Promise<string> {
  let dir = root;
  for (const segment of path.slice(0, -1)) dir = await dir.getDirectory(segment);
  const file = await dir.getFile(path[path.length - 1] as string);
  return (await file.getFile()).text();
}
