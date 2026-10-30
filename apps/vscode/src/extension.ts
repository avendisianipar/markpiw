// SPDX-License-Identifier: MIT
import * as vscode from 'vscode';
import { MarkpiwEditorProvider, VIEW_TYPE } from './provider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW_TYPE, new MarkpiwEditorProvider(context), {
      supportsMultipleEditorsPerDocument: false,
      webviewOptions: { retainContextWhenHidden: false },
    }),
    // Shortcut format (Cmd+B, Cmd+K, …) ditangani editor di webview; perintah ini hanya
    // "mengklaim" tombolnya saat markpiw aktif agar shortcut VS Code yang sama tidak ikut berjalan.
    vscode.commands.registerCommand('markpiw.claimShortcut', () => undefined),
    vscode.commands.registerCommand('markpiw.openInMarkpiw', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target) {
        void vscode.window.showInformationMessage('Buka file .md terlebih dahulu.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, VIEW_TYPE);
    }),
  );

  if (context.extensionMode === vscode.ExtensionMode.Test) {
    // Hanya untuk test integrasi: kirim pesan seolah dari webview dan baca pesan keluar.
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'markpiw._test.send',
        async (uri: string, message: unknown) => {
          await MarkpiwEditorProvider.sessions.get(uri)?.handle(message);
        },
      ),
      vscode.commands.registerCommand(
        'markpiw._test.posted',
        (uri: string) => MarkpiwEditorProvider.sessions.get(uri)?.posted.splice(0) ?? null,
      ),
    );
  }
}

export function deactivate(): void {}
