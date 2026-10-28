// SPDX-License-Identifier: LicenseRef-Proprietary
import '@markpiw/ui/theme.css';
import './webview.css';
import { EditorController, type EditorSnapshot } from '@markpiw/editor';
import { MarkpiwEditor, editorStrings } from '@markpiw/ui';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type ExtensionMessage, parseExtensionMessage } from '../src/protocol';
import { WebviewSync } from './sync';
import { VsCodeFileHost } from './vscode-host';

const api = acquireVsCodeApi();
let root: Root | null = null;
let host: VsCodeFileHost | null = null;
let sync: WebviewSync | null = null;

function start(init: Extract<ExtensionMessage, { type: 'init' }>): void {
  host = new VsCodeFileHost(api, init.text, init.uiState);
  const controller = new EditorController({ text: init.text, host, strings: editorStrings });
  const currentHost = host;
  sync = new WebviewSync(
    controller,
    (message) => api.postMessage(message),
    init.text,
    init.version,
  );
  const currentSync = sync;
  currentHost.beforeHistory = () => currentSync.flushNow();

  // Simpan zoom (state UI) setiap kali berubah.
  let zoom = controller.getSnapshot().zoom;
  controller.subscribe(() => {
    const snapshot: EditorSnapshot = controller.getSnapshot();
    if (snapshot.zoom === zoom) return;
    zoom = snapshot.zoom;
    const selection = controller.state.selection;
    currentHost.persistUiState({
      zoom,
      scrollTop: 0,
      selection: { anchor: selection.anchor, head: selection.head },
    });
  });

  root?.unmount();
  root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <StrictMode>
      <MarkpiwEditor
        controller={controller}
        fallbackText={() => currentSync.lastText}
        recoveryActions={[{ label: 'Muat ulang dari file', onPress: () => currentSync.reload() }]}
      />
    </StrictMode>,
  );
}

window.addEventListener('message', (event: MessageEvent) => {
  const message = parseExtensionMessage(event.data);
  if (!message) return;
  switch (message.type) {
    case 'init':
      start(message);
      break;
    case 'editsApplied':
      sync?.onEditsApplied(message.version);
      break;
    case 'externalChange':
      sync?.onExternalChange(message.text, message.version);
      break;
    case 'assetSaved':
    case 'imagesResolved':
      host?.handleReply(message);
      break;
  }
});

// Kirim ketikan tertunda sebelum webview disembunyikan/ditutup (retainContextWhenHidden: false)
// atau sebelum VS Code menyimpan (Ctrl/⌘+S diteruskan ke workbench).
const flushNow = () => sync?.flushNow();
window.addEventListener('blur', flushNow);
window.addEventListener('pagehide', flushNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushNow();
});
window.addEventListener(
  'keydown',
  (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') flushNow();
  },
  true,
);

api.postMessage({ type: 'ready' });
