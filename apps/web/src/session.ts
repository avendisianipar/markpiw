// SPDX-License-Identifier: MIT
// Satu file yang sedang dibuka: editor + simpan otomatis + deteksi konflik (spesifikasi 6.2–6.3).
import { EditorController } from '@markpiw/editor';
import { editorStrings } from '@markpiw/ui';
import type { DirectoryLike } from './fs/types';
import { saveDraft } from './storage';
import { type WebHostOptions, WebFileHost } from './host/web-host';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error' | 'readonly';

export const AUTOSAVE_DELAY = 1000;

export class FileSession {
  private statusValue: SaveStatus = 'saved';
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private changes = 0;
  private queue: Promise<void> = Promise.resolve();
  private lastText: string;
  errorMessage: string | null = null;

  private constructor(
    readonly host: WebFileHost,
    readonly controller: EditorController,
    text: string,
    private readonly rootName: string,
  ) {
    this.lastText = text;
    controller.onDocChange(() => {
      this.changes++;
      if (this.statusValue !== 'conflict') this.setStatus('dirty');
      this.schedule();
    });
  }

  static async open(
    root: DirectoryLike,
    path: readonly string[],
    options: WebHostOptions,
  ): Promise<FileSession> {
    const host = await WebFileHost.open(root, path, options);
    const read = await host.readText();
    if (!read.ok) throw new Error(read.error.message);
    const controller = new EditorController({ text: read.value, host, strings: editorStrings });
    return new FileSession(host, controller, read.value, root.name);
  }

  get status(): SaveStatus {
    return this.statusValue;
  }

  get path(): readonly string[] {
    return this.host.path;
  }

  /** Teks terakhir yang diketahui valid (untuk mode baca-saja saat crash). */
  get lastKnownText(): string {
    return this.lastText;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): SaveStatus => this.statusValue;

  private setStatus(status: SaveStatus): void {
    if (status === this.statusValue) return;
    this.statusValue = status;
    for (const listener of [...this.listeners]) listener();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.save();
    }, AUTOSAVE_DELAY);
  }

  /** Simpan sekarang (Ctrl/Cmd+S, pindah file, blur). Penyimpanan berjalan berurutan. */
  save(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = this.queue.then(() => this.saveNow());
    return this.queue;
  }

  private async saveNow(options?: { force?: boolean }): Promise<void> {
    if (this.statusValue === 'conflict' && !options?.force) return;
    const snapshot = this.controller.getSnapshot();
    if (snapshot.readOnly) {
      this.setStatus('readonly');
      return;
    }
    if (!snapshot.dirty && !options?.force) {
      this.setStatus('saved');
      return;
    }
    if (this.controller.pendingUploads > 0) {
      // Gambar masih diunggah (src berupa blob: sementara); simpan setelah selesai.
      this.setStatus('dirty');
      return;
    }
    const version = this.changes;
    const out = this.controller.serialize();
    if (!out.ok) {
      this.setStatus('readonly');
      return;
    }
    this.setStatus('saving');
    const written = await this.host.writeText(
      out.value,
      options?.force ? { force: true } : undefined,
    );
    if (written.ok) {
      this.lastText = out.value;
      this.errorMessage = null;
      if (this.changes === version) {
        this.controller.markSaved();
        this.setStatus('saved');
      } else {
        this.setStatus('dirty');
        this.schedule();
      }
      return;
    }
    this.errorMessage = written.error.message;
    if (written.error.code === 'conflict') {
      this.setStatus('conflict');
      return;
    }
    // Izin hilang atau I/O gagal: simpan draf darurat (spesifikasi 6.5).
    await saveDraft(this.rootName, this.host.path.join('/'), out.value);
    this.setStatus('error');
  }

  /** Simpan perubahan tertunda lalu lepaskan sumber daya (pindah file). */
  async close(): Promise<void> {
    if (this.controller.getSnapshot().dirty && this.statusValue !== 'conflict') await this.save();
    await this.queue;
    if (this.timer) clearTimeout(this.timer);
    this.host.dispose();
  }

  /** Periksa perubahan di disk; terapkan jika tidak ada perubahan lokal, selain itu konflik. */
  async checkExternal(): Promise<void> {
    await this.queue;
    if (this.statusValue === 'saving' || this.statusValue === 'conflict') return;
    const meta = await this.host.diskMeta();
    if (!this.host.changedOnDisk(meta)) return;
    if (this.controller.getSnapshot().dirty) {
      this.setStatus('conflict');
      return;
    }
    await this.loadFromDisk({ onlyIfUnchangedSince: this.changes });
  }

  async resolveConflict(choice: 'mine' | 'disk'): Promise<void> {
    if (choice === 'disk') {
      await this.loadFromDisk();
      return;
    }
    this.statusValue = 'dirty';
    this.queue = this.queue.then(() => this.saveNow({ force: true }));
    await this.queue;
  }

  /**
   * Muat isi disk ke editor. Dengan `onlyIfUnchangedSince`, pengguna yang mengetik selama
   * pembacaan membuat status menjadi konflik alih-alih ketikannya hilang.
   */
  private async loadFromDisk(options?: { onlyIfUnchangedSince: number }): Promise<void> {
    const read = await this.host.readText();
    if (!read.ok) {
      this.errorMessage = read.error.message;
      this.setStatus('error');
      return;
    }
    if (
      options &&
      (this.changes !== options.onlyIfUnchangedSince || this.controller.getSnapshot().dirty)
    ) {
      this.setStatus('conflict');
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.controller.clearReadOnly();
    this.controller.applyExternalText(read.value);
    this.lastText = read.value;
    this.setStatus('saved');
  }

  /**
   * Pulihkan draf darurat. Jika file di disk berubah setelah draf disimpan (mis. `git pull`),
   * tampilkan konflik; jangan menimpa versi terbaru tanpa bertanya.
   */
  async restoreDraft(draft: { readonly text: string; readonly savedAt: number }): Promise<void> {
    await this.queue;
    const meta = await this.host.diskMeta();
    if (this.timer) clearTimeout(this.timer);
    this.controller.clearReadOnly();
    this.controller.applyExternalText(draft.text);
    if (meta.lastModified > draft.savedAt) {
      this.setStatus('conflict');
      return;
    }
    this.queue = this.queue.then(() => this.saveNow({ force: true }));
    await this.queue;
  }

  /** Pemulihan dari guard gagal: urungkan langkah terakhir lalu izinkan edit lagi. */
  undoLastChange(): void {
    this.controller.clearReadOnly();
    this.controller.commands.undo();
    this.setStatus(this.controller.getSnapshot().dirty ? 'dirty' : 'saved');
    if (this.controller.getSnapshot().dirty) this.schedule();
  }

  async reloadFromDisk(): Promise<void> {
    await this.loadFromDisk();
  }
}
