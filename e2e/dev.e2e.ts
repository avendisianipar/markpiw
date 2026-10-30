// SPDX-License-Identifier: MIT
// Dev server Vite memuat modul ESM satu per satu (berbeda dari build); pastikan aplikasi tetap
// tampil tanpa error di mode dev (regresi: halaman putih karena re-export tipe ProseMirror).
import { type ChildProcess, spawn } from 'node:child_process';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const PORT = 4181;
let server: ChildProcess;
let browser: Browser;

beforeAll(async () => {
  server = spawn(
    'pnpm',
    ['--filter', '@markpiw/web', 'exec', 'vite', '--port', String(PORT), '--strictPort'],
    {
      stdio: 'ignore',
    },
  );
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
    } catch {
      // belum siap
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe('web dev server', () => {
  it('renders the demo without page errors', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://localhost:${PORT}/?demo`);
    await page.waitForSelector('.ProseMirror h1', { timeout: 15_000 });
    expect(await page.textContent('.ProseMirror h1')).toBe('Selamat datang di markpiw');
    expect(errors).toEqual([]);
  });
});
