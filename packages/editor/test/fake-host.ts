// SPDX-License-Identifier: MIT
import type { FileHost, HostError, Result, UiState } from '@markpiw/host';

/** Host palsu di memori untuk test editor. */
export class FakeHost implements FileHost {
  readonly historyMode: 'editor' | 'host';
  text: string;
  writes: string[] = [];
  assets = new Map<string, Uint8Array>();
  opened: string[] = [];
  undos = 0;
  redos = 0;
  private uiState: UiState | null = null;

  constructor(text = '', historyMode: 'editor' | 'host' = 'editor') {
    this.text = text;
    this.historyMode = historyMode;
  }
  async readText(): Promise<Result<string, HostError>> {
    return { ok: true, value: this.text };
  }
  async writeText(text: string): Promise<Result<void, HostError>> {
    this.text = text;
    this.writes.push(text);
    return { ok: true, value: undefined };
  }
  onExternalChange() {
    return { dispose() {} };
  }
  async saveAsset(bytes: Uint8Array): Promise<Result<string, HostError>> {
    const path = `./assets/image-${this.assets.size}.png`;
    this.assets.set(path, bytes);
    return { ok: true, value: path };
  }
  async resolveImageUrl(path: string): Promise<string | null> {
    return `https://example.test/${path}`;
  }
  openLink(target: string): void {
    this.opened.push(target);
  }
  persistUiState(state: UiState): void {
    this.uiState = state;
  }
  restoreUiState(): UiState | null {
    return this.uiState;
  }
  undo(): void {
    this.undos++;
  }
  redo(): void {
    this.redos++;
  }
}
