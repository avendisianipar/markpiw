// SPDX-License-Identifier: MIT
// Dijalankan di extension host VS Code oleh @vscode/test-electron.
const assert = require('node:assert/strict');
const vscode = require('vscode');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, label, timeout = 15000) {
  const start = Date.now();
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`timeout: ${label}`);
    await sleep(50);
  }
}

exports.run = async function run() {
  const results = [];
  const ws = vscode.workspace.workspaceFolders[0].uri;
  const uri = vscode.Uri.joinPath(ws, 'doc.md');
  const key = uri.toString();
  const log = [];
  const drain = async () => {
    const posted = await vscode.commands.executeCommand('markpiw._test.posted', key);
    if (posted) log.push(...posted);
    return log;
  };
  const send = (message) => vscode.commands.executeCommand('markpiw._test.send', key, message);
  const take = () => log.splice(0);

  async function test(name, fn) {
    try {
      await fn();
      results.push(`ok   ${name}`);
    } catch (error) {
      results.push(`FAIL ${name}: ${error && error.stack ? error.stack : error}`);
    }
  }

  const extension = vscode.extensions.getExtension('avendisianipar.markpiw');
  assert.ok(extension, 'extension markpiw tidak ditemukan');
  await extension.activate();
  const commands = (await vscode.commands.getCommands(true)).filter((c) => c.startsWith('markpiw'));
  console.log('markpiw commands:', commands.join(', '));
  await vscode.commands.executeCommand('vscode.openWith', uri, 'markpiw.editor');
  const doc = await vscode.workspace.openTextDocument(uri);

  await test('webview ready → init with the document text', async () => {
    const all = await waitFor(
      async () => (await drain()).find((m) => m.type === 'init') && log,
      'init',
    );
    const init = all.find((m) => m.type === 'init');
    assert.equal(init.text, doc.getText());
    assert.equal(init.version, doc.version);
    take();
  });

  await test('vscode: echo ignored, undo applied', async () => {
    const before = doc.getText();
    const base = doc.version;
    await send({
      type: 'edits',
      baseVersion: base,
      changes: [{ from: before.indexOf('a'), to: before.indexOf('a') + 1, insert: 'A!' }],
    });
    await sleep(300);
    await drain();
    assert.equal(doc.getText(), before.replace('a', 'A!'));
    assert.deepEqual(
      take().map((m) => m.type),
      ['editsApplied'],
    );
    await vscode.commands.executeCommand('undo');
    await waitFor(
      async () => (await drain()).some((m) => m.type === 'externalChange'),
      'externalChange after undo',
    );
    assert.equal(doc.getText(), before);
    const change = take().find((m) => m.type === 'externalChange');
    assert.equal(change.text, before);
  });

  await test('vscode: rapid edits', async () => {
    const start = doc.getText();
    let version = doc.version;
    for (const ch of ['1', '2', '3']) {
      const end = doc.getText().length;
      await send({
        type: 'edits',
        baseVersion: version,
        changes: [{ from: end, to: end, insert: ch }],
      });
      await drain();
      const applied = take().find((m) => m.type === 'editsApplied');
      assert.ok(applied, `editsApplied for ${ch}`);
      version = applied.version;
    }
    assert.equal(doc.getText(), `${start}123`);
    assert.equal(version, doc.version);
  });

  await test('stale baseVersion → externalChange with current text', async () => {
    await send({
      type: 'edits',
      baseVersion: doc.version - 1,
      changes: [{ from: 0, to: 0, insert: 'X' }],
    });
    await drain();
    const messages = take();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].type, 'externalChange');
    assert.equal(messages[0].text, doc.getText());
    assert.ok(!doc.getText().startsWith('X'));
  });

  await test('external edit from another editor → externalChange', async () => {
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), '<!-- x -->\n');
    await vscode.workspace.applyEdit(edit);
    await waitFor(
      async () => (await drain()).some((m) => m.type === 'externalChange'),
      'externalChange',
    );
    assert.equal(take().find((m) => m.type === 'externalChange').text, doc.getText());
  });

  await test('saveAsset writes assets/image-<hash>.png via workspace.fs', async () => {
    await send({
      type: 'saveAsset',
      requestId: 7,
      data: Buffer.from([1, 2, 3, 4]).toString('base64'),
      mime: 'image/png',
    });
    await drain();
    const reply = take().find((m) => m.type === 'assetSaved');
    assert.deepEqual(reply, {
      type: 'assetSaved',
      requestId: 7,
      result: { ok: true, value: './assets/image-9f64a747.png' },
    });
    const stat = await vscode.workspace.fs.stat(
      vscode.Uri.joinPath(ws, 'assets', 'image-9f64a747.png'),
    );
    assert.equal(stat.size, 4);
  });

  await test('resolveImages maps existing files inside the workspace only', async () => {
    await send({
      type: 'resolveImages',
      requestId: 8,
      paths: ['assets/image-9f64a747.png', '../../etc/passwd', 'missing.png'],
    });
    await drain();
    const reply = take().find((m) => m.type === 'imagesResolved');
    assert.match(reply.urls['assets/image-9f64a747.png'], /^https:\/\/.*vscode/);
    assert.equal(reply.urls['../../etc/passwd'], null);
    assert.equal(reply.urls['missing.png'], null);
  });

  await test('format shortcuts are claimed while markpiw is active', async () => {
    await vscode.commands.executeCommand('vscode.openWith', uri, 'markpiw.editor');
    const before = vscode.workspace.getConfiguration('workbench').get('sideBar.location');
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('markpiw.claimShortcut'));
    assert.equal(await vscode.commands.executeCommand('markpiw.claimShortcut'), undefined);
    assert.equal(vscode.workspace.getConfiguration('workbench').get('sideBar.location'), before);
  });

  await test('setTheme is saved globally and sent with the next init', async () => {
    await send({ type: 'setTheme', theme: 'dark' });
    await send({ type: 'ready' });
    const init = await waitFor(
      async () => (await drain()).find((m) => m.type === 'init'),
      'init after setTheme',
    );
    assert.equal(init.theme, 'dark');
    take();
  });

  await test('invalid messages are ignored', async () => {
    const before = doc.getText();
    await send({ type: 'edits', baseVersion: 'nope', changes: 'x' });
    await send({ type: 'unknown' });
    await drain();
    assert.equal(take().length, 0);
    assert.equal(doc.getText(), before);
  });

  console.log(results.join('\n'));
  if (results.some((r) => r.startsWith('FAIL')))
    throw new Error(results.filter((r) => r.startsWith('FAIL')).join('\n'));
};
