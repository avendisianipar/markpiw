// SPDX-License-Identifier: LicenseRef-Proprietary

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

/** Port yang diimplementasikan setiap host (web, VS Code). Lihat spesifikasi 2.6. */
export interface FileHost {
  readonly historyMode: 'editor' | 'host';
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
}
