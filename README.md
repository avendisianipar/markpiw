# markpiw

Editor markdown WYSIWYG: edit langsung di tampilan jadi (seperti Notion), file `.md` tetap bersih untuk di-review di git. Tersedia sebagai **extension VS Code** dan **web app** (Chrome/Edge). Semuanya berjalan di komputer Anda; markpiw tidak mengirim data ke mana pun (lihat [Privasi](#privasi)).

- [Pasang di VS Code](#pasang-di-vs-code)
- [Memakai versi web](#memakai-versi-web)
- [Untuk pengembang](#untuk-pengembang)
- [Privasi](#privasi)
- [Terima kasih](#terima-kasih)
- [Lisensi](#lisensi)

---

## Pasang di VS Code

Yang Anda butuhkan hanya **VS Code 1.95 atau lebih baru**. Tidak perlu Node, pnpm, atau clone repo ini.

### 1. Unduh file `.vsix`

Buka halaman [**Releases**](https://github.com/avendisianipar/markpiw/releases), pilih versi terbaru, lalu unduh `markpiw.vsix` di bagian **Assets**.

> Repo ini private. Jika halaman Releases tidak bisa dibuka, minta akses ke pemilik repo, atau minta file `.vsix`-nya langsung.

Atau lewat terminal jika Anda memakai [GitHub CLI](https://cli.github.com/):

```bash
gh release download --repo avendisianipar/markpiw --pattern '*.vsix'
```

### 2. Pasang extension

Pilih salah satu cara:

- **Lewat menu (paling mudah).** Di VS Code, buka panel **Extensions** (Ctrl/⌘+Shift+X), klik **`…`** di kanan atas panel, pilih **Install from VSIX…**, lalu pilih `markpiw.vsix`.
- **Seret dan lepas.** Seret file `markpiw.vsix` ke panel **Extensions**.
- **Lewat terminal.**

  ```bash
  code --install-extension markpiw.vsix
  ```

  > `code: command not found` di macOS? Di VS Code tekan ⌘+Shift+P, jalankan **Shell Command: Install 'code' command in PATH**, lalu buka terminal baru.

Jika VS Code meminta, klik **Reload Window**. Setelah terpasang, **markpiw** muncul di daftar extension yang terpasang.

### 3. Buka file markdown dengan markpiw

- Klik kanan file `.md` di Explorer → **Buka dengan markpiw**, atau
- buka file `.md`, lalu klik ikon ✎ **Buka dengan markpiw** di pojok kanan atas editor, atau
- **Open With…** → **markpiw**.

Editor teks bawaan tetap menjadi default; markpiw dipakai saat Anda memilihnya.

**Ingin semua file `.md` langsung terbuka di markpiw?** Klik kanan file `.md` → **Open With…** → **Configure default editor for '\*.md'…** → **markpiw**. Atau tambahkan ini ke `settings.json`:

```json
"workbench.editorAssociations": { "*.md": "markpiw.editor" }
```

### Cara pakai singkat

| Ingin | Caranya |
|---|---|
| Heading, list, kutipan, task | Ketik `# `, `- `, `1. `, `> `, `[ ] ` di awal baris |
| Tebal, miring, kode, coret | Ketik `**teks**`, `_teks_`, `` `teks` ``, `~~teks~~`, atau pakai toolbar |
| Menu blok (tabel, code block, gambar, …) | Ketik `/` di baris kosong |
| Link | Pilih teks → Ctrl/⌘+K |
| Gambar | Tempel (paste) atau seret gambar. File disimpan ke folder `assets/` di samping file `.md` |
| Simpan, undo, redo | Ctrl/⌘+S, Ctrl/⌘+Z, Ctrl/⌘+Shift+Z (sama seperti biasa) |

Folder gambar bisa diganti lewat setting `markpiw.assetsFolder`.

### Update ke versi baru

Extension yang dipasang dari `.vsix` **tidak diperbarui otomatis**. Saat ada rilis baru, unduh `.vsix` terbaru lalu pasang lagi dengan cara yang sama (versi lama otomatis tergantikan), kemudian **Reload Window**. Versi yang terpasang terlihat di halaman extension markpiw di panel Extensions.

### Menghapus

Panel **Extensions** → markpiw → **Uninstall**.

### Jika ada masalah

- **markpiw tidak muncul di Open With.** Pastikan extension terpasang dan aktif di panel Extensions, lalu jalankan **Developer: Reload Window** (Ctrl/⌘+Shift+P).
- **Gagal memasang karena versi.** Perbarui VS Code ke 1.95 atau lebih baru (**Code → Check for Updates…**).
- **Muncul banner merah dan editor menjadi baca-saja.** Ini disengaja: ada edit yang tidak bisa disimpan sebagai markdown tanpa mengubah isi, jadi markpiw tidak menulis apa pun ke file. Klik **Muat ulang dari file** untuk melanjutkan.

Laporkan masalah lewat [Issues](https://github.com/avendisianipar/markpiw/issues). Sertakan langkah yang dilakukan, `git diff` file-nya, dan info dari tombol **Salin info diagnostik** jika ada.

---

## Memakai versi web

Versi web belum di-host; untuk sekarang dijalankan dari repo ini (lihat [Untuk pengembang](#untuk-pengembang)):

```bash
pnpm dev:web
```

Lalu buka `http://localhost:5173` di **Chrome atau Edge**. Tambahkan `?demo` di URL untuk mencoba folder contoh tanpa menyentuh file Anda. Panduan lengkap ada di [docs/manual-testing.md](docs/manual-testing.md).

---

## Untuk pengembang

Prasyarat: Node 24 dan pnpm 10 lewat Corepack.

```bash
corepack enable
pnpm install
pnpm dev:web          # web di http://localhost:5173 (tambahkan ?demo untuk folder contoh)
pnpm package:vscode   # menghasilkan apps/vscode/markpiw.vsix
```

> `zsh: command not found: pnpm`? Jalankan `corepack enable` sekali (ulangi setelah berpindah versi Node lewat nvm).

### Test

```bash
pnpm verify        # typecheck + lint + format:check + test (unit, golden, property, upstream ProseMirror)
pnpm test:e2e      # E2E web di Chrome terpasang (headless)
pnpm test:vscode   # test integrasi di VS Code terpasang (membuka jendela VS Code sementara)
```

### Merilis versi baru extension

1. Naikkan `version` di [apps/vscode/package.json](apps/vscode/package.json) (mis. `0.1.0` → `0.2.0`).
2. Pastikan semua test lulus, lalu build paketnya:

   ```bash
   pnpm verify && pnpm package:vscode
   ```

3. Buat rilis di GitHub dengan `.vsix` sebagai lampiran:

   ```bash
   gh release create v0.2.0 apps/vscode/markpiw.vsix --title "markpiw 0.2.0" --notes "Ringkasan perubahan…"
   ```

4. Umumkan ke tim agar mereka memasang ulang.

### Struktur

| Path | Isi |
|---|---|
| `vendor/prosemirror/` | 10 paket ProseMirror yang di-vendor tanpa modifikasi |
| `packages/markdown` | Parse GFM ↔ dokumen, preservasi source, serializer, guard round-trip |
| `packages/editor` | `EditorController`: plugin, perintah, input rules, slash, paste, NodeView |
| `packages/ui` | Komponen React: toolbar, slash menu, popover, tema |
| `packages/host` | Interface `FileHost` (types only) |
| `apps/web` | SPA web (folder lokal + mode demo) |
| `apps/vscode` | Extension VS Code (custom editor) |

### Dokumen

- Panduan uji manual: [docs/manual-testing.md](docs/manual-testing.md)
- Spesifikasi: [docs/superpowers/specs/2026-10-28-markpiw-design.md](docs/superpowers/specs/2026-10-28-markpiw-design.md)
- Roadmap: [docs/superpowers/plans/2026-10-28-markpiw-roadmap.md](docs/superpowers/plans/2026-10-28-markpiw-roadmap.md)

### Dependensi pihak ketiga

`THIRD_PARTY_NOTICES.txt` dibuat otomatis saat build dari modul yang benar-benar masuk bundle ([tooling/third-party.ts](tooling/third-party.ts)): di root `.vsix` dan di `dist/` versi web. Build gagal jika ada paket tanpa file lisensi. Periksa lisensinya secara manual, lalu tambahkan ke `LICENSE_OVERRIDES`.

---

## Privasi

markpiw tidak memiliki telemetri, analytics, atau server. Isi dokumen tidak pernah dikirim ke mana pun.

- **Versi web** membuka folder lewat File System Access API langsung di browser. Yang disimpan hanya di browser Anda sendiri: handle folder terakhir dan draf darurat (IndexedDB), serta tema dan state tampilan (localStorage).
- **Extension VS Code** hanya membaca dan menulis file yang Anda buka. Tema dan state tampilan disimpan di storage VS Code.
- **Gambar dari URL luar** (`![](https://…)`) dimuat langsung dari server asalnya, sama seperti preview markdown di GitHub atau VS Code. Gambar yang Anda tempel disimpan sebagai file lokal di folder `assets/`.

---

## Terima kasih

markpiw berdiri di atas karya open source berikut. Terima kasih kepada para pembuat dan kontributornya.

| Proyek | Dipakai untuk | Lisensi |
|---|---|---|
| [ProseMirror](https://prosemirror.net) oleh Marijn Haverbeke | Inti editor (di-vendor di `vendor/prosemirror`) | MIT |
| [micromark](https://github.com/micromark/micromark) dan [mdast](https://github.com/syntax-tree/mdast) oleh Titus Wormer | Parsing Markdown dan GFM | MIT |
| [React](https://react.dev) oleh Meta | Antarmuka | MIT |
| [React Aria](https://react-spectrum.adobe.com/react-aria/) oleh Adobe | Komponen UI yang aksesibel | Apache-2.0 |
| [Floating UI](https://floating-ui.com) | Posisi popover dan menu | MIT |
| [Lucide](https://lucide.dev) | Ikon | ISC |
| [Valibot](https://valibot.dev) oleh Fabian Hiller | Validasi pesan VS Code ↔ webview | MIT |
| [clsx](https://github.com/lukeed/clsx), [escape-string-regexp](https://github.com/sindresorhus/escape-string-regexp), [format](https://github.com/samsonjs/format) | Utilitas | MIT |

Dibangun dengan [TypeScript](https://www.typescriptlang.org), [Vite](https://vite.dev), [esbuild](https://esbuild.github.io), [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), dan [pnpm](https://pnpm.io).

Daftar lengkap komponen pihak ketiga beserta teks lisensinya ada di `THIRD_PARTY_NOTICES.txt` yang disertakan di setiap rilis.

---

## Lisensi

[MIT](LICENSE) © 2026 Avendi Sianipar dan kontributor markpiw.
