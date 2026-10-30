// SPDX-License-Identifier: MIT
import '@markpiw/ui/theme.css';
import './webview.css';
import { EditorController, type EditorSnapshot } from '@markpiw/editor';
import { createThemeStore, MarkpiwEditor, editorStrings, type ThemeStore } from '@markpiw/ui';
import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { type ExtensionMessage, parseExtensionMessage } from '../src/protocol';
import { WebviewSync } from './sync';
import { vscodeSchemeSource } from './theme';
import { VsCodeFileHost } from './vscode-host';

const api = acquireVsCodeApi();
let root: Root | null = null;
let host: VsCodeFileHost | null = null;
let sync: WebviewSync | null = null;
let theme: ThemeStore | null = null;

function themeFor(init: Extract<ExtensionMessage, { type: 'init' }>): ThemeStore {
  if (theme) {
    if (init.theme) theme.adopt(init.theme);
    return theme;
  }
  theme = createThemeStore({
    root: document.documentElement,
    system: vscodeSchemeSource(document.body),
    chosen: init.theme,
    save: (next) => api.postMessage({ type: 'setTheme', theme: next }),
    hostColors: true,
  });
  return theme;
}

function Editor(props: { controller: EditorController; sync: WebviewSync; theme: ThemeStore }) {
  const scheme = useSyncExternalStore(props.theme.subscribe, props.theme.get);
  return (
    <MarkpiwEditor
      controller={props.controller}
      fallbackText={() => props.sync.lastText}
      recoveryActions={[{ label: 'Muat ulang dari file', onPress: () => props.sync.reload() }]}
      colorScheme={scheme}
      onColorSchemeChange={props.theme.set}
    />
  );
}

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
      <Editor controller={controller} sync={currentSync} theme={themeFor(init)} />
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
    case 'theme':
      theme?.adopt(message.theme);
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
