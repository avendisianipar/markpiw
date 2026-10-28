// SPDX-License-Identifier: LicenseRef-Proprietary
// FileHost untuk web (spesifikasi 6): satu file .md di dalam folder yang dibuka.
import type { Disposable, FileHost, HostError, Result, UiState } from '@markpiw/host';
import { type DirectoryLike, type FileLike, NotFoundError } from '../fs/types';

export interface WebHostOptions {
  /** Buka file .md lain di dalam folder (path segmen dari root). */
  onOpenFile(path: string[]): void;
}

interface DiskMeta {
  readonly lastModified: number;
  readonly size: number;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const err = (code: HostError['code'], message: string): { ok: false; error: HostError } => ({
  ok: false,
  error: { code, message },
});

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toDataUrl(bytes: Uint8Array, type: string): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:${type};base64,${btoa(binary)}`;
}

/** Resolve path relatif terhadap folder `base` (segmen dari root); null jika keluar dari root. */
export function resolveRelative(base: readonly string[], target: string): string[] | null {
  const clean = decodeURIComponent(target.split(/[?#]/)[0] ?? '');
  if (clean === '' || clean.startsWith('/')) return null;
  const out = [...base];
  for (const segment of clean.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(segment);
    }
  }
  return out;
}

async function walk(root: DirectoryLike, segments: readonly string[]): Promise<DirectoryLike> {
  let dir = root;
  for (const segment of segments) dir = await dir.getDirectory(segment);
  return dir;
}

export class WebFileHost implements FileHost {
  readonly historyMode = 'editor' as const;
  private meta: DiskMeta | null = null;
  private readonly urls = new Map<string, Promise<string | null>>();
  private readonly created: string[] = [];

  private constructor(
    private readonly root: DirectoryLike,
    readonly path: readonly string[],
    private readonly dir: DirectoryLike,
    private readonly file: FileLike,
    private readonly options: WebHostOptions,
  ) {}

  static async open(
    root: DirectoryLike,
    path: readonly string[],
    options: WebHostOptions,
  ): Promise<WebFileHost> {
    const dir = await walk(root, path.slice(0, -1));
    const file = await dir.getFile(path[path.length - 1] as string);
    const host = new WebFileHost(root, path, dir, file, options);
    host.meta = await host.diskMeta();
    return host;
  }

  private get dirPath(): string[] {
    return this.path.slice(0, -1);
  }

  async readText(): Promise<Result<string, HostError>> {
    try {
      const snapshot = await this.file.getFile();
      this.meta = { lastModified: snapshot.lastModified, size: snapshot.size };
      return { ok: true, value: await snapshot.text() };
    } catch (error) {
      return this.failure(error);
    }
  }

  /** Metadata file di disk saat ini (untuk deteksi perubahan dari luar). */
  async diskMeta(): Promise<DiskMeta> {
    const snapshot = await this.file.getFile();
    return { lastModified: snapshot.lastModified, size: snapshot.size };
  }

  changedOnDisk(meta: DiskMeta): boolean {
    return (
      this.meta !== null &&
      (meta.lastModified !== this.meta.lastModified || meta.size !== this.meta.size)
    );
  }

  async writeText(text: string, options?: { force?: boolean }): Promise<Result<void, HostError>> {
    try {
      if (!options?.force && this.changedOnDisk(await this.diskMeta())) {
        return err('conflict', 'File berubah di disk sejak terakhir dibaca.');
      }
      await this.file.write(text);
      this.meta = await this.diskMeta();
      return { ok: true, value: undefined };
    } catch (error) {
      return this.failure(error);
    }
  }

  onExternalChange(): Disposable {
    // Perubahan dari luar diperiksa FileSession (fokus jendela + polling 5 dtk).
    return { dispose() {} };
  }

  async saveAsset(bytes: Uint8Array, mime: string): Promise<Result<string, HostError>> {
    const ext = EXT[mime];
    if (!ext) return err('invalid-path', `Tipe gambar tidak didukung: ${mime}`);
    try {
      const name = `image-${(await sha256Hex(bytes)).slice(0, 8)}.${ext}`;
      const assets = await this.dir.getDirectory('assets', { create: true });
      try {
        await assets.getFile(name);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        await (await assets.getFile(name, { create: true })).write(bytes);
      }
      return { ok: true, value: `./assets/${name}` };
    } catch (error) {
      return this.failure(error);
    }
  }

  resolveImageUrl(relativePath: string): Promise<string | null> {
    if (/^(https:|blob:)/i.test(relativePath)) return Promise.resolve(relativePath);
    let cached = this.urls.get(relativePath);
    if (!cached) {
      cached = this.loadImage(relativePath);
      this.urls.set(relativePath, cached);
    }
    return cached;
  }

  private async loadImage(relativePath: string): Promise<string | null> {
    const target = resolveRelative(this.dirPath, relativePath);
    if (!target || target.length === 0) return null;
    try {
      const dir = await walk(this.root, target.slice(0, -1));
      const snapshot = await (await dir.getFile(target[target.length - 1] as string)).getFile();
      if (typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(snapshot.blob());
        this.created.push(url);
        return url;
      }
      return toDataUrl(
        new Uint8Array(await snapshot.arrayBuffer()),
        snapshot.blob().type || 'image/png',
      );
    } catch {
      return null;
    }
  }

  openLink(target: string): void {
    if (/^(https?:|mailto:)/i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    if (target.startsWith('#')) return;
    const resolved = resolveRelative(this.dirPath, target);
    if (resolved && /\.(md|markdown)$/i.test(resolved[resolved.length - 1] ?? '')) {
      this.options.onOpenFile(resolved);
    }
  }

  private get uiKey(): string {
    return `markpiw:ui:${this.root.name}/${this.path.join('/')}`;
  }

  persistUiState(state: UiState): void {
    try {
      localStorage.setItem(this.uiKey, JSON.stringify(state));
    } catch {
      // localStorage bisa penuh atau dinonaktifkan; state UI tidak kritis.
    }
  }

  restoreUiState(): UiState | null {
    try {
      const raw = localStorage.getItem(this.uiKey);
      return raw ? (JSON.parse(raw) as UiState) : null;
    } catch {
      return null;
    }
  }

  /** Lepas URL objek gambar (dipanggil saat pindah file). */
  dispose(): void {
    for (const url of this.created) URL.revokeObjectURL(url);
    this.created.length = 0;
    this.urls.clear();
  }

  private failure(error: unknown): { ok: false; error: HostError } {
    if (error instanceof NotFoundError) return err('not-found', error.message);
    if (
      error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'SecurityError')
    ) {
      return err('permission', error.message);
    }
    return err('io', error instanceof Error ? error.message : String(error));
  }
}
