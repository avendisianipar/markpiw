// SPDX-License-Identifier: LicenseRef-Proprietary
// FileHost di dalam webview VS Code: semua akses file lewat pesan ke extension.
import type { Disposable, FileHost, HostError, Result, UiState } from '@markpiw/host';
import type { ExtensionMessage, WebviewMessage } from '../src/protocol';

type Reply = Extract<ExtensionMessage, { type: 'assetSaved' | 'imagesResolved' }>;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export class VsCodeFileHost implements FileHost {
  readonly historyMode = 'host' as const;
  private nextId = 1;
  /** Dipanggil sebelum undo/redo agar ketikan yang tertunda ikut terkirim lebih dulu. */
  beforeHistory: () => void = () => {};
  private readonly waiting = new Map<number, (reply: Reply) => void>();

  constructor(
    private readonly api: VsCodeApi,
    private readonly text: string,
    private readonly initialUiState: UiState | null,
  ) {}

  private post(message: WebviewMessage): void {
    this.api.postMessage(message);
  }

  private request<T extends Reply>(build: (requestId: number) => WebviewMessage): Promise<T> {
    const requestId = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(requestId, (reply) => resolve(reply as T));
      this.post(build(requestId));
    });
  }

  /** Teruskan balasan extension ke permintaan yang menunggu. */
  handleReply(reply: Reply): void {
    const resolve = this.waiting.get(reply.requestId);
    if (!resolve) return;
    this.waiting.delete(reply.requestId);
    resolve(reply);
  }

  async readText(): Promise<Result<string, HostError>> {
    return { ok: true, value: this.text };
  }

  async writeText(): Promise<Result<void, HostError>> {
    // VS Code: perubahan dikirim sebagai edit minimal; simpan ditangani VS Code.
    return { ok: false, error: { code: 'io', message: 'writeText tidak dipakai di VS Code' } };
  }

  onExternalChange(): Disposable {
    return { dispose() {} };
  }

  async saveAsset(bytes: Uint8Array, mime: string): Promise<Result<string, HostError>> {
    const reply = await this.request<Extract<Reply, { type: 'assetSaved' }>>((requestId) => ({
      type: 'saveAsset',
      requestId,
      data: toBase64(bytes),
      mime,
    }));
    return reply.result;
  }

  async resolveImageUrl(relativePath: string): Promise<string | null> {
    const reply = await this.request<Extract<Reply, { type: 'imagesResolved' }>>((requestId) => ({
      type: 'resolveImages',
      requestId,
      paths: [relativePath],
    }));
    return reply.urls[relativePath] ?? null;
  }

  openLink(target: string): void {
    this.post({ type: 'openLink', target });
  }

  persistUiState(state: UiState): void {
    this.api.setState({ uiState: state });
    this.post({ type: 'uiState', state });
  }

  restoreUiState(): UiState | null {
    const saved = this.api.getState() as { uiState?: UiState } | undefined;
    return saved?.uiState ?? this.initialUiState;
  }

  undo(): void {
    this.beforeHistory();
    this.post({ type: 'undo' });
  }

  redo(): void {
    this.beforeHistory();
    this.post({ type: 'redo' });
  }
}
