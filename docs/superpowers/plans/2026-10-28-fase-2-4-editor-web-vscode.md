# markpiw Fase 2–4 — Editor, Host Web, Host VS Code: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** markpiw bisa dicoba manual end-to-end: (1) SPA web yang membuka folder lokal (plus mode demo tanpa izin file), (2) extension VS Code (`.vsix`) lewat "Open With… → markpiw". Keduanya memakai editor WYSIWYG yang sama (toolbar, shortcut markdown, slash command, gambar) dan menyimpan markdown dengan preservasi source dari Fase 1.

**Architecture:** Hexagonal (spesifikasi 2.1). `@markpiw/editor` membungkus ProseMirror ter-vendor dalam `EditorController` (store snapshot + commands, tanpa React). `@markpiw/ui` adalah komponen React yang hanya membaca snapshot dan memanggil commands. `apps/web` dan `apps/vscode` mengimplementasikan `FileHost`.

**Tech Stack:** React 19, Vite 8, react-aria-components, @floating-ui/dom, lucide-react, valibot, esbuild, @vscode/vsce, playwright-core (Chrome terpasang), @vscode/test-electron (VS Code terpasang).

**Spec:** [docs/superpowers/specs/2026-10-28-markpiw-design.md](../specs/2026-10-28-markpiw-design.md) bagian 2.4–2.6, 4, 5, 6, 7, 8. Fase 1 selesai di branch `fase-1-fondasi` (lihat ledger `.superpowers/sdd/2026-10-28-fase-1-fondasi-markdown/progress.md`).

**Definisi selesai (dari pengguna, 2026-10-28):** pengguna bisa mencoba langsung di web dan di VS Code secara manual. Semua yang dibutuhkan untuk itu (build, cara menjalankan, `.vsix`, panduan uji) siap.

## Global Constraints

- Semua constraint Fase 1 tetap berlaku (Node 24, pnpm 10.8, TS ~6.0.3, SPDX header, conventional commit + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `pnpm verify` hijau di akhir setiap task).
- Dependensi baru (versi minimum): `react`/`react-dom` `^19.3`, `react-aria-components` `^1.22`, `@floating-ui/dom` `^1.8`, `lucide-react` `^1.63`, `valibot` `^1.5`, `vite` `^8.3`, `@vitejs/plugin-react` `^6.1`, `esbuild` `^0.28`, `@vscode/vsce` `^4`, `@types/vscode` `~1.95.0`, `@vscode/test-electron` `^3.1`, `playwright-core` `^1.64`.
- Aturan dependensi spesifikasi 2.3 ditegakkan lewat ESLint `no-restricted-imports` per paket: `editor` tidak mengimpor React/`ui`/API file; `ui` tidak mengimpor `vscode`/API file; `apps/web` tidak mengimpor `vscode`.
- `packages/editor` dan `packages/ui` memakai `lib: ["ES2023","DOM","DOM.Iterable"]`.
- Konten tidak tepercaya (spesifikasi 4.5): HTML mentah tidak pernah masuk DOM sebagai HTML; href hanya `http:`/`https:`/`mailto:`/relatif/`#`; src gambar hanya relatif/`https:`/`blob:`.
- Bahasa UI: Indonesia, semua teks di `packages/ui/src/strings/id.ts` (`t(key)`).
- VS Code: `engines.vscode` `^1.95.0` (VS Code tim saat ini 1.143; 1.95 memberi ruang untuk anggota yang belum update).
- Penyimpanan selalu lewat `serializeMarkdown` → `verifyRoundTrip`. Jika guard gagal: tidak menulis, editor read-only + banner.

## Review Focus

1. **Echo VS Code:** edit dari webview diterapkan ke `TextDocument`, lalu event perubahan dokumen kembali ke webview. Echo harus diabaikan (tidak me-render ulang/menggeser kursor), sedangkan undo native harus diterapkan. Test: Task 9 `vscode: echo ignored, undo applied`.
2. **Ketik cepat di VS Code:** beberapa batch edit beruntun sebelum `editsApplied` tiba tidak boleh menghasilkan `baseVersion` usang yang membuang ketikan. Test: Task 9 `vscode: rapid edits`.
3. **Autosave web saat pindah file:** perubahan tertunda di file A tersimpan ke A (bukan B) saat pengguna mengklik file B. Test: Task 7 `web host: switching files flushes pending save to the old file`.
4. **Guard gagal:** tidak ada penulisan sama sekali (web maupun VS Code) dan pengguna melihat banner dengan aksi pemulihan. Test: Task 1 `controller: guard failure blocks save and sets readOnly`.
5. **Paste HTML dari Google Docs/Word** tidak menyisipkan atribut/style/elemen asing dan tidak pernah memasukkan HTML mentah ke DOM. Test: Task 3 `paste: google docs html`.

---

## Struktur file

```
packages/editor/src/
  index.ts            API publik
  controller.ts       EditorController (state, view, store, commands, save pipeline)
  snapshot.ts         EditorSnapshot + derive dari EditorState
  commands.ts         perintah blok/mark/list/tabel/link/gambar
  external.ts         applyExternalText (diff anak tingkat atas, mapping seleksi)
  plugins/{keymap,inputrules,slash,placeholder,trailing,paste,link,table}.ts
  nodeviews/{image,task-item,code-block,raw-block}.ts
  safety.ts           validasi href/src
  test/…              vitest + jsdom
packages/ui/src/
  index.ts · strings/id.ts · theme.css
  EditorHost.tsx · hooks.ts · Toolbar.tsx · SlashMenu.tsx · LinkPopover.tsx · ImagePopover.tsx
  ReadOnlyBanner.tsx · Page.tsx · ErrorBoundary.tsx · MarkpiwEditor.tsx (komposisi semua)
  *.module.css
apps/web/
  index.html · vite.config.ts · src/{main.tsx, App.tsx, fs/*.ts, host/web-host.ts, demo/*.ts, components/*}
apps/vscode/
  package.json · src/extension.ts · src/provider.ts · src/protocol.ts · webview/{index.html, main.tsx, vscode-host.ts}
  esbuild.mjs · vite.config.ts · test/…
e2e/                  playwright-core (Chrome terpasang) untuk web demo
```

---

### Task 1: Paket `@markpiw/editor` — controller, snapshot, commands dasar

**Interfaces (Produces):**
```ts
export interface EditorStrings { placeholder: string; slash: Record<SlashItemId, { label: string; aliases: readonly string[] }> }
export type BlockTypeInfo = { type: 'paragraph' } | { type: 'heading'; level: 1|2|3|4|5|6 } | { type: 'code_block' } | { type: 'blockquote' } | { type: 'raw_block' } | { type: 'table' } | { type: 'other' };
export interface EditorSnapshot { activeMarks: ReadonlySet<MarkName>; blockType: BlockTypeInfo; listKind: 'bullet'|'ordered'|'task'|null; inTable: boolean; canUndo: boolean; canRedo: boolean; slash: SlashState|null; link: LinkState|null; image: ImageState|null; zoom: number; readOnly: boolean; readOnlyReason: string|null; dirty: boolean }
export class EditorController {
  constructor(opts: { text: string; host: FileHost; strings: EditorStrings });
  mount(el: HTMLElement): void; unmount(): void; focus(): void;
  subscribe(l: () => void): () => void; getSnapshot(): EditorSnapshot;
  readonly commands: EditorCommands;            // spesifikasi 4.1
  serialize(): Result<string, GuardFailure>;    // serializeMarkdown + verifyRoundTrip; gagal → readOnly
  applyExternalText(text: string): void;        // spesifikasi 2.5
  onDocChange(cb: () => void): Disposable;
  setReadOnly(reason: string | null): void;
}
```
- Controller membuat `EditorView` di `mount`, `destroy` di `unmount` (StrictMode: mount→unmount→mount aman; state dipertahankan di controller).
- `historyMode` dari host: `'editor'` → plugin history; `'host'` → Mod-Z/Mod-Shift-Z memanggil `host.undo?.()` / `host.redo?.()` (tambahan opsional di `FileHost`; ruling).
- Snapshot dihitung ulang setiap transaksi; referensi hanya berubah jika isi berubah (bandingkan field).
- Test (`packages/editor/test/controller.test.ts`, jsdom): mount di div; `commands.toggleMark('strong')` pada seleksi → snapshot `activeMarks` berisi strong; `setBlock({type:'heading',level:2})`; `wrapList('bullet'|'ordered'|'task')`; `insertTable(2,2)`; `insertHorizontalRule`; `undo/redo` (mode editor); `serialize()` mengembalikan markdown yang benar; `controller: guard failure blocks save and sets readOnly` (dokumen tak-representable, mis. em pada `mple.` di `example.com` → `ok:false`, snapshot.readOnly true); StrictMode double mount tidak menggandakan DOM.

### Task 2: Plugin editor — keymap, input rules, placeholder, trailing node, link, tabel

- Keymap spesifikasi 4.2 (Mod-B/I/E/Shift-X/K, Mod-Alt-0…6, Mod-Shift-7/8/9, Tab/Shift-Tab list & sel tabel, Enter list, undo/redo) + `baseKeymap`.
- Input rules: heading `#… `, `> `, bullet `- `/`* `/`+ ` (marker ke attr), ordered `1. `/`1) `, task `[ ] `/`[x] `, fence ```` ```lang ```` + Enter, `---`/`***` + Enter (hr), inline `**x**` `__x__` `*x*` `_x_` `~~x~~` `` `x` `` (delim ke attr), dan **autolink literal** (URL `http(s)://…`, `www.…`, email) saat spasi/Enter diketik — kelas (e) dari Fase 1. Backspace setelah rule → `undoInputRule`.
- Placeholder decoration "Ketik '/' untuk perintah…" pada paragraf kosong yang aktif; trailing paragraph.
- Link: Mod+klik → `host.openLink(href)` (hanya skema aman); snapshot.link saat kursor di link.
- Tabel: Tab/Shift-Tab pindah sel; commands `tableAddRow/Col`, `tableDeleteRow/Col`, `tableSetAlign`.
- Test: setiap input rule (ketik via `view.someProp('handleTextInput')`), autolink, Tab di list/sel, Enter pada item kosong keluar list, placeholder ada/tidak.

### Task 3: Slash menu, paste/drop, clipboard, NodeView, keamanan

- Slash (spesifikasi 4.2): state `{query, items, selectedIndex, anchorRect}`; ↑/↓/Enter/Tab/Esc; item: text, h1, h2, h3, bullet, ordered, task, quote, code, table, image, hr; filter label + alias ID/EN.
- Paste/drop (spesifikasi 4.3): gambar → node image `blob:` → `host.saveAsset` → ganti src relatif / hapus + notifikasi; `text/html` → `DOMParser` inert + pembersihan (Google Docs wrapper, Word `mso-*`, buang style/class/unknown) → PM DOMParser schema GFM; `text/plain` markdown-like → `parseMarkdown` slice; di code/raw → teks polos. `clipboardTextSerializer` → markdown.
- NodeView (spesifikasi 4.4): image (`host.resolveImageUrl` + cache, placeholder jika gagal), task item (checkbox), code_block (label bahasa yang bisa diedit), raw_block ("Markdown mentah · {kind}").
- `safety.ts`: `isSafeHref`, `isSafeImageSrc`.
- Notifikasi: `snapshot.notice: { kind:'error'|'info'; message } | null`.
- Test: slash filter/pilih/hapus query; `paste: google docs html` (tanpa style/id/elemen asing); paste markdown text; paste di code block; image paste memanggil saveAsset dan mengganti src; safety; NodeView task toggle.

### Task 4: `applyExternalText`

- Spesifikasi 2.5. Parse ulang; anak tingkat atas lama vs baru dibandingkan dengan `normalizeForCompare`-tanpa-srcKey… cukup: ganti **seluruh** konten dokumen dengan dokumen baru (indeks source baru konsisten), seleksi dipetakan: jika di prefix anak yang sama → posisi sama; jika di suffix → digeser selisih ukuran; selain itu → awal blok pengganti pertama. `addToHistory: false`. `parsed` diganti.
- Test: perubahan di blok B mempertahankan kursor di blok A; kursor di suffix bergeser; serialize setelah external change = teks baru (byte-identical).

### Task 5: `@markpiw/ui` — komponen React

- `EditorHost` (div kosong, `useLayoutEffect` mount/unmount, `memo`), `useEditorSnapshot(selector)` (`useSyncExternalStore`), `EditorContext`.
- `Toolbar` (React Aria `Toolbar`, `ToggleButton` `aria-pressed`, `Select`/`Menu` untuk blok/list/tabel, tooltip shortcut), `SlashMenu` (portal + `@floating-ui/dom` virtual element, listbox `aria-activedescendant`), `LinkPopover`, `ImagePopover`, `ReadOnlyBanner`, `Notice`, `Page`, `EditorErrorBoundary` (fallback source baca-saja), `MarkpiwEditor` (komposisi; props: `controller`, `actions?`, `topBar?`).
- `theme.css`: token `--mp-*` dipetakan ke `--vscode-*` dengan default terang; `--mp-zoom`; high contrast; `prefers-reduced-motion`.
- `strings/id.ts` + `t(key)`.
- Test (vitest + jsdom + react-dom/client): toolbar menekan tombol Bold memanggil command dan `aria-pressed` mengikuti snapshot; SlashMenu muncul saat snapshot.slash ada; banner read-only tampil dengan alasan.

### Task 6: `apps/web` — kerangka, halaman awal, demo

- Vite SPA, `index.html` dengan CSP meta (spesifikasi 6.6), React root.
- Halaman awal: "Buka folder" (`showDirectoryPicker({mode:'readwrite'})`), folder terakhir (IndexedDB), "Izinkan akses", pesan browser tidak didukung, dan **"Coba demo"** (folder contoh di memori; tambahan agar bisa dicoba tanpa izin file — ruling).
- Abstraksi `DirectoryLike`/`FileLike` (subset FS Access API) dengan dua implementasi: FS Access asli dan memori (demo + test).
- File tree lazy, hanya `.md` + folder berisi `.md`, abaikan `.git`, `node_modules`, folder tersembunyi.

### Task 7: `apps/web` — `WebFileHost`, autosave, konflik, aset

- `WebFileHost implements FileHost` (`historyMode:'editor'`): `readText`, `writeText` (cek konflik `lastModified`/`size`), `saveAsset` (SHA-256 → `assets/image-<8hex>.<ext>`, validasi di dalam root), `resolveImageUrl` (object URL + cache + revoke), `openLink` (`.md` relatif → buka di app; lainnya `window.open` dengan `noopener`), `persistUiState`/`restoreUiState` (localStorage per path).
- Autosave: debounce 1 dtk, saat pindah file, `visibilitychange`, Ctrl/Cmd+S; status bar (Tersimpan/Belum disimpan/Menyimpan…/Konflik/Gagal menyimpan); dialog konflik (Pakai versi saya / Muat versi disk); `beforeunload`; cek perubahan luar saat fokus + tiap 5 dtk; draf darurat IndexedDB.
- Test (vitest, FS memori): `web host: switching files flushes pending save to the old file`; konflik terdeteksi; saveAsset nama hash + dedup; path traversal ditolak; perubahan luar diterapkan saat tidak ada perubahan tertunda.
- E2E (`e2e/web.spec.ts`, playwright-core + Chrome terpasang, headless, `vite preview`): mode demo → buka file → ketik `# ` jadi heading → bold via toolbar → slash menu sisip tabel → simpan → isi file demo berubah sesuai (dibaca lewat hook `window.__markpiwDemo`).

### Task 8: `apps/vscode` — extension + webview

- `package.json` (spesifikasi 7.1): customEditor `markpiw.editor` `priority:"option"`, command `markpiw.openInMarkpiw` + tombol `editor/title`, konfigurasi `markpiw.assetsFolder`, `engines.vscode ^1.95.0`, `main: ./dist/extension.js`.
- `protocol.ts`: skema Valibot semua pesan spesifikasi 7.2 + `undo`/`redo` (ruling: webview tidak punya history; Mod-Z di webview diteruskan ke perintah native VS Code).
- Provider (`CustomTextEditorProvider`): webview options (`enableScripts`, `localResourceRoots`, `retainContextWhenHidden:false`), HTML dengan CSP + nonce, sinkronisasi spesifikasi 7.3 (versi, `expectedVersion`, echo), aset via `workspace.fs`, resolve gambar (`asWebviewUri` di dalam root), link (`vscode.openWith`/`env.openExternal`), uiState via `webview.setState`.
- Webview: `VsCodeFileHost` (`historyMode:'host'`), debounce 200 ms → serialize → guard → `diffText` → `edits`; antrean edit agar `baseVersion` selalu versi terakhir yang dikonfirmasi; `externalChange` → `applyExternalText`.
- Build: esbuild (extension, cjs, external vscode), Vite (webview, nama file tetap `webview.js`/`webview.css`, tanpa code splitting), `vsce package --no-dependencies` → `apps/vscode/markpiw-<versi>.vsix`. `LICENSE` proprietary + `THIRD_PARTY_NOTICES.txt` (lisensi MIT ProseMirror & dependensi yang dibundel) ikut di `.vsix`.

### Task 9: Test integrasi VS Code

- `@vscode/test-electron` dengan `vscodeExecutablePath` = VS Code terpasang (`/Applications/Visual Studio Code.app/...`), profil & folder ekstensi sementara, workspace fixture.
- Test: buka `.md` dengan `markpiw.editor`; webview `ready` → `init`; simulasi pesan `edits` dari sisi test (lewat command test-only `markpiw._test.postFromWebview`) → `TextDocument` berubah; `vscode: echo ignored, undo applied`; `vscode: rapid edits` (3 batch beruntun berbasis versi terkonfirmasi); `baseVersion` usang → `externalChange`; aset ditulis ke `assets/`.

### Task 10: Panduan uji manual + verifikasi akhir

- `docs/manual-testing.md`: cara menjalankan web (`pnpm --filter @markpiw/web dev` / `build` + `preview`), mode demo, membuka folder nyata di Chrome/Edge, memasang `.vsix` (`code --install-extension` atau Extensions → … → Install from VSIX), "Open With… → markpiw", checklist skenario uji (format, list, tabel, gambar paste, slash, undo, konflik, file CRLF, guard read-only).
- README diperbarui.
- `pnpm verify` + E2E web + test VS Code hijau; uji manual singkat di browser pane (mode demo).

---

## Kriteria selesai Fase 2–4

- `pnpm verify` lulus; E2E web (Chrome) dan test integrasi VS Code lulus.
- `apps/web` bisa dijalankan dan dibuild; mode demo dan buka folder nyata berfungsi di Chrome/Edge.
- `.vsix` terbangun dan bisa dipasang; "Open With… → markpiw" membuka editor; edit tersimpan via save native.
- `docs/manual-testing.md` siap untuk pengguna.
