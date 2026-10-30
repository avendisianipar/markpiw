// SPDX-License-Identifier: MIT
// E2E web (mode demo) dengan Chrome terpasang via playwright-core, headless.
// Jalankan: pnpm test:e2e (butuh `pnpm --filter @markpiw/web build` lebih dulu).
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 4179;
const DEMO_URL = `http://localhost:${PORT}/?demo`;
const SHOTS = new URL('../.superpowers/e2e/', import.meta.url).pathname;
let server: ChildProcess;
let browser: Browser;
let page: Page;

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return;
    } catch {
      // belum siap
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('vite preview tidak siap');
}

const read = (path: string) =>
  page.evaluate(
    (p) =>
      (
        window as unknown as { __markpiwDemo: { read(p: string): Promise<string> } }
      ).__markpiwDemo.read(p),
    path,
  );
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  server = spawn(
    'pnpm',
    ['--filter', '@markpiw/web', 'exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'],
    {
      stdio: 'ignore',
    },
  );
  await waitForServer();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', (error) => console.error('pageerror', error));
  await page.goto(DEMO_URL);
  await page.waitForSelector('.ProseMirror h1');
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe('web demo', () => {
  it('opens the welcome file with the editor, toolbar and file tree', async () => {
    expect(await page.textContent('.ProseMirror h1')).toBe('Selamat datang di markpiw');
    expect(await page.locator('.web-tree-item').count()).toBeGreaterThanOrEqual(3);
    expect(await page.locator('.mp-image img').getAttribute('src')).toMatch(/^blob:/);
    await page.screenshot({ path: `${SHOTS}01-welcome.png` });
  });

  it('typing markdown shortcuts creates blocks and autosaves to the file', async () => {
    // Klik pertama memicu paragraf penutup setelah kutipan; klik paragraf kosong itu.
    await page.click('.ProseMirror blockquote p');
    await page.click('.ProseMirror > p:last-child');
    await page.keyboard.type('## Bagian baru');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Teks **tebal** dan - [ ] bukan list');
    await page.waitForFunction(
      () => document.querySelector('.web-status')?.textContent === 'Tersimpan',
      null,
      { timeout: 5000 },
    );
    const text = await read('Selamat datang.md');
    expect(text).toContain('## Bagian baru\n\nTeks **tebal** dan - [ ] bukan list\n');
    expect(
      text.startsWith('# Selamat datang di markpiw\n\nmarkpiw adalah editor markdown **WYSIWYG**'),
    ).toBe(true);
    expect(text).toContain('<!-- Komentar HTML seperti ini tetap dipertahankan. -->');
  });

  it('slash menu inserts a table', async () => {
    await page.keyboard.press('Enter');
    await page.keyboard.type('/tab');
    await page.waitForSelector('.mp-slash [role="option"]');
    await page.screenshot({ path: `${SHOTS}02-slash.png` });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Kolom');
    await page.keyboard.press('Tab');
    await page.keyboard.type('Nilai');
    await page.keyboard.press(`${mod}+s`);
    await page.waitForFunction(
      () => document.querySelector('.web-status')?.textContent === 'Tersimpan',
    );
    expect(await read('Selamat datang.md')).toContain('| Kolom | Nilai |  |\n| --- | --- | --- |');
  });

  it('toolbar Bold toggles the selected word', async () => {
    await page.click('.ProseMirror > p:last-child');
    await page.keyboard.type('kata penting di sini');
    await page.locator('.ProseMirror p', { hasText: 'kata penting di sini' }).dblclick();
    await page.click('[aria-label="Tebal"]');
    await page.keyboard.press(`${mod}+s`);
    await page.waitForFunction(
      () => document.querySelector('.web-status')?.textContent === 'Tersimpan',
    );
    expect(await read('Selamat datang.md')).toMatch(/\*\*\w+\*\*/);
  });

  it('editing another file only changes the edited block', async () => {
    await page.click('.web-tree-item:has-text("panduan")');
    await page.click('.web-tree-item:has-text("format-teks")');
    await page.waitForSelector('.ProseMirror h1:has-text("Format teks")');
    const before = await read('panduan/format-teks.md');
    await page.click('.ProseMirror p:has-text("Kode inline")');
    await page.keyboard.press('End');
    await page.keyboard.type(' Tambahan.');
    await page.keyboard.press(`${mod}+s`);
    await page.waitForFunction(
      () => document.querySelector('.web-status')?.textContent === 'Tersimpan',
    );
    const after = await read('panduan/format-teks.md');
    const changed = after.split('\n').filter((line, i) => line !== before.split('\n')[i]);
    expect(changed).toEqual([
      'Kode inline: `pnpm verify`. Link referensi: [spesifikasi][spec]. Tambahan.',
    ]);
    await page.screenshot({ path: `${SHOTS}03-format.png` });
  });

  it('CRLF files keep CRLF on untouched lines', async () => {
    await page.click('.web-tree-item:has-text("catatan-crlf")');
    await page.waitForSelector('.ProseMirror h1:has-text("Catatan CRLF")');
    await page.click('.ProseMirror h1');
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    await page.keyboard.press(`${mod}+s`);
    await page.waitForFunction(
      () => document.querySelector('.web-status')?.textContent === 'Tersimpan',
    );
    expect(await read('catatan-crlf.md')).toBe(
      '# Catatan CRLF!\r\n\r\nFile ini memakai line ending Windows (CRLF).\r\nBaris yang tidak diedit tetap CRLF.\r\n',
    );
  });

  it('theme toggle switches to dark mode and survives a reload', async () => {
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
    const canvas = () =>
      page.evaluate(() => getComputedStyle(document.querySelector('.mp-root')!).backgroundColor);
    expect(await theme()).toBe('light');
    const light = await canvas();
    await page.click('[aria-label="Mode gelap"]');
    expect(await theme()).toBe('dark');
    expect(await canvas()).not.toBe(light);
    await page.screenshot({ path: `${SHOTS}04-dark.png` });
    await page.reload();
    await page.waitForSelector('.ProseMirror h1');
    expect(await theme()).toBe('dark');
    expect(await page.getAttribute('[aria-label="Mode gelap"]', 'aria-pressed')).toBe('true');
    await page.click('[aria-label="Mode gelap"]');
    expect(await theme()).toBe('light');
  });
});

// Skenario yang sama dengan apps/vscode/test/webview.mjs agar web dan VS Code teruji setara.
describe('web demo: fitur lanjutan (CSP produksi aktif)', () => {
  const FILE = 'panduan/fitur-lanjutan.md';
  const saved = () =>
    page.waitForFunction(() => document.querySelector('.web-status')?.textContent === 'Tersimpan');
  /** Tunggu sampai file demo memenuhi `check` (simpan otomatis 1 detik setelah berhenti mengetik). */
  async function fileWhere(check: (text: string) => boolean): Promise<string> {
    for (let i = 0; i < 50; i++) {
      await saved();
      const text = await read(FILE);
      if (check(text)) return text;
      await new Promise((r) => setTimeout(r, 200));
    }
    return read(FILE);
  }
  /**
   * Kursor di akhir teks `needle` di editor. ProseMirror membaca seleksi DOM pada
   * `selectionchange` (asinkron), jadi tunggu sebentar sebelum menekan tombol.
   */
  const caretAfter = (needle: string) =>
    page.evaluate(async (text) => {
      const root = document.querySelector<HTMLElement>('.ProseMirror')!;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const at = node.textContent!.indexOf(text);
        if (at < 0) continue;
        root.focus();
        const range = document.createRange();
        range.setStart(node, at + text.length);
        getSelection()!.removeAllRanges();
        getSelection()!.addRange(range);
        await new Promise((r) => setTimeout(r, 50));
        return true;
      }
      return false;
    }, needle);
  const toolbarButton = (label: string) =>
    page.locator(`.mp-toolbar button[aria-label="${label}"]`);
  const menuItem = (text: string) => page.locator('[role="menuitem"]', { hasText: text });

  beforeAll(async () => {
    await page.goto(DEMO_URL);
    await page.click('.web-tree-item:has-text("panduan")');
    await page.click('.web-tree-item:has-text("fitur-lanjutan")');
    await page.waitForSelector('.ProseMirror h1:has-text("Fitur lanjutan")');
    await page.waitForSelector('.mp-preview-mermaid img', { timeout: 20_000 });
  });

  it('renders callouts, math, mermaid, highlighting and table alignment', async () => {
    expect(await page.getAttribute('blockquote.mp-callout-tip', 'data-callout-label')).toBe('Tips');
    expect(await page.locator('.mp-math-inline math').count()).toBeGreaterThan(0);
    expect(await page.locator('.mp-math-block .mp-preview math').count()).toBe(1);
    expect(await page.locator('td .mp-math-inline math').count()).toBe(1);
    expect(await page.textContent('.mp-code .hljs-keyword')).toBe('export');
    expect(await page.locator('td .mp-raw-br br').count()).toBe(1);
    const align = await page.$eval('td.mp-align-right', (el) => getComputedStyle(el).textAlign);
    expect(align).toBe('right');
    const [shown, natural] = await page.$eval('.mp-preview-mermaid img', (img) => [
      img.getBoundingClientRect().width,
      (img as HTMLImageElement).naturalWidth,
    ]);
    expect(natural).toBeGreaterThan(0);
    expect(shown).toBeLessThanOrEqual(natural + 1);
    await page.screenshot({ path: `${SHOTS}05-fitur-lanjutan.png` });
  });

  it('Shift+Enter writes <br> in a cell and a hard break in a paragraph', async () => {
    await caretAfter('Shift+Enter di sel');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('x');
    await caretAfter('tampil benar di GitHub.');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('baris dua');
    const text = await fileWhere((t) => t.includes('baris dua'));
    expect(text).toContain('| Shift+Enter di sel<br>x |');
    expect(text).toContain('tampil benar di GitHub.\\\nbaris dua');
  });

  it('table menu: delete row disabled in header, alignment and size picker write the file', async () => {
    await caretAfter('Kolom kiri');
    await toolbarButton('Tabel').click();
    expect(await menuItem('Hapus baris').getAttribute('aria-disabled')).toBe('true');
    await menuItem('Rata tengah').click();
    await caretAfter('Kanan');
    await toolbarButton('Tabel').click();
    await menuItem('Sisipkan tabel').click();
    await page.click('button[aria-label="3 × 2"]');
    const text = await fileWhere((t) => (t.match(/\| --- \| --- \|/g) ?? []).length === 1);
    expect(text).toContain('| :---: | :---: | ---: |');
    expect(await page.locator('.ProseMirror table').count()).toBe(2);
  });

  it('insert menu → inline math focuses the LaTeX input and saves', async () => {
    await caretAfter('baris dua');
    await toolbarButton('Sisipkan lainnya').click();
    await menuItem('Rumus inline').click();
    await page.waitForFunction(
      () => document.activeElement?.classList.contains('mp-math-input'),
      null,
      { timeout: 3000 },
    );
    await page.keyboard.type('\\sqrt{2}');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' ok');
    const text = await fileWhere((t) => t.includes('$\\sqrt{2}$ ok'));
    expect(text).toContain('baris dua$\\sqrt{2}$ ok');
  });

  it('slash callout and $$ math block are written as GitHub markdown', async () => {
    await caretAfter('ok');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/catatan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('isi catatan');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('$$');
    await page.keyboard.press('Enter');
    await page.keyboard.type('a+b');
    const text = await fileWhere((t) => t.includes('a+b'));
    expect(text).toContain('> [!NOTE]\n> isi catatan');
    expect(text).toContain('$$\na+b\n$$');
    expect(await page.locator('.mp-banner').count()).toBe(0);
    await page.screenshot({ path: `${SHOTS}06-fitur-lanjutan-edit.png` });
  });
});
