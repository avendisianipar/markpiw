// SPDX-License-Identifier: LicenseRef-Proprietary
// Sinkronisasi webview → TextDocument (spesifikasi 7.3): debounce 200 ms → serialize → guard →
// diffText → `edits`. Hanya satu batch yang dikirim sampai dikonfirmasi, sehingga baseVersion
// selalu versi terakhir yang dikenal extension.
import type { EditorController } from '@markpiw/editor';
import { diffText } from '@markpiw/markdown';
import type { WebviewMessage } from '../src/protocol';

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

  flush(): void {
    if (this.inFlight !== null) {
      this.again = true;
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

  /** Undo native, git, editor lain, atau penolakan baseVersion usang. */
  onExternalChange(text: string, version: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.inFlight = null;
    this.again = false;
    this.text = text;
    this.version = version;
    this.controller.clearReadOnly();
    this.controller.applyExternalText(text);
  }

  /** Pemulihan dari guard gagal: kembali ke teks terakhir yang dikonfirmasi. */
  reload(): void {
    this.onExternalChange(this.text, this.version);
  }
}
