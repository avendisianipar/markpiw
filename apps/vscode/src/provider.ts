// SPDX-License-Identifier: MIT
// Custom text editor markpiw (spesifikasi 7). TextDocument adalah sumber kebenaran: webview
// mengirim edit minimal, extension menerapkannya dan mengabaikan echo-nya; perubahan lain
// (undo native, git, editor lain) dikirim balik sebagai externalChange.
import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { assetName, safeAssetsFolder } from './assets';
import {
  applyChanges,
  type ExtensionMessage,
  parseWebviewMessage,
  type WebviewMessage,
} from './protocol';

export const VIEW_TYPE = 'markpiw.editor';
/** File spec yang saling ditelusuri (trace); perubahan pada file ini diteruskan ke panel saudara. */
export const SPEC_FILE_NAMES = ['requirements.md', 'design.md', 'tasks.md'];
/** Anchor yang diminta untuk panel yang baru dibuka dianggap usang setelah sekian ms. */
const REVEAL_TTL_MS = 5000;
const SIBLING_DEBOUNCE_MS = 200;

function basename(uri: vscode.Uri): string {
  return uri.path.slice(uri.path.lastIndexOf('/') + 1);
}

function dirname(uri: vscode.Uri): string {
  return uri.path.slice(0, uri.path.lastIndexOf('/'));
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
/** Pilihan tema pengguna, berlaku untuk semua workspace (globalState). */
const THEME_KEY = 'markpiw.theme';

type AssetResult = Extract<ExtensionMessage, { type: 'assetSaved' }>['result'];

/** Satu panel markpiw yang terbuka; diekspos untuk test integrasi. */
export class MarkpiwSession {
  /** Versi & teks yang diharapkan dari edit yang baru dikirim (untuk mengenali echo). */
  private expected: { version: number; text: string } | null = null;
  readonly posted: ExtensionMessage[] = [];
  private siblingTimer: ReturnType<typeof setTimeout> | null = null;
  /** Webview sudah mengirim `ready` (editor sudah atau sedang dipasang). */
  ready = false;

  constructor(
    readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
  ) {}

  /** True bila dokumen ini salah satu file spec (requirements/design/tasks). */
  get isSpecFile(): boolean {
    return SPEC_FILE_NAMES.includes(basename(this.document.uri).toLowerCase());
  }

  /** `uri` adalah file spec lain di folder yang sama dengan dokumen ini. */
  isSibling(uri: vscode.Uri): boolean {
    return (
      uri.scheme === this.document.uri.scheme &&
      uri.toString() !== this.document.uri.toString() &&
      dirname(uri) === dirname(this.document.uri) &&
      SPEC_FILE_NAMES.includes(basename(uri).toLowerCase())
    );
  }

  /** Beri tahu webview bahwa file saudara berubah (digabung bila beruntun). */
  siblingChanged(): void {
    if (this.siblingTimer) clearTimeout(this.siblingTimer);
    this.siblingTimer = setTimeout(() => {
      this.siblingTimer = null;
      this.post({ type: 'siblingsChanged' });
    }, SIBLING_DEBOUNCE_MS);
  }

  dispose(): void {
    if (this.siblingTimer) clearTimeout(this.siblingTimer);
    this.siblingTimer = null;
  }

  private get uiKey(): string {
    return `markpiw.ui:${this.document.uri.toString()}`;
  }

  post(message: ExtensionMessage): void {
    if (this.context.extensionMode === vscode.ExtensionMode.Test) this.posted.push(message);
    void this.panel.webview.postMessage(message);
  }

  /** Root yang boleh diakses webview: folder dokumen + workspace + dist extension. */
  roots(): vscode.Uri[] {
    const docDir = vscode.Uri.joinPath(this.document.uri, '..');
    const workspace = vscode.workspace.getWorkspaceFolder(this.document.uri)?.uri;
    return [
      vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
      docDir,
      ...(workspace ? [workspace] : []),
    ];
  }

  async handle(raw: unknown): Promise<void> {
    const message = parseWebviewMessage(raw);
    if (!message) {
      console.warn('markpiw: pesan webview tidak valid', raw);
      return;
    }
    await this.dispatch(message);
  }

  private async dispatch(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.ready = true;
        this.post({
          type: 'init',
          text: this.document.getText(),
          version: this.document.version,
          uiState: this.context.workspaceState.get(this.uiKey) ?? null,
          config: { assetsFolder: this.assetsFolder() },
          theme: this.context.globalState.get<'light' | 'dark'>(THEME_KEY) ?? null,
          fileName: basename(this.document.uri),
          folderName: basename(vscode.Uri.joinPath(this.document.uri, '..')),
          reveal: MarkpiwEditorProvider.takeReveal(this.document.uri),
        });
        return;
      case 'edits':
        await this.applyEdits(message.baseVersion, message.changes);
        return;
      case 'saveAsset':
        this.post({
          type: 'assetSaved',
          requestId: message.requestId,
          result: await this.saveAsset(message.data, message.mime),
        });
        return;
      case 'resolveImages': {
        const urls: Record<string, string | null> = {};
        for (const path of message.paths) urls[path] = await this.resolveImage(path);
        this.post({ type: 'imagesResolved', requestId: message.requestId, urls });
        return;
      }
      case 'openLink':
        await this.openLink(message.target);
        return;
      case 'uiState':
        await this.context.workspaceState.update(this.uiKey, message.state);
        return;
      case 'undo':
      case 'redo':
        await vscode.commands.executeCommand(message.type);
        return;
      case 'readSiblings': {
        const files: Record<string, string | null> = {};
        for (const name of message.names) files[name] = await this.readSibling(name);
        this.post({ type: 'siblingsRead', requestId: message.requestId, files });
        return;
      }
      case 'setTheme':
        await this.context.globalState.update(THEME_KEY, message.theme);
        for (const other of MarkpiwEditorProvider.sessions.values())
          if (other !== this) other.post({ type: 'theme', theme: message.theme });
        return;
    }
  }

  private async applyEdits(
    baseVersion: number,
    changes: readonly { from: number; to: number; insert: string }[],
  ): Promise<void> {
    const document = this.document;
    if (baseVersion !== document.version) {
      // Webview tertinggal: sinkronkan ulang dengan teks terkini.
      this.post({ type: 'externalChange', text: document.getText(), version: document.version });
      return;
    }
    if (changes.length === 0) {
      this.post({ type: 'editsApplied', version: document.version });
      return;
    }
    const edit = new vscode.WorkspaceEdit();
    for (const change of changes) {
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(change.from), document.positionAt(change.to)),
        change.insert,
      );
    }
    this.expected = {
      version: document.version + 1,
      text: applyChanges(document.getText(), changes),
    };
    const ok = await vscode.workspace.applyEdit(edit);
    if (!ok) {
      this.expected = null;
      this.post({ type: 'externalChange', text: document.getText(), version: document.version });
      return;
    }
    this.post({ type: 'editsApplied', version: document.version });
  }

  /** Dipanggil untuk setiap perubahan TextDocument ini. */
  onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (event.contentChanges.length === 0) return;
    const expected = this.expected;
    if (
      expected &&
      event.document.version === expected.version &&
      event.document.getText() === expected.text
    ) {
      this.expected = null; // echo dari edit webview sendiri
      return;
    }
    this.expected = null;
    this.post({
      type: 'externalChange',
      text: event.document.getText(),
      version: event.document.version,
    });
  }

  private assetsFolder(): string {
    const configured = vscode.workspace
      .getConfiguration('markpiw', this.document.uri)
      .get<string>('assetsFolder', 'assets');
    return safeAssetsFolder(configured);
  }

  private async saveAsset(data: string, mime: string): Promise<AssetResult> {
    const bytes = Uint8Array.from(Buffer.from(data, 'base64'));
    const name = assetName(bytes, mime);
    if (!name)
      return {
        ok: false,
        error: { code: 'invalid-path', message: `Tipe gambar tidak didukung: ${mime}` },
      };
    const folder = this.assetsFolder();
    const target = vscode.Uri.joinPath(this.document.uri, '..', ...folder.split('/'), name);
    try {
      try {
        await vscode.workspace.fs.stat(target);
      } catch {
        await vscode.workspace.fs.writeFile(target, bytes);
      }
      return { ok: true, value: `./${folder}/${name}` };
    } catch (error) {
      return {
        ok: false,
        error: { code: 'io', message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /** Path relatif → URI webview, hanya jika berada di dalam root yang diizinkan dan ada. */
  private async resolveImage(path: string): Promise<string | null> {
    if (/^(https:|blob:)/i.test(path)) return path;
    if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/')) return null;
    const clean = decodeURIComponent(path.split(/[?#]/)[0] ?? '');
    const target = vscode.Uri.joinPath(this.document.uri, '..', clean);
    const inside = this.roots().some(
      (root) => target.path === root.path || target.path.startsWith(`${root.path}/`),
    );
    if (!inside) return null;
    try {
      await vscode.workspace.fs.stat(target);
    } catch {
      return null;
    }
    return this.panel.webview.asWebviewUri(target).toString();
  }

  /** Isi file `name` di folder yang sama: dokumen terbuka (termasuk yang belum disimpan) atau disk. */
  private async readSibling(name: string): Promise<string | null> {
    if (name === '' || name.includes('/') || name.includes('\\') || name === '..') return null;
    if (!/\.(md|markdown)$/i.test(name)) return null;
    const uri = vscode.Uri.joinPath(this.document.uri, '..', name);
    if (uri.toString() === this.document.uri.toString()) return null;
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    if (open) return open.getText();
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    } catch {
      return null;
    }
  }

  private async openLink(target: string): Promise<void> {
    if (/^(https?:|mailto:)/i.test(target)) {
      await vscode.env.openExternal(vscode.Uri.parse(target));
      return;
    }
    if (target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(target)) return;
    const clean = decodeURIComponent(target.split(/[?#]/)[0] ?? '');
    if (!/\.(md|markdown)$/i.test(clean)) return;
    const uri = vscode.Uri.joinPath(this.document.uri, '..', clean);
    const hash = target.indexOf('#');
    const fragment = hash >= 0 ? safeDecode(target.slice(hash + 1)) : '';
    // Panel baru menerima anchor lewat init; panel yang sudah terbuka lewat pesan reveal.
    if (fragment) MarkpiwEditorProvider.requestReveal(uri, fragment);
    await vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE);
    const existing = MarkpiwEditorProvider.sessions.get(uri.toString());
    if (fragment && existing?.ready) {
      MarkpiwEditorProvider.takeReveal(uri);
      existing.post({ type: 'reveal', slug: fragment });
    }
  }
}

function nonce(): string {
  return randomBytes(16).toString('base64');
}

export class MarkpiwEditorProvider implements vscode.CustomTextEditorProvider {
  /** Sesi aktif per dokumen (test integrasi memakai ini lewat perintah internal). */
  static readonly sessions = new Map<string, MarkpiwSession>();
  private static readonly reveals = new Map<string, { slug: string; at: number }>();

  static requestReveal(uri: vscode.Uri, slug: string): void {
    MarkpiwEditorProvider.reveals.set(uri.toString(), { slug, at: Date.now() });
  }

  /** Anchor yang diminta untuk dokumen ini (sekali pakai), atau null bila tidak ada/usang. */
  static takeReveal(uri: vscode.Uri): string | null {
    const key = uri.toString();
    const found = MarkpiwEditorProvider.reveals.get(key);
    MarkpiwEditorProvider.reveals.delete(key);
    return found && Date.now() - found.at < REVEAL_TTL_MS ? found.slug : null;
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
  ): Promise<void> {
    const session = new MarkpiwSession(document, panel, this.context);
    const key = document.uri.toString();
    MarkpiwEditorProvider.sessions.set(key, session);
    panel.webview.options = { enableScripts: true, localResourceRoots: session.roots() };
    panel.webview.html = this.html(panel.webview);

    const subscriptions: vscode.Disposable[] = [
      panel.webview.onDidReceiveMessage((message) => void session.handle(message)),
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() === key) session.onDocumentChanged(event);
        else if (session.isSpecFile && session.isSibling(event.document.uri))
          session.siblingChanged();
      }),
    ];
    if (session.isSpecFile) {
      // File spec saudara dibuat/dihapus/diubah di disk (git, editor lain, Explorer).
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.joinPath(document.uri, '..'), '*.md'),
      );
      const onFile = (uri: vscode.Uri) => {
        if (session.isSibling(uri)) session.siblingChanged();
      };
      subscriptions.push(
        watcher,
        watcher.onDidCreate(onFile),
        watcher.onDidChange(onFile),
        watcher.onDidDelete(onFile),
        // Perubahan yang belum disimpan dibuang (revert/tutup tanpa simpan): baca ulang dari disk.
        vscode.workspace.onDidCloseTextDocument((closed) => onFile(closed.uri)),
      );
    }
    panel.onDidDispose(() => {
      session.dispose();
      subscriptions.forEach((s) => s.dispose());
      if (MarkpiwEditorProvider.sessions.get(key) === session)
        MarkpiwEditorProvider.sessions.delete(key);
    });
  }

  private html(webview: vscode.Webview): string {
    const dist = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(dist, 'webview.css'));
    const n = nonce();
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource} https: blob: data:`,
      `style-src ${webview.cspSource}`,
      `script-src 'nonce-${n}'`,
      `font-src ${webview.cspSource}`,
    ].join('; ');
    return `<!doctype html>
<html lang="id" data-host-colors>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${style.toString()}" />
  <title>markpiw</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${n}" type="module" src="${script.toString()}"></script>
</body>
</html>`;
  }
}
