// SPDX-License-Identifier: MIT
// Render rumus (KaTeX) dan diagram (Mermaid) untuk preview. Keduanya harus lolos CSP host
// (`style-src 'self'`, tanpa inline style):
// - KaTeX memakai output MathML (didukung Chromium), tanpa CSS/font KaTeX dan tanpa style inline.
// - Mermaid menghasilkan SVG dengan <style> internal; SVG itu ditampilkan sebagai <img> dari URL
//   blob sehingga gayanya tidak tunduk pada CSP halaman. Mermaid dimuat saat pertama dibutuhkan.
import katex from 'katex';

export type RenderResult = { ok: true; html: string } | { ok: false; error: string };

/** MathML untuk `latex`. Perintah yang butuh `trust` (\href, \includegraphics, …) ditolak. */
export function renderMath(latex: string, displayMode: boolean): RenderResult {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      output: 'mathml',
      throwOnError: true,
      trust: false,
      strict: 'ignore',
    });
    return { ok: true, html };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

type Mermaid = (typeof import('mermaid'))['default'];

/**
 * Mermaid memberi SVG `width="100%"`; sebagai <img> diagram kecil jadi diregangkan selebar kolom.
 * Pakai ukuran asli dari viewBox (CSS `max-width: 100%` tetap mengecilkan diagram yang lebar).
 */
export function naturalSize(svg: string): string {
  const open = /^<svg\b[^>]*>/.exec(svg)?.[0];
  const box = open && /viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(open);
  if (!open || !box) return svg;
  const tag = open
    .replace(/\s(width|height)="[^"]*"/g, '')
    .replace(/\sstyle="[^"]*max-width[^"]*"/, '')
    .replace(/^<svg/, `<svg width="${box[1]}" height="${box[2]}"`);
  return tag + svg.slice(open.length);
}

let mermaidLoad: Promise<Mermaid> | null = null;
let mermaidTheme: string | null = null;
let renderCount = 0;

function loadMermaid(): Promise<Mermaid> {
  mermaidLoad ??= import('mermaid').then((m) => m.default);
  return mermaidLoad;
}

const isDark = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';

/** SVG diagram Mermaid untuk `code`. */
export async function renderMermaid(code: string): Promise<RenderResult> {
  try {
    const mermaid = await loadMermaid();
    const theme = isDark() ? 'dark' : 'default';
    if (mermaidTheme !== theme) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme,
        // Label SVG murni: foreignObject/HTML tidak dibutuhkan di dalam <img>.
        htmlLabels: false,
        flowchart: { htmlLabels: false },
      });
      mermaidTheme = theme;
    }
    const { svg } = await mermaid.render(`mp-mermaid-${++renderCount}`, code);
    return { ok: true, html: naturalSize(svg) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
