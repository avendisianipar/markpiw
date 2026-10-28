// SPDX-License-Identifier: LicenseRef-Proprietary
// Sinkronisasi webview → TextDocument (spesifikasi 7.3): debounce 200 ms → serialize → guard →
// diffText → `edits`. Hanya satu batch yang dikirim sampai dikonfirmasi, sehingga baseVersion
// selalu versi terakhir yang dikenal extension.
import type { EditorController } from '@markpiw/editor';
import type { TextChange } from '@markpiw/host';
import { diffText } from '@markpiw/markdown';
import { applyChanges, type WebviewMessage } from '../src/protocol';

export const CONFLICT_MESSAGE =
  'Ketikan terakhir bentrok dengan perubahan dari luar (undo, format, atau editor lain) dan tidak diterapkan.';

export const SYNC_DELAY = 200;

export class WebviewSync {
  private text: string;
  private version: number;
  private inFlight: string | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly controller: EditorController,
    private readonly post: (message: WebviewMessage) => void,
    text: string,
    version: number,
  ) {
    this.text = text;
    this.version = version;
    controller.onDocChange(() => this.schedule());
  }

  /** Teks terakhir yang dikonfirmasi extension (untuk mode baca-saja/pemulihan). */
  get lastText(): string {
    return this.text;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, SYNC_DELAY);
  }

  /** Kirim ketikan yang tertunda sekarang (blur, tab disembunyikan, simpan, undo). */
  flushNow(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.flush();
  }

  flush(): void {
    if (this.inFlight !== null) {
      this.again = true;
      return;
    }
    if (this.controller.pendingUploads > 0) {
      // Gambar masih diunggah (src berupa blob: sementara); kirim setelah selesai.
      this.schedule();
      return;
    }
    const out = this.controller.serialize();
    if (!out.ok) return; // editor menjadi read-only; tidak ada yang dikirim
    const changes = diffText(this.text, out.value);
    if (changes.length === 0) {
      this.controller.markSaved();
      return;
    }
    this.inFlight = out.value;
    this.post({ type: 'edits', baseVersion: this.version, changes });
  }

  onEditsApplied(version: number): void {
    if (this.inFlight === null) return;
    this.text = this.inFlight;
    this.version = version;
    this.inFlight = null;
    if (this.again) {
      this.again = false;
      this.flush();
    } else if (!this.timer) {
      this.controller.markSaved();
    }
  }

  /**
   * Undo native, git, editor lain, atau penolakan baseVersion usang. Ketikan lokal yang belum
   * dikonfirmasi diterapkan ulang di atas teks baru jika tidak bersinggungan dengan perubahan
   * dari luar; jika bersinggungan, teks dari luar menang dan pengguna diberi tahu.
   */
  onExternalChange(text: string, version: number): void {
    const base = this.text;
    const unsent =
      this.timer !== null ||
      this.inFlight !== null ||
      this.again ||
      this.controller.getSnapshot().dirty;
    let local: TextChange[] = [];
    if (unsent && this.controller.getSnapshot().readOnly === null) {
      const out = this.controller.serialize();
      if (out.ok) local = diffText(base, out.value);
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.inFlight = null;
    this.again = false;
    this.text = text;
    this.version = version;

    let merged: string | null = null;
    const mine = local[0];
    if (mine) {
      const theirs = diffText(base, text)[0];
      if (!theirs) {
        merged = applyChanges(text, [mine]);
      } else if (mine.to < theirs.from || mine.from > theirs.to) {
        const delta = mine.from > theirs.to ? theirs.insert.length - (theirs.to - theirs.from) : 0;
        merged = applyChanges(text, [
          { from: mine.from + delta, to: mine.to + delta, insert: mine.insert },
        ]);
      }
    }
    this.controller.clearReadOnly();
    this.controller.applyExternalText(merged ?? text);
    if (mine && merged === null) this.controller.notify('error', CONFLICT_MESSAGE);
    if (merged !== null && merged !== text) this.flush();
  }

  /** Pemulihan dari guard gagal: kembali ke teks terakhir yang dikonfirmasi. */
  reload(): void {
    this.onExternalChange(this.text, this.version);
  }
}
