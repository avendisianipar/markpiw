// SPDX-License-Identifier: MIT
// Folder contoh untuk mode demo (di memori; tidak ada yang ditulis ke disk).
import { MemoryDirectory } from '../fs/memory';

const welcome = `# Selamat datang di markpiw

markpiw adalah editor markdown **WYSIWYG**: Anda mengedit langsung di tampilan jadi, dan file \`.md\` tetap bersih untuk di-review di git.

![Logo markpiw](./assets/logo.svg)

## Coba ini

- Ketik \`/\` di baris kosong untuk membuka menu perintah.
- Ketik \`# \`, \`- \`, \`1. \`, \`> \` atau \`[ ] \` di awal baris.
- Pilih teks lalu tekan **Ctrl/⌘+B**, *Ctrl/⌘+I*, atau ~~Ctrl/⌘+Shift+X~~.
- Tempel gambar dari clipboard: gambar disimpan ke folder \`assets/\`.
- Buka [panduan format](panduan/format-teks.md) atau [tabel & list](panduan/tabel-dan-list.md).

## Yang dijaga markpiw

1. File yang tidak diedit tetap identik byte-per-byte.
2. Hanya blok yang Anda sentuh yang berubah di diff.
3. Sintaks yang tidak dikenal tetap utuh sebagai markdown mentah.

<!-- Komentar HTML seperti ini tetap dipertahankan. -->

> Catatan: di mode demo, perubahan hanya tersimpan di memori browser.
`;

const formatting = `Format teks
===========

Paragraf ini memakai _garis bawah_ untuk miring dan __garis bawah ganda__ untuk tebal. Gaya ini dipertahankan saat Anda mengedit paragraf lain.

Baris yang dipotong manual
tetap dipotong di tempat yang sama.

Kode inline: \`pnpm verify\`. Link referensi: [spesifikasi][spec].

\`\`\`ts title="contoh.ts"
const halo = (nama: string) => \`Halo, \${nama}!\`;
\`\`\`

---

Kembali ke [halaman awal](../Selamat%20datang.md).

[spec]: https://example.com/spec "Spesifikasi"
`;

const tables = `# Tabel & list

| Fitur | Web | VS Code |
|---|:---:|---:|
| Edit di preview | ya | ya |
| Tempel gambar | ya | ya |
| Undo native | – | ya |

* list dengan bintang
* tetap memakai bintang
  * termasuk yang bersarang

1. satu
2. dua
3. tiga

- [x] tugas selesai
- [ ] tugas berikutnya
`;

const advanced = `# Fitur lanjutan

Semua yang ada di sini tetap markdown biasa dan tampil benar di GitHub.

> [!TIP]
> Callout dibuat dari menu \`/\` (ketik \`/callout\`) atau tombol **+** di toolbar.

> [!WARNING]
> Teks marker \`[!WARNING]\` bisa diedit untuk mengganti jenis callout.

## Rumus

Rumus inline seperti $E = mc^2$ dibuat dengan mengetik \`$…$\`. Klik rumus untuk mengedit LaTeX-nya.

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Diagram

\`\`\`mermaid
flowchart LR
  A[Tulis .md] --> B[Edit di markpiw]
  B --> C[Review di git]
\`\`\`

## Kode

\`\`\`ts
export function halo(nama: string): string {
  return \`Halo, \${nama}!\`; // syntax highlighting
}
\`\`\`

## Tabel

| Kolom kiri | Tengah | Kanan |
|:---|:---:|---:|
| baris pertama<br>dua baris | 10 | 1.000 |
| Shift+Enter di sel | $x^2$ | 20 |
`;

const crlf =
  '# Catatan CRLF\r\n\r\nFile ini memakai line ending Windows (CRLF).\r\nBaris yang tidak diedit tetap CRLF.\r\n';

const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64"><rect width="240" height="64" rx="12" fill="#2563eb"/><text x="120" y="42" font-family="system-ui, sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">markpiw</text></svg>`;

export function createDemoFolder(): MemoryDirectory {
  return MemoryDirectory.from(
    {
      'Selamat datang.md': welcome,
      'catatan-crlf.md': crlf,
      panduan: {
        'format-teks.md': formatting,
        'tabel-dan-list.md': tables,
        'fitur-lanjutan.md': advanced,
      },
      assets: { 'logo.svg': new TextEncoder().encode(logo) },
    },
    'demo-markpiw',
  );
}

export const DEMO_START = ['Selamat datang.md'];
