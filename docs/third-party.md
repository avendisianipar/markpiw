# Dependensi dan lisensi pihak ketiga

markpiw berdiri di atas proyek-proyek open source berikut. Tabel ini menyorot dependency
langsung dan fondasional; daftar bundle yang lengkap dibuat otomatis saat build.

| Proyek | Dipakai untuk | Lisensi |
|---|---|---|
| [ProseMirror](https://prosemirror.net) | Inti editor; sepuluh package di-vendor tanpa modifikasi di `vendor/prosemirror` | MIT |
| [micromark](https://github.com/micromark/micromark) dan utilitas [mdast](https://github.com/syntax-tree/mdast) | Parsing CommonMark, GFM, frontmatter, dan math | MIT |
| [React](https://react.dev) dan React DOM | Antarmuka web dan webview VS Code | MIT |
| [React Aria Components](https://react-spectrum.adobe.com/react-aria/components.html) | Komponen UI aksesibel | Apache-2.0 |
| [Floating UI](https://floating-ui.com) | Posisi popover dan menu | MIT |
| [Lucide](https://lucide.dev) | Ikon | ISC |
| [KaTeX](https://katex.org) | Pratinjau matematika | MIT |
| [Mermaid](https://mermaid.js.org) | Pratinjau diagram | MIT |
| [lowlight](https://github.com/wooorm/lowlight) dan [highlight.js](https://highlightjs.org) | Syntax highlighting | MIT/BSD-3-Clause |
| [Valibot](https://valibot.dev) | Validasi pesan VS Code dan webview | MIT |

Toolchain pengembangan mencakup TypeScript, Vite, esbuild, pnpm, Vitest, fast-check,
Playwright, jsdom, ESLint, Prettier, `@vscode/test-electron`, dan `@vscode/vsce`.

`THIRD_PARTY_NOTICES.txt` dibuat otomatis oleh `tooling/third-party.ts` dari modul yang masuk
ke bundle. File tersebut disertakan di root VSIX dan di `dist/` web app. Build gagal bila
sebuah package tidak memiliki file lisensi. Maintainer harus memeriksa lisensi secara manual
sebelum menambahkan package ke `LICENSE_OVERRIDES`.
