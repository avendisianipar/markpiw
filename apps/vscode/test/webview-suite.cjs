// SPDX-License-Identifier: MIT
// Dijalankan di extension host oleh test/webview.mjs: buka features.md dengan markpiw, tunggu
// pengujian webview (Playwright lewat CDP) selesai, lalu tulis teks dokumen untuk diperiksa.
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.run = async function run() {
  const dir = process.env.MARKPIW_WEBVIEW_DIR;
  if (!dir) throw new Error('MARKPIW_WEBVIEW_DIR tidak diset');
  const ws = vscode.workspace.workspaceFolders[0].uri;
  const uri = vscode.Uri.joinPath(ws, process.env.MARKPIW_WEBVIEW_FILE ?? 'features.md');
  const extension = vscode.extensions.getExtension('avendisianipar.markpiw');
  await extension.activate();
  await vscode.commands.executeCommand('vscode.openWith', uri, 'markpiw.editor');
  const doc = await vscode.workspace.openTextDocument(uri);
  fs.writeFileSync(path.join(dir, 'opened'), doc.getText());

  // Orkestrator meminta teks dokumen terkini lewat file `ask-<n>` dan membaca `text-<n>`.
  const deadline = Date.now() + 180_000;
  let n = 0;
  while (Date.now() < deadline) {
    if (fs.existsSync(path.join(dir, `ask-${n}`))) {
      fs.writeFileSync(path.join(dir, `text-${n}`), doc.getText());
      n++;
      continue;
    }
    if (fs.existsSync(path.join(dir, 'done'))) return;
    await sleep(50);
  }
  throw new Error('timeout menunggu pengujian webview');
};
