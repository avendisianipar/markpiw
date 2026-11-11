// SPDX-License-Identifier: MIT

/** Hasil operasi yang bisa gagal tanpa melempar exception. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Satu penggantian teks. `from`/`to` adalah offset UTF-16 pada teks lama. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

export interface HostError {
  code: 'permission' | 'conflict' | 'not-found' | 'io' | 'invalid-path';
  message: string;
}

export interface Disposable {
  dispose(): void;
}

export interface UiState {
  zoom: number;
  scrollTop: number;
  selection: { anchor: number; head: number } | null;
}

/**
 * Akses baca ke file lain di folder yang sama dengan file aktif (dipakai fitur trace spec:
 * `requirements.md`, `design.md`, `tasks.md`).
 */
export interface SiblingFiles {
  /** Nama file aktif, mis. `tasks.md`. */
  readonly fileName: string;
  /** Nama folder yang memuat file aktif (nama spec). */
  readonly folderName: string;
  /** Isi file `name` di folder yang sama (termasuk perubahan yang belum disimpan), atau null. */
  read(name: string): Promise<string | null>;
  /** Dipanggil saat file saudara mungkin berubah (dibuat, dihapus, diedit). */
  onChange(cb: () => void): Disposable;
}

/** Port yang diimplementasikan setiap host (web, VS Code). Lihat spesifikasi 2.6. */
export interface FileHost {
  readonly historyMode: 'editor' | 'host';
  /** Opsional: file saudara di folder yang sama. */
  readonly siblings?: SiblingFiles;
  readText(): Promise<Result<string, HostError>>;
  /** Dipakai host web; VS Code memakai `applyEdits`. */
  writeText(text: string): Promise<Result<void, HostError>>;
  applyEdits?(edits: TextChange[], baseVersion: number): Promise<Result<number, HostError>>;
  onExternalChange(cb: (text: string, version?: number) => void): Disposable;
  /** Mengembalikan path relatif aset yang disimpan. */
  saveAsset(bytes: Uint8Array, mime: string): Promise<Result<string, HostError>>;
  resolveImageUrl(relativePath: string): Promise<string | null>;
  /** `.md` relatif dibuka di markpiw; lainnya dibuka secara eksternal. */
  openLink(target: string): void;
  persistUiState(state: UiState): void;
  restoreUiState(): UiState | null;
  /** Hanya `historyMode: 'host'`: teruskan undo/redo ke host (mis. perintah native VS Code). */
  undo?(): void;
  redo?(): void;
}
