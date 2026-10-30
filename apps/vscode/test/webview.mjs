// SPDX-License-Identifier: MIT
// Test webview di VS Code sungguhan: CSP, bundle satu file, dan interaksi editor. VS Code yang
// terpasang dijalankan dengan port debug; Playwright terhubung lewat CDP ke iframe webview.
// Butuh `pnpm build` lebih dulu. Screenshot disimpan ke MARKPIW_SHOTS (default: folder temp).
/* global document, getSelection, getComputedStyle -- dipakai di dalam frame.evaluate (webview) */
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';
import { chromium } from 'playwright-core';

const here = fileURLToPath(new URL('.', import.meta.url));
const executable =
  process.env.VSCODE_EXECUTABLE ??
  (process.platform === 'darwin'
    ? '/Applications/Visual Studio Code.app/Contents/MacOS/Code'
    : undefined);
const temp = mkdtempSync(join(tmpdir(), 'markpiw-webview-test-'));
const workspace = join(temp, 'workspace');
const bridge = join(temp, 'bridge');
const shots = process.env.MARKPIW_SHOTS ?? join(temp, 'shots');
mkdirSync(bridge);
mkdirSync(shots, { recursive: true });
cpSync(join(here, 'fixture'), workspace, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(predicate, label, timeout = 20_000) {
  const start = Date.now();
  for (;;) {
    const value = await predicate().catch(() => null);
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`timeout: ${label}`);
    await sleep(100);
  }
}

const port = await new Promise((resolve) => {
  const server = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = server.address();
    server.close(() => resolve(free));
  });
});

let asked = 0;
/** Teks dokumen terkini menurut extension host (TextDocument, sumber kebenaran di VS Code). */
async function documentText() {
  const n = asked++;
  writeFileSync(join(bridge, `ask-${n}`), '');
  const file = join(bridge, `text-${n}`);
  await waitFor(async () => existsSync(file), `text-${n}`);
  return readFileSync(file, 'utf8');
}

/** Tunggu sampai batch edit webview (200 ms) sampai ke TextDocument dan memenuhi `check`. */
const documentWhere = (check, label) =>
  waitFor(async () => {
    const text = await documentText();
    return check(text) ? text : null;
  }, label);

const vscodeRun = runTests({
  ...(executable ? { vscodeExecutablePath: executable } : {}),
  extensionDevelopmentPath: join(here, '..'),
  extensionTestsPath: join(here, 'webview-suite.cjs'),
  extensionTestsEnv: { MARKPIW_WEBVIEW_DIR: bridge },
  launchArgs: [
    workspace,
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${join(temp, 'user')}`,
    `--extensions-dir=${join(temp, 'extensions')}`,
  ],
});

const results = [];
const consoleErrors = [];
let browser;
try {
  await waitFor(async () => existsSync(join(bridge, 'opened')), 'features.md dibuka', 60_000);
  browser = await waitFor(
    () => chromium.connectOverCDP(`http://127.0.0.1:${port}`),
    'CDP VS Code',
    30_000,
  );
  const page = await waitFor(async () => {
    for (const context of browser.contexts())
      for (const p of context.pages()) if ((await p.title()).includes('features.md')) return p;
    return null;
  }, 'jendela workbench');
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const { url, lineNumber } = message.location();
    consoleErrors.push(`${message.text()} @ ${url.split('/').pop()}:${lineNumber}`);
  });
  const frame = await waitFor(async () => {
    // Frame webview luar (index.html) belum tentu punya konteks siap: lewati yang gagal.
    for (const f of page.frames()) if (await f.$('.ProseMirror').catch(() => null)) return f;
    return null;
  }, 'iframe webview markpiw');
  // Pratinjau Mermaid dimuat asinkron.
  await waitFor(() => frame.$('.mp-preview-mermaid img'), 'diagram mermaid', 20_000).catch(
    () => null,
  );
  await page.screenshot({ path: join(shots, 'vscode-1-render.png') });

  async function test(name, fn) {
    try {
      await fn();
      results.push(`ok   ${name}`);
    } catch (error) {
      results.push(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
    }
  }
  const expectTrue = (value, message) => {
    if (!value) throw new Error(message);
  };
  const count = (selector) => frame.$$eval(selector, (els) => els.length);
  const has = async (selector) => (await count(selector)) > 0;
  const activeClass = () => frame.evaluate(() => document.activeElement?.className ?? '');
  /** Kursor di akhir teks `needle` di dokumen editor. */
  // ProseMirror membaca seleksi DOM pada `selectionchange` (asinkron): tunggu sebelum mengetik.
  const caretAfter = (needle) =>
    frame.evaluate(async (text) => {
      const walker = document.createTreeWalker(document.querySelector('.ProseMirror'), 4);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent.indexOf(text);
        if (at >= 0) {
          const range = document.createRange();
          range.setStart(node, at + text.length);
          range.collapse(true);
          document.querySelector('.ProseMirror').focus();
          const selection = getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          await new Promise((r) => setTimeout(r, 50));
          return true;
        }
      }
      return false;
    }, needle);
  const toolbarButton = (label) => frame.locator(`.mp-toolbar button[aria-label="${label}"]`);
  const menuItem = (text) => frame.locator('[role="menuitem"]', { hasText: text });

  await test('file dibuka tanpa diubah dan tanpa mode baca-saja', async () => {
    expectTrue(!(await has('.mp-banner')), 'banner baca-saja muncul');
    const text = await documentText();
    expectTrue(text === readFileSync(join(here, 'fixture/features.md'), 'utf8'), 'teks berubah');
  });
  await test('rata kolom tabel tampil', async () => {
    expectTrue(await has('td.mp-align-center'), 'tidak ada sel rata tengah');
    expectTrue(await has('td.mp-align-right'), 'tidak ada sel rata kanan');
    const align = await frame.$eval('td.mp-align-right', (el) => getComputedStyle(el).textAlign);
    expectTrue(align === 'right', `text-align: ${align}`);
  });
  await test('<br> di sel tampil sebagai baris baru', async () => {
    expectTrue(await has('td .mp-raw-br br'), 'tidak ada <br>');
  });
  await test('callout GitHub tampil berlabel', async () => {
    const label = await frame.$eval('blockquote.mp-callout-warning', (el) =>
      el.getAttribute('data-callout-label'),
    );
    expectTrue(label === 'Peringatan', `label: ${label}`);
  });
  await test('rumus inline & blok dirender sebagai MathML (lolos CSP)', async () => {
    expectTrue(await has('.mp-math-inline math'), 'rumus inline tidak dirender');
    expectTrue(await has('.mp-math-block .mp-preview math'), 'pratinjau blok rumus kosong');
    expectTrue(await has('td .mp-math-inline math'), 'rumus di sel tidak dirender');
  });
  await test('diagram Mermaid tampil sebagai gambar', async () => {
    const size = await frame.$eval('.mp-preview-mermaid img', (img) => [
      img.naturalWidth,
      img.naturalHeight,
    ]);
    expectTrue(size[0] > 0 && size[1] > 0, `ukuran gambar ${size}`);
  });
  await test('diagram Mermaid tidak diregangkan melebihi ukuran aslinya', async () => {
    const [shown, natural] = await frame.$eval('.mp-preview-mermaid img', (img) => [
      img.getBoundingClientRect().width,
      img.naturalWidth,
    ]);
    expectTrue(shown <= natural + 1, `lebar tampil ${shown} > asli ${natural}`);
  });
  await test('toggle tema tetap di baris pertama toolbar', async () => {
    const [toolbarTop, toggleTop] = await frame.evaluate(() => [
      document.querySelector('.mp-toolbar').getBoundingClientRect().top,
      document.querySelector('.mp-topbar-end').getBoundingClientRect().top,
    ]);
    expectTrue(Math.abs(toolbarTop - toggleTop) < 4, `toolbar ${toolbarTop}, toggle ${toggleTop}`);
  });
  await test('syntax highlighting', async () => {
    const keyword = await frame.$eval('.mp-code .hljs-keyword', (el) => el.textContent);
    expectTrue(keyword === 'const', `keyword: ${keyword}`);
  });

  await test('Shift+Enter di sel menulis <br> ke file', async () => {
    expectTrue(await caretAfter('c2'), 'sel c2 tidak ditemukan');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('x');
    await documentWhere((t) => t.includes('c2<br>x'), 'c2<br>x di dokumen');
  });
  await test('Shift+Enter di paragraf menulis hard break', async () => {
    await caretAfter('Paragraf akhir.');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('baris dua');
    await documentWhere((t) => t.includes('Paragraf akhir.\\\nbaris dua'), 'hard break');
  });
  await test('menu tabel: hapus baris nonaktif di header, rata tengah mengubah file', async () => {
    await caretAfter('Kiri');
    await toolbarButton('Tabel').click();
    const disabled = await menuItem('Hapus baris').getAttribute('aria-disabled');
    expectTrue(disabled === 'true', `aria-disabled: ${disabled}`);
    await menuItem('Rata tengah').click();
    await documentWhere((t) => t.includes('| :---: | :---: | ---: |'), 'delimiter :---:');
    expectTrue((await count('th.mp-align-center')) === 2, 'header kiri belum rata tengah');
  });
  await test('menu tabel: sisipkan tabel 3 × 2 lewat grid', async () => {
    await caretAfter('baris dua');
    await toolbarButton('Tabel').click();
    await menuItem('Sisipkan tabel').click();
    await frame.locator('button[aria-label="3 × 2"]').click();
    expectTrue((await count('.ProseMirror table')) === 2, 'tabel baru tidak muncul');
    await documentWhere((t) => (t.match(/\| --- \| --- \|/g) ?? []).length === 1, 'tabel 3×2');
  });
  await test('menu + → rumus inline: fokus ke input, tersimpan ke file', async () => {
    await caretAfter('Paragraf awal.');
    await toolbarButton('Sisipkan lainnya').click();
    await menuItem('Rumus inline').click();
    await waitFor(async () => (await activeClass()) === 'mp-math-input', 'fokus input LaTeX', 3000);
    await page.keyboard.type('\\sqrt{2}');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' ok');
    await documentWhere((t) => t.includes('Paragraf awal.$\\sqrt{2}$ ok'), 'rumus inline');
  });
  await test('slash: callout catatan', async () => {
    await caretAfter('ok');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/catatan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('isi catatan');
    await documentWhere((t) => t.includes('> [!NOTE]\n> isi catatan'), 'callout di file');
  });
  await test('$$ + Enter: blok rumus dengan pratinjau', async () => {
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('$$');
    await page.keyboard.press('Enter');
    await page.keyboard.type('a+b');
    await documentWhere((t) => t.includes('$$\na+b\n$$'), 'blok $$ di file');
    expectTrue((await count('.mp-math-block .mp-preview math')) === 2, 'pratinjau blok baru');
  });
  await test('tidak masuk mode baca-saja setelah semua edit', async () => {
    expectTrue(!(await has('.mp-banner')), 'banner baca-saja muncul');
  });
  await page.screenshot({ path: join(shots, 'vscode-2-after-edits.png') });
} catch (error) {
  results.push(`FAIL setup: ${error instanceof Error ? error.message : error}`);
} finally {
  writeFileSync(join(bridge, 'done'), '');
  await browser?.close().catch(() => {});
  await vscodeRun.catch((error) => results.push(`FAIL vscode: ${error}`));
  rmSync(join(temp, 'user'), { recursive: true, force: true });
}

const csp = consoleErrors.filter((m) => /Content Security Policy|Refused to/i.test(m));
console.log(results.join('\n'));
console.log(`CSP/console errors: ${csp.length}`);
const grouped = new Map();
for (const message of csp) {
  const key = `${/sha256-[^']+/.exec(message)?.[0] ?? ''} ${message.split(' @ ').pop()}`;
  grouped.set(key, (grouped.get(key) ?? 0) + 1);
}
for (const [key, n] of grouped) console.log(`  ${n}× ${key}`);
console.log(`screenshots: ${shots}`);
if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1;
