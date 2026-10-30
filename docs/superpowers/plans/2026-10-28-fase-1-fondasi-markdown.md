# markpiw Fase 1 — Fondasi & Lapisan Markdown: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun monorepo markpiw dengan ProseMirror yang di-vendor (test upstream hijau), paket tipe `@markpiw/host`, dan paket `@markpiw/markdown`. Paket markdown harus bisa mem-parse GFM menjadi dokumen ProseMirror lalu menyerialisasinya kembali dengan preservasi source: file yang tidak diedit identik byte-per-byte, dan yang diedit hanya berubah di blok yang disentuh.

**Architecture:** Monorepo pnpm. Sepuluh paket ProseMirror disalin utuh dari tag kanonik ke `vendor/prosemirror/` dan dikonsumsi lewat alias source (TS `paths` + project reference untuk tipe, alias Vite/Vitest untuk runtime), tanpa build step. `@markpiw/markdown` memetakan mdast (micromark) ke schema GFM sendiri. Setiap blok mencatat entri di indeks source (baris asli, separator, kontribusi prefix). Serializer menyalin baris asli untuk node yang tidak berubah dan konteksnya stabil, dan hanya menulis ulang sisanya.

**Tech Stack:** TypeScript 6.0, pnpm 10 workspaces, Vitest 5, fast-check 4, ESLint 10 + typescript-eslint 8, Prettier 3, micromark/mdast-util-*, ProseMirror (vendor).

**Spec:** [docs/superpowers/specs/2026-10-28-markpiw-design.md](../specs/2026-10-28-markpiw-design.md). Bagian yang diimplementasikan di fase ini: 2.1–2.3, 2.6 (tipe saja), 3 (seluruhnya), 9 (vendor & lisensi, kecuali `THIRD_PARTY_NOTICES`/SBOM/CI yang masuk Fase 5), 10, dan 11 (baris golden, edit tertarget, properti, escape, vendor, performa parse/serialize).

## Global Constraints

- Runtime & tooling: Node `24` (`.nvmrc`); `"packageManager": "pnpm@10.8.0"`; TypeScript `~6.0.3` (typescript-eslint 8.72 mensyaratkan `<6.1.0`); Vitest `^5.0.5`; ESLint `^10`; typescript-eslint `^8.72.1`; Prettier `^3.9`; fast-check `^4.10.2`; jsdom `^30`.
- Parser (npm, versi dipin lewat lockfile): `mdast-util-from-markdown@^2.1.0`, `mdast-util-gfm@^3.1.0`, `micromark-extension-gfm@^3.0.0`, `micromark-extension-frontmatter@^2.0.0`, `mdast-util-frontmatter@^2.0.1`, `@types/mdast@^4.0.4`.
- ProseMirror yang di-vendor (sumber **wajib** `https://code.haverbeke.berlin/prosemirror/<pkg>.git`; mirror GitHub sudah usang, jangan dipakai):

  | Paket | Versi/tag | SHA tag |
  |---|---|---|
  | prosemirror-model | 1.25.12 | f08d53472df626b42d7127410a6d5e582b132106 |
  | prosemirror-transform | 1.12.4 | f508fe75e2ba3fd0d781d02c44c4b05921b20f0e |
  | prosemirror-state | 1.4.4 | 74c661d5d6b9223b59f2bb8bd7adf7b81743178d |
  | prosemirror-view | 1.42.8 | debcf76357a3a269174e497a4d5b893a56ade0e5 |
  | prosemirror-history | 1.5.1 | 5df04abacd82c874d76561581d6e7c5114573fc3 |
  | prosemirror-inputrules | 1.5.1 | 68eaa84fff2d75f0e779d2bb030f8ca23903b379 |
  | prosemirror-keymap | 1.2.3 | ea367f60104f622776829ea25323e6cf344d1e98 |
  | prosemirror-commands | 1.7.2 | 8bc82f806639b30dd7b6d87b49a72a168a79dc80 |
  | prosemirror-schema-list | 1.5.1 | 2dbb7b05c806a3d71f689f989d03a685e1197caa |
  | prosemirror-gapcursor | 1.4.1 | c70905345ff9fe64c0d1f28563c076137108ce9f |

  SHA di tabel adalah hasil `git ls-remote` untuk ref tag. Jika tag-nya annotated, `import.mjs` memakai commit yang ditunjuk tag tersebut dan mencatat keduanya di `VENDOR.md`.
- Dependensi runtime ProseMirror (npm, tidak di-vendor): `orderedmap@^2.1.1`, `w3c-keyname@^2.2.8`, `rope-sequence@^1.3.4`.
- **File di bawah `vendor/prosemirror/<pkg>/` tidak boleh diubah**, selain `VENDOR.md` yang dibuat skrip impor. Perubahan hanya boleh lewat `vendor/prosemirror/patches/` (target: nol patch).
- Dilarang menambah dependensi: `@tiptap/*`, `tiptap*`, `ckeditor*`, `@ckeditor/*`, `@blocknote/*`, `lexical`, `@lexical/*`, `slate*`, `quill*`, `@milkdown/*`, dan paket npm `prosemirror-*` sebagai dependensi runtime di `packages/*`. Pengecualian, hanya sebagai devDependency vendor untuk test: `prosemirror-test-builder`, `prosemirror-schema-basic`.
- TypeScript (`tooling/tsconfig.base.json`): `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `module: "esnext"`, `moduleResolution: "bundler"`, `target: "es2022"`, `composite`, `declaration`, `types: []` (tetapkan eksplisit per paket). Vendor memakai `tsconfig` sendiri yang longgar sesuai kebutuhan upstream.
- `packages/markdown` memakai `lib: ["ES2023", "DOM"]` hanya untuk tipe. ESLint `no-restricted-globals` melarang `document`, `window`, `navigator`, `localStorage`, `DOMParser` di `packages/markdown/src/**`.
- Aturan impor (ESLint `no-restricted-imports` per direktori): `packages/host` tidak mengimpor apa pun; `packages/markdown/src` hanya boleh mengimpor `@markpiw/host`, `prosemirror-model`, `prosemirror-transform`, `mdast*`, `micromark*`, dan modul relatif (termasuk dilarang `node:*`). File test boleh mengimpor `node:*`, `vitest`, dan `fast-check`.
- Setiap file source/test milik proyek (`.ts`, `.mjs`, `.js` di luar `vendor/prosemirror/<pkg>/`) diawali `// SPDX-License-Identifier: MIT`.
- `.gitattributes`: `* text=auto eol=lf`, `fixtures/** -text` (agar fixture CRLF/BOM tetap byte-exact), dan `vendor/prosemirror/** -text`.
- Pesan commit berformat conventional (`feat:`, `test:`, `chore:`, `docs:`, `vendor:`). Akhiri setiap pesan commit dengan baris `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **`pnpm verify` wajib lulus di akhir setiap task.** Isinya: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test`.

## Review Focus

1. **Indentasi list memakai tab** (`-\ta`). Mengedit satu item harus hanya mengubah baris item itu, dan hasilnya lulus guard. Test: Task 9, `edit: list with tab indentation`.
2. **Line ending campuran (CRLF + LF) dalam satu file.** Baris yang tidak disentuh mempertahankan line ending aslinya, dan baris yang ditulis ulang memakai `profile.eol`. Test: Task 9, `edit: mixed line endings`.
3. **Karakter non-BMP (emoji) dan CJK di `diffText`.** Rentang perubahan tidak boleh membelah surrogate pair. Test: Task 10, `diffText never splits surrogate pairs`.
4. **Komentar HTML inline di paragraf** (`<!-- TODO -->`), yang umum di dokumentasi. Saat paragrafnya diedit, komentar tetap utuh dan tidak di-escape. Test: Task 9, `edit: paragraph with inline html comment`.
5. **Dokumen besar (5.000 baris).** Parse + serialize tanpa edit tetap cepat. Test: Task 10, `performance: 5000-line document`, dengan batas regresi 1.000 ms (target produk < 500 ms untuk membuka file diukur di Fase 2).

---

## Struktur file Fase 1

```
markpiw/
├─ .gitattributes · .gitignore · .nvmrc · .prettierrc.json · .prettierignore
├─ package.json · pnpm-workspace.yaml · tsconfig.json (solution) · eslint.config.js · vitest.config.ts
├─ tooling/
│  ├─ tsconfig.base.json
│  ├─ vendor-aliases.ts           alias nama paket prosemirror-* → vendor src
│  └─ vendor/
│     ├─ packages.json            daftar 10 paket + versi + SHA tag
│     ├─ import.mjs               impor satu paket dari tag kanonik
│     ├─ apply-patches.mjs        terapkan vendor/prosemirror/patches/*.patch
│     └─ check-drift.mjs          bandingkan versi vendor vs npm latest
├─ vendor/prosemirror/
│  ├─ package.json · tsconfig.json · vitest.config.ts · test-exclusions.json · patches/.gitkeep
│  └─ prosemirror-<pkg>/          src/ test/ style/ LICENSE CHANGELOG.md README.md package.json VENDOR.md
├─ packages/host/                 src/index.ts · test/types.test.ts
├─ packages/markdown/
│  ├─ src/
│  │  ├─ index.ts                 API publik
│  │  ├─ types.ts                 nama node/mark, SrcKey, Profile, SourceEntry, SourceIndex, ParsedDoc, GuardFailure
│  │  ├─ schema.ts                schema GFM
│  │  ├─ lines.ts                 utilitas offset baris
│  │  ├─ mdast.ts                 text → mdast (ekstensi GFM + frontmatter)
│  │  ├─ build.ts                 mdast → dokumen PM + pengisian indeks
│  │  ├─ source-index.ts          implementasi SourceIndex
│  │  ├─ profile.ts               deteksi profil gaya
│  │  ├─ parse.ts                 parseMarkdown
│  │  ├─ serialize/
│  │  │  ├─ serialize.ts          serializeMarkdown, keputusan verbatim, separator
│  │  │  ├─ context.ts            Ctx & kontribusi prefix container
│  │  │  ├─ blocks.ts             serialisasi ulang blok
│  │  │  ├─ table.ts              serialisasi tabel
│  │  │  ├─ inline.ts             serialisasi inline + mark
│  │  │  └─ escape.ts             escape minimal
│  │  ├─ normalize.ts             normalisasi semantik (dipakai guard & escape)
│  │  ├─ guard.ts                 verifyRoundTrip
│  │  └─ diff.ts                  diffText
│  └─ test/ (helpers.ts, *.test.ts)
├─ fixtures/markdown-corpus/
│  ├─ README.md
│  └─ gfm/*.md                    fixture GFM tulisan tangan (lihat Task 7)
└─ docs/adr/0001…0004-*.md
```

---

### Task 1: Kerangka monorepo, tooling, dan `@markpiw/host`

**Files:**
- Create: `.gitattributes`, `.gitignore` (`node_modules`, `dist`, `.types`, `coverage`, `*.tsbuildinfo`), `.nvmrc`, `.prettierrc.json`, `.prettierignore` (`vendor/prosemirror/prosemirror-*`, `fixtures`, `pnpm-lock.yaml`), `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `tooling/tsconfig.base.json`, `eslint.config.js`, `vitest.config.ts`, `README.md`
- Create: `packages/host/package.json`, `packages/host/tsconfig.json`, `packages/host/vitest.config.ts`, `packages/host/src/index.ts`
- Create: `docs/adr/0003-undo-native-vscode.md`, `docs/adr/0004-target-chromium.md`
- Test: `packages/host/test/types.test.ts`

**Interfaces:**
- Produces (`@markpiw/host`, types only, persis seperti spec 2.6):
  ```ts
  export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
  export interface TextChange { from: number; to: number; insert: string } // offset UTF-16 pada teks lama
  export interface HostError { code: 'permission' | 'conflict' | 'not-found' | 'io' | 'invalid-path'; message: string }
  export interface Disposable { dispose(): void }
  export interface UiState { zoom: number; scrollTop: number; selection: { anchor: number; head: number } | null }
  export interface FileHost { /* anggota persis spec 2.6 */ }
  ```
- Produces (root scripts): `typecheck` = `tsc -b`, `lint` = `eslint .`, `format:check` = `prettier --check .`, `format` = `prettier --write .`, `test` = `vitest run`, `verify` = keempatnya berurutan.

- [ ] **Step 1: `git init`, buat file root.** `pnpm-workspace.yaml` berisi `packages: ["vendor/prosemirror", "packages/*", "apps/*"]`. Root `package.json`: `private: true`, `type: "module"`, `engines.node: ">=24"`, `packageManager`, script di atas, devDependencies tooling dari Global Constraints. `vitest.config.ts` root: `test.projects: ["packages/*"]` (vendor ditambahkan di Task 3). `tsconfig.json` root: `files: []`, `references: [{ "path": "packages/host" }]`. Buat juga kerangka `packages/host/package.json` (`name: "@markpiw/host"`, `exports: { ".": "./src/index.ts" }`, `types: "./src/index.ts"`), `packages/host/tsconfig.json`, dan `packages/host/vitest.config.ts` (`typecheck.enabled: true`). `src/index.ts` belum dibuat. ADR 0003 dan 0004 berisi konteks–keputusan–konsekuensi dari spec D14 dan D11 (masing-masing ≤ 1 halaman).

- [ ] **Step 2: Tulis test tipe yang gagal**

```ts
// packages/host/test/types.test.ts
import { describe, expectTypeOf, it } from 'vitest';
import type { FileHost, Result, TextChange, HostError } from '@markpiw/host';

describe('@markpiw/host types', () => {
  it('Result is a discriminated union', () => {
    const r = { ok: false, error: { code: 'io', message: 'x' } } as Result<string, HostError>;
    if (!r.ok) expectTypeOf(r.error.code).toEqualTypeOf<HostError['code']>();
  });
  it('TextChange has from/to/insert', () => {
    expectTypeOf<TextChange>().toEqualTypeOf<{ from: number; to: number; insert: string }>();
  });
  it('FileHost.historyMode is editor | host', () => {
    expectTypeOf<FileHost['historyMode']>().toEqualTypeOf<'editor' | 'host'>();
  });
});
```

- [ ] **Step 3: Jalankan, pastikan gagal.** Run: `pnpm install && pnpm --filter @markpiw/host exec vitest run --typecheck`. Expected: FAIL karena modul `@markpiw/host` tidak ditemukan.

- [ ] **Step 4: Implementasikan `packages/host/src/index.ts`** dengan tipe di blok Interfaces.

- [ ] **Step 5: Jalankan, pastikan lulus.** Run: `pnpm --filter @markpiw/host exec vitest run --typecheck`. Expected: PASS (3 test).

- [ ] **Step 6: `pnpm verify`.** Expected: semua lulus.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo tooling and @markpiw/host types"
```

---

### Task 2: Vendor 10 paket ProseMirror + typecheck vendor

**Files:**
- Create: `tooling/vendor/packages.json`, `tooling/vendor/import.mjs`, `tooling/vendor-aliases.ts`
- Create: `vendor/prosemirror/package.json`, `vendor/prosemirror/tsconfig.json`, `vendor/prosemirror/patches/.gitkeep`
- Create (oleh skrip): `vendor/prosemirror/prosemirror-<pkg>/**` + `VENDOR.md`
- Create: `docs/adr/0001-vendor-prosemirror.md`
- Modify: `tooling/tsconfig.base.json` (tambah `paths`), `tsconfig.json` root (tambah reference vendor)

**Interfaces:**
- Produces: `tooling/vendor-aliases.ts` mengekspor `export const prosemirrorAliases: Record<string, string>`, berisi nama paket → path absolut `vendor/prosemirror/<pkg>/src/index.ts` untuk ke-10 paket. Dipakai oleh setiap `vitest.config.ts` lewat `resolve.alias`.
- Produces: tiap konsumen TS mengimpor `prosemirror-model` dan kawan-kawan dengan nama aslinya. Tipe di-resolve lewat `paths` + project reference ke `vendor/prosemirror`, yang mengeluarkan deklarasi ke `vendor/prosemirror/.types/`.
- Produces: `node tooling/vendor/import.mjs <pkg>` (membaca versi/SHA dari `packages.json`).

- [ ] **Step 1: Tulis `tooling/vendor/packages.json`** berisi 10 entri `{ name, version, tagSha }` dari tabel Global Constraints.

- [ ] **Step 2: Implementasikan `import.mjs <pkg>`.**
  1. `git clone --depth 1 --branch <version> https://code.haverbeke.berlin/prosemirror/<pkg>.git` ke direktori temp.
  2. Verifikasi `git rev-parse HEAD` (commit) dan catat SHA tag.
  3. Hapus lalu salin ulang `src/`, `test/`, `style/` (jika ada), `LICENSE`, `CHANGELOG.md`, `README.md`, dan `package.json` ke `vendor/prosemirror/<pkg>/`.
  4. Tulis `VENDOR.md`: URL upstream, versi, SHA tag, SHA commit, tanggal impor, "Patches: none", pemilik "markpiw maintainers", SLA "≤ 3 bulan setelah rilis minor upstream".
  5. Gagal dengan pesan jelas jika versi di `packages.json` tidak cocok dengan `version` di `package.json` upstream.

- [ ] **Step 3: Impor ke-10 paket, satu commit per paket.**

```bash
for p in prosemirror-model prosemirror-transform prosemirror-state prosemirror-view prosemirror-history prosemirror-inputrules prosemirror-keymap prosemirror-commands prosemirror-schema-list prosemirror-gapcursor; do
  node tooling/vendor/import.mjs "$p" && git add "vendor/prosemirror/$p" && \
  git commit -m "vendor: import $p@$(node -p "require('./vendor/prosemirror/$p/package.json').version")" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
done
```

  Expected: 10 commit dan 10 direktori yang masing-masing berisi `src/` dan `LICENSE`.

- [ ] **Step 4: Buat `vendor/prosemirror/package.json`** (milik kita): `name: "@markpiw/vendor-prosemirror"`, `private: true`, `type: "module"`, dependencies `orderedmap`, `w3c-keyname`, `rope-sequence`, devDependencies `ist@^1.1.7`, `jsdom`, `prosemirror-test-builder@^1.1.1`, `prosemirror-schema-basic@^1.2.5`.

  Buat juga `vendor/prosemirror/tsconfig.json`:
  - `composite: true`, `emitDeclarationOnly: true`, `outDir: ".types"`, `rootDir: "."`
  - `include: ["prosemirror-*/src/**/*.ts"]`
  - `paths` silang antar-paket ke `./prosemirror-*/src/index.ts`
  - `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `strict: true`, `skipLibCheck: true`

  Opsi yang tidak lolos pada source upstream boleh dilonggarkan **di tsconfig ini saja**, dengan komentar yang menyebut alasannya. Source upstream tidak boleh diubah.

- [ ] **Step 5: Tambah `paths` ke `tooling/tsconfig.base.json`** (10 nama → `../vendor/prosemirror/<pkg>/src/index.ts`) dan reference `vendor/prosemirror` ke root `tsconfig.json`. Tulis `tooling/vendor-aliases.ts`.

- [ ] **Step 6: Verifikasi.** Run: `pnpm install && pnpm tsc -b vendor/prosemirror`. Expected: exit 0 dan `vendor/prosemirror/.types/prosemirror-model/src/index.d.ts` ada.

- [ ] **Step 7: Tulis ADR 0001**: konteks dari analisis build vs fork, keputusan vendor 10 paket tanpa modifikasi, konsekuensi berupa SLA sinkronisasi dan patch queue. Jalankan `pnpm verify`, lalu commit:

```bash
git add -A
git commit -m "chore: wire vendored prosemirror into workspace (aliases, tsconfig, ADR 0001)"
```

---

### Task 3: Test upstream (non-browser) di Vitest + skrip pemeliharaan vendor

**Files:**
- Create: `vendor/prosemirror/vitest.config.ts`, `vendor/prosemirror/test-exclusions.json`
- Create: `tooling/vendor/apply-patches.mjs`, `tooling/vendor/check-drift.mjs`
- Modify: `vitest.config.ts` root (`projects` ditambah `"vendor/prosemirror"`), root `package.json` (script `vendor:patch`, `vendor:drift`)
- Test: `vendor/prosemirror/prosemirror-*/test/test-*.ts` (upstream, tidak diubah)

**Interfaces:**
- Produces: `pnpm vendor:drift` mencetak tabel `paket | vendor | npm latest | status` dan keluar dengan kode 1 jika ada paket yang tertinggal satu rilis minor atau lebih. `pnpm vendor:patch` menerapkan `vendor/prosemirror/patches/*.patch` berurutan nama dengan `git apply --check` lalu `git apply`; tanpa patch, skrip ini no-op dengan exit 0.

- [ ] **Step 1: Konfigurasi `vendor/prosemirror/vitest.config.ts`.**
  - `test.include: ["prosemirror-*/test/test-*.ts"]`. Pola `webtest-*` (browser) sengaja tidak disertakan; Fase 2 yang menanganinya.
  - `test.globals: true`, karena upstream memakai `describe`/`it` global.
  - `resolve.alias: prosemirrorAliases`.
  - `server.deps.inline: [/prosemirror-/]`, supaya `prosemirror-test-builder`/`schema-basic` dari npm ikut memakai salinan vendor.
  - `test.exclude` membaca `test-exclusions.json`.

- [ ] **Step 2: Jalankan.** Run: `pnpm --filter @markpiw/vendor-prosemirror exec vitest run`. Expected awal: sebagian besar lulus.

  File yang gagal **karena perbedaan harness**, bukan karena perilaku (misalnya butuh DOM penuh atau API runner `@marijn/testtool`), dimasukkan ke `test-exclusions.json` sebagai `{ file, reason }`. Kegagalan perilaku **tidak boleh** dikecualikan; laporkan sebagai blocker.

- [ ] **Step 3: Pastikan lulus.** Run perintah yang sama. Expected: PASS, dan setiap entri di `test-exclusions.json` punya `reason`.

- [ ] **Step 4: Implementasikan `apply-patches.mjs` dan `check-drift.mjs`** (memakai `npm view <pkg> version`). Run: `pnpm vendor:patch && pnpm vendor:drift`. Expected: tidak ada patch, dan drift `up-to-date` untuk ke-10 paket (atau daftar paket yang tertinggal, exit 1, jika upstream sudah merilis versi baru; ini benar dan bukan kegagalan task).

- [ ] **Step 5: `pnpm verify`, lalu commit**

```bash
git add -A
git commit -m "test: run vendored prosemirror upstream tests in vitest; add vendor patch/drift scripts"
```

---

### Task 4: `@markpiw/markdown` — tipe dan schema

**Files:**
- Create: `packages/markdown/package.json` (`@markpiw/markdown`, `exports: { ".": "./src/index.ts" }`, deps parser + `@markpiw/host: "workspace:*"`, devDeps `@types/node`, `fast-check`), `tsconfig.json` (`lib: ["ES2023","DOM"]`, `types: ["node"]`, `include: ["src","test"]`, references `../host` + `../../vendor/prosemirror`), `vitest.config.ts` (alias vendor)
- Create: `packages/markdown/src/types.ts`, `packages/markdown/src/schema.ts`, `packages/markdown/src/index.ts`
- Modify: root `tsconfig.json` (reference `packages/markdown`), `eslint.config.js` (aturan global DOM + impor)
- Test: `packages/markdown/test/schema.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type BlockNodeName = 'paragraph' | 'heading' | 'blockquote' | 'bullet_list' | 'ordered_list'
    | 'list_item' | 'code_block' | 'table' | 'table_row' | 'table_cell' | 'horizontal_rule' | 'raw_block';
  export type InlineNodeName = 'text' | 'image' | 'hard_break' | 'soft_break' | 'raw_inline';
  export type NodeName = 'doc' | BlockNodeName | InlineNodeName;
  export type MarkName = 'strong' | 'em' | 'strike' | 'code' | 'link';
  export type SrcKey = number & { readonly __brand: 'SrcKey' };
  export interface Contribution { readonly first: string; readonly rest: string }
  export interface Profile {
    bulletMarker: '-' | '*' | '+'; emDelim: '*' | '_'; strongDelim: '**' | '__'; fence: '```' | '~~~';
    headingStyle: 'atx' | 'setext'; listIndent: 'marker+1' | number; orderedNumbering: 'increment' | 'same';
    tablePadding: 'compact' | 'aligned'; eol: '\n' | '\r\n'; finalNewline: boolean; bom: boolean;
  }
  export interface SourceEntry {
    readonly key: SrcKey;
    readonly node: Node;                       // prosemirror-model Node hasil parse
    readonly text: string;                     // baris-baris utuh (dengan prefix container), tanpa terminator baris terakhir
    readonly prevKey: SrcKey | null;           // saudara sebelumnya di source; null jika anak pertama
    readonly sepBefore: string;                // teks source antara akhir `text` saudara sebelumnya dan awal `text` ini
    readonly isLast: boolean;                  // anak terakhir parent-nya di source
    readonly contribution: Contribution | null; // blockquote & list_item: prefix yang ditambahkan ke anak-anaknya
    readonly listNumber: number | null;        // list_item dalam ordered_list: nomor di source
    readonly tableLines: readonly string[] | null; // table: baris header, delimiter, dan body (tanpa prefix container)
    readonly tableAligned: boolean;            // table: semua baris source sama panjang
  }
  export interface SourceIndex { get(key: SrcKey): SourceEntry | undefined; readonly leading: string; readonly trailing: string; readonly size: number }
  export interface ParsedDoc { readonly doc: Node; readonly index: SourceIndex; readonly profile: Profile }
  export interface GuardFailure { readonly path: readonly number[]; readonly expected: string; readonly actual: string }
  ```
- Produces (`schema.ts`): `export const schema: Schema<NodeName, MarkName>`. Node, atribut, dan default sesuai spec 3.2 dengan ketentuan berikut:
  - Atribut gaya bernilai `null` artinya "pakai profil": `bullet_list.marker`, `heading.style`, `code_block.fence`, `code_block.fenceLength`, `horizontal_rule.marker`, `strong.delim`, `em.delim`. `hard_break.style` default `'backslash'`.
  - `srcKey` default `null` pada paragraph, heading, blockquote, bullet_list, ordered_list, list_item, code_block, table, horizontal_rule, raw_block.
  - `list_item.content = "paragraph block*"`.
  - `soft_break`: inline, atom, `leafText: () => ' '`, `toDOM: () => ['span', { class: 'mp-soft-break' }, ' ']`.
  - Mark `link`: attrs `href`, `title` (default `null`), `kind` (default `'inline'`), `refLabel` (default `null`; `''` = collapsed `[t][]`; `null` + `kind:'reference'` = shortcut `[t]`).
  - Setiap node dan mark punya `toDOM` dan `parseDOM` sederhana (data saja, tanpa global DOM).

- [ ] **Step 1: Tulis test yang gagal**

```ts
// packages/markdown/test/schema.test.ts
import { describe, expect, it } from 'vitest';
import { schema } from '../src/schema';

describe('schema', () => {
  it('declares exactly the GFM node and mark names', () => {
    expect(Object.keys(schema.nodes).sort()).toEqual([
      'blockquote','bullet_list','code_block','doc','hard_break','heading','horizontal_rule','image',
      'list_item','ordered_list','paragraph','raw_block','raw_inline','soft_break','table','table_cell',
      'table_row','text',
    ]);
    expect(Object.keys(schema.marks).sort()).toEqual(['code','em','link','strike','strong']);
  });
  it('style attrs default to null (use profile) and srcKey defaults to null', () => {
    const list = schema.nodes.bullet_list.create(null, schema.nodes.list_item.create(null, schema.nodes.paragraph.create()));
    expect(list.attrs).toMatchObject({ marker: null, tight: true, srcKey: null });
    expect(schema.marks.em.create().attrs).toEqual({ delim: null });
    expect(schema.nodes.hard_break.create().attrs).toEqual({ style: 'backslash' });
  });
  it('list_item must start with a paragraph', () => {
    expect(() => schema.nodes.list_item.createChecked(null, schema.nodes.code_block.create())).toThrow();
  });
  it('soft_break reads as a space', () => {
    expect(schema.nodes.soft_break.spec.leafText?.(schema.nodes.soft_break.create())).toBe(' ');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/schema.test.ts`. Expected: FAIL (`../src/schema` tidak ada).
- [ ] **Step 3: Implementasikan `types.ts`, `schema.ts`, dan `index.ts`** (ekspor tipe + `schema`). `bullet_list.tight` dan `ordered_list.tight` default `true`; `ordered_list` default `start: 1`, `delimiter: '.'`.
- [ ] **Step 4: Run test yang sama.** Expected: PASS (4 test).
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): add GFM schema and core types`.

---

### Task 5: `parseMarkdown` — pemetaan mdast → dokumen

**Files:**
- Create: `packages/markdown/src/lines.ts`, `src/mdast.ts`, `src/build.ts`, `src/parse.ts`
- Modify: `src/index.ts` (ekspor `parseMarkdown`)
- Test: `packages/markdown/test/parse.test.ts`

**Interfaces:**
- Consumes: `schema`, tipe dari Task 4.
- Produces:
  - `parseMarkdown(text: string): ParsedDoc` di `parse.ts`. Di task ini `index` dan `profile` boleh berupa stub (indeks kosong, profil default); keduanya diisi di Task 6.
  - `toMdast(text: string): Root` di `mdast.ts`, memakai `fromMarkdown(text, { extensions: [gfm(), frontmatter(['yaml'])], mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(['yaml'])] })`.
  - `class LineIndex { constructor(text: string); lineStart(offset: number): number; lineEnd(offset: number): number }` di `lines.ts`. `lineEnd` adalah offset sebelum `\r\n`/`\n`.
  - `buildDoc(text: string, root: Root): Node` di `build.ts`. Task 6 memperluasnya agar juga mengisi indeks.

**Aturan pemetaan** (selain yang jelas dari nama di spec 3.2):
- **BOM:** jika `text` diawali `\uFEFF`, BOM dibuang sebelum parse. Semua offset relatif terhadap teks tanpa BOM.
- `heading.style = 'setext'` jika karakter source pada posisi awal node bukan `#`.
- `bullet_list.marker` = karakter source di awal item pertama. `ordered_list.delimiter` = karakter setelah digit item pertama. `start = list.start ?? 1`.
- `tight = !(list.spread || items.some(i => i.spread))`. `list_item.checked = item.checked ?? null`. Item tanpa anak → `[paragraph()]`.
- **List item yang anak pertamanya bukan `paragraph`** → seluruh node mdast tingkat atas yang memuatnya menjadi `raw_block` dengan `kind: 'unknown'`. Teksnya = slice source dari awal baris node tingkat atas sampai akhir baris terakhirnya.
- `code`: `lang` = info string utuh (`node.lang` + `' ' + node.meta` jika ada). `fence` = `'```'` jika source diawali backtick, `'~~~'` jika tilde, selain itu `'indented'`. `fenceLength` = panjang deret fence pembuka.
- `thematicBreak` → `horizontal_rule.marker` = slice source node, di-trim.
- `table` → `table.align = node.align`. Baris pertama memakai `table_cell.header = true`.
- **Blok mentah:** `html` → `raw_block kind 'html'`, `yaml` → `kind 'frontmatter'`, `definition` → `kind 'definition'`, `footnoteDefinition` → `kind 'footnote'`, tipe lain yang tidak dikenal → `kind 'unknown'`.
  - Teks raw tingkat atas = slice source persis dari `position.start.offset` sampai `position.end.offset`.
  - Untuk raw di dalam container, pakai `node.value` jika ada. Jika tidak, pakai slice dengan prefix lanjutan (`ctx.rest`) dibuang dari baris kedua dan seterusnya.
- **Inline:**
  - `text` → text. Setiap `\n` di dalam text dipecah menjadi `soft_break`.
  - `emphasis` → mark `em`, `delim` = karakter source di awal. `strong` → `delim` dua karakter. `delete` → `strike`. `inlineCode` → text dengan mark `code`.
  - `break` → `hard_break.style = 'backslash'` jika karakter source sebelum line ending adalah `\`, selain itu `'spaces'`.
  - `link`:
    - `kind 'autolink'` jika source diawali `<`.
    - `kind 'literal'` jika source tidak diawali `[` dan bukan `<`.
    - Selain itu `'inline'`.
  - `linkReference` → `kind 'reference'`, href/title dari definisi yang cocok (`identifier`), dan `refLabel`:
    - `full` → `node.label`
    - `collapsed` → `''`
    - `shortcut` → `null`
  - `image` → node `image`.
  - `imageReference`, `html` inline, `footnoteReference` → `raw_inline` dengan `source` = slice source.
- **Ketahanan:** konversi setiap node mdast tingkat atas dibungkus `try/catch`. Jika gagal, node itu menjadi `raw_block kind 'unknown'` dengan slice source-nya.
- **Teks kosong atau hanya whitespace** → `doc(paragraph())`.

- [ ] **Step 1: Tulis test yang gagal** (`parse.test.ts`). Setiap kasus memeriksa struktur lewat `doc.toString()` dan atribut lewat `doc.child(i).attrs`:

```ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../src';

const d = (md: string) => parseMarkdown(md).doc;

describe('parseMarkdown structure', () => {
  it('maps headings with style', () => {
    expect(d('# A\n').child(0).attrs).toMatchObject({ level: 1, style: 'atx' });
    expect(d('B\n===\n').child(0).attrs).toMatchObject({ level: 1, style: 'setext' });
  });
  it('maps lists with marker, tightness and task state', () => {
    const list = d('* a\n* [x] b\n').child(0);
    expect(list.attrs).toMatchObject({ marker: '*', tight: true });
    expect(list.child(1).attrs.checked).toBe(true);
    expect(d('3) a\n4) b\n').child(0).attrs).toMatchObject({ start: 3, delimiter: ')' });
    expect(d('- a\n\n- b\n').child(0).attrs.tight).toBe(false);
  });
  it('keeps soft breaks and hard break style', () => {
    expect(d('a\nb\n').toString()).toBe('doc(paragraph("a", soft_break, "b"))');
    expect(d('a\\\nb\n').child(0).child(1).attrs.style).toBe('backslash');
    expect(d('a  \nb\n').child(0).child(1).attrs.style).toBe('spaces');
  });
  it('records emphasis delimiters and link kinds', () => {
    const p = d('_a_ **b** [c](u) <https://x> www.y.com [r][l] [s]\n\n[l]: https://l\n[s]: https://s\n').child(0);
    const marks = (i: number) => p.child(i).marks.map((m) => [m.type.name, m.attrs]);
    expect(marks(0)).toEqual([['em', { delim: '_' }]]);
    expect(p.textContent).toContain('www.y.com');
    const kinds: string[] = [];
    p.forEach((n) => n.marks.forEach((m) => { if (m.type.name === 'link') kinds.push(`${m.attrs.kind}:${m.attrs.refLabel}`); }));
    expect(kinds).toEqual(['inline:null', 'autolink:null', 'literal:null', 'reference:l', 'reference:null']);
  });
  it('maps code blocks with fence info', () => {
    expect(d('~~~~js title="x"\nq\n~~~~\n').child(0).attrs).toMatchObject({ lang: 'js title="x"', fence: '~~~', fenceLength: 4 });
    expect(d('    q\n').child(0).attrs.fence).toBe('indented');
  });
  it('maps raw constructs to raw nodes', () => {
    const doc = d('---\nt: 1\n---\n\n<div>\nx\n</div>\n\nText <!-- c --> end[^1]\n\n[^1]: note\n');
    expect(doc.child(0).attrs.kind).toBe('frontmatter');
    expect(doc.child(0).textContent).toBe('---\nt: 1\n---');
    expect(doc.child(1).attrs.kind).toBe('html');
    expect(doc.child(2).toString()).toContain('raw_inline');
    expect(doc.child(3).attrs.kind).toBe('footnote');
  });
  it('falls back to raw_block when a list item does not start with a paragraph', () => {
    const doc = d('- # heading in item\n- b\n');
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('raw_block');
    expect(doc.child(0).textContent).toBe('- # heading in item\n- b');
  });
  it('maps tables with alignment and header cells', () => {
    const t = d('| a | b |\n| :- | -: |\n| 1 | 2 |\n').child(0);
    expect(t.attrs.align).toEqual(['left', 'right']);
    expect(t.child(0).child(0).attrs.header).toBe(true);
    expect(t.child(1).child(0).attrs.header).toBe(false);
  });
  it('handles empty input and BOM', () => {
    expect(d('').toString()).toBe('doc(paragraph)');
    expect(d('\uFEFF# A\n').child(0).type.name).toBe('heading');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/parse.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `lines.ts`, `mdast.ts`, `build.ts`, dan `parse.ts`** sesuai aturan pemetaan di atas.
- [ ] **Step 4: Run test yang sama.** Expected: PASS.
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): map mdast to GFM document`.

---

### Task 6: Indeks source dan deteksi profil

**Files:**
- Create: `packages/markdown/src/source-index.ts`, `src/profile.ts`
- Modify: `src/build.ts` (mengisi indeks dan `srcKey`), `src/parse.ts`
- Test: `packages/markdown/test/source-index.test.ts`, `packages/markdown/test/profile.test.ts`

**Interfaces:**
- Consumes: `buildDoc`, `LineIndex` dari Task 5.
- Produces:
  - `class MutableSourceIndex implements SourceIndex { add(e: Omit<SourceEntry,'key'>): SrcKey; leading: string; trailing: string }`. Key berurutan mulai dari 1.
  - `buildDoc(text, root): { doc: Node; index: SourceIndex }`. Signature berubah dari Task 5, dan `parse.ts` disesuaikan.
  - `detectProfile(text: string, root: Root, index: SourceIndex): Profile`.

**Aturan entri** (untuk setiap node yang punya atribut `srcKey`):
- `text` = `source.slice(lineStart(start), lineEnd(end))`, dengan `start`/`end` dari posisi mdast. Untuk node hasil fallback raw, posisinya adalah posisi node tingkat atas.
- `sepBefore` = `source.slice(lineEnd(endSaudaraSebelumnya), lineStart(startNodeIni))`. Untuk anak pertama, nilainya `''`.
- `leading` = `source.slice(0, lineStart(startUnitTingkatAtasPertama))`. `trailing` = `source.slice(lineEnd(endUnitTingkatAtasTerakhir))`. Jika tidak ada unit sama sekali: `leading = ''` dan `trailing = text` (tanpa BOM).
- **`contribution`:**
  - `blockquote`: `first` = slice dari awal blockquote sampai awal anak pertama (jika di baris yang sama), selain itu `'> '`. `rest = first`.
  - `list_item`: `first` = slice dari awal item sampai awal teks konten anak pertama di baris yang sama (termasuk `[ ] `/`[x] ` jika task). `rest` = spasi sepanjang bagian marker+padding saja, dengan tab dipertahankan sebagai tab.
  - Jika anak pertama tidak dimulai di baris marker, `contribution = null`.
- `listNumber` = angka di source marker item untuk ordered list. Untuk bullet list, nilainya `null`.
- `tableLines` = baris-baris source tabel. `tableAligned` = jumlah baris ≥ 2 dan semua baris sama panjang.

**Aturan profil:**
- `bulletMarker`, `emDelim`, `strongDelim`, `fence`: nilai terbanyak. Jika seri atau tidak ada contoh, pakai default spec 3.5.
- `headingStyle = 'setext'` hanya jika jumlah heading setext > atx.
- `listIndent`:
  - `'marker+1'` jika mayoritas item punya panjang `contribution.rest` = panjang marker + 1.
  - Jika tidak, pakai panjang `rest` yang paling sering muncul.
- `orderedNumbering = 'same'` jika ada ≥ 1 ordered list dengan ≥ 2 item dan semua list seperti itu bernomor seragam.
- `tablePadding = 'aligned'` jika mayoritas tabel `tableAligned`.
- `eol = '\r\n'` jika jumlah `\r\n` > jumlah `\n` tunggal.
- `finalNewline = text === '' || text.endsWith('\n')`.
- `bom = text.startsWith('\uFEFF')`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// packages/markdown/test/source-index.test.ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type SrcKey } from '../src';

const src = '# T\n\n> q1\n> q2\n\n- a\n- [ ] b\n';
const p = parseMarkdown(src);
const entry = (n: { attrs: Record<string, unknown> }) => p.index.get(n.attrs.srcKey as SrcKey)!;

describe('source index', () => {
  it('records whole-line text, separators and leading/trailing', () => {
    const [h, q, l] = [p.doc.child(0), p.doc.child(1), p.doc.child(2)];
    expect(entry(h)).toMatchObject({ text: '# T', prevKey: null, sepBefore: '', isLast: false });
    expect(entry(q)).toMatchObject({ text: '> q1\n> q2', sepBefore: '\n\n' });
    expect(entry(q).prevKey).toBe(h.attrs.srcKey);
    expect(entry(l)).toMatchObject({ text: '- a\n- [ ] b', isLast: true });
    expect(p.index.leading).toBe('');
    expect(p.index.trailing).toBe('\n');
  });
  it('records container contributions', () => {
    expect(entry(p.doc.child(1)).contribution).toEqual({ first: '> ', rest: '> ' });
    const items = p.doc.child(2);
    expect(entry(items.child(0)).contribution).toEqual({ first: '- ', rest: '  ' });
    expect(entry(items.child(1)).contribution).toEqual({ first: '- [ ] ', rest: '  ' });
    expect(entry(items.child(1)).sepBefore).toBe('\n');
  });
  it('records nested blocks with absolute prefixes', () => {
    const q = parseMarkdown('> a\n>\n> b\n');
    const b = q.doc.child(0).child(1);
    expect(q.index.get(b.attrs.srcKey)!).toMatchObject({ text: '> b', sepBefore: '\n>\n' });
  });
  it('records ordered list numbers and table lines', () => {
    const o = parseMarkdown('1. a\n1. b\n\n| a   | b   |\n| --- | --- |\n');
    expect(o.index.get(o.doc.child(0).child(1).attrs.srcKey)!.listNumber).toBe(1);
    expect(o.index.get(o.doc.child(1).attrs.srcKey)!).toMatchObject({ tableLines: ['| a   | b   |', '| --- | --- |'], tableAligned: true });
  });
  it('treats whitespace-only input as trailing', () => {
    const e = parseMarkdown('\n\n');
    expect(e.index.size).toBe(0);
    expect(e.index.trailing).toBe('\n\n');
  });
});
```

```ts
// packages/markdown/test/profile.test.ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../src';

const prof = (md: string) => parseMarkdown(md).profile;

describe('profile detection', () => {
  it('uses spec defaults for an empty file', () => {
    expect(prof('')).toEqual({ bulletMarker: '-', emDelim: '*', strongDelim: '**', fence: '```', headingStyle: 'atx',
      listIndent: 'marker+1', orderedNumbering: 'increment', tablePadding: 'compact', eol: '\n', finalNewline: true, bom: false });
  });
  it('detects majority styles', () => {
    expect(prof('* a\n* b\n\n- c\n\n_x_ _y_ *z*\n\n__s__\n\n~~~\nq\n~~~\n')).toMatchObject({
      bulletMarker: '*', emDelim: '_', strongDelim: '__', fence: '~~~' });
  });
  it('detects ordered numbering, list indent and table padding', () => {
    expect(prof('1. a\n1. b\n').orderedNumbering).toBe('same');
    expect(prof('-   a\n-   b\n').listIndent).toBe(4);
    expect(prof('| a   | b   |\n| --- | --- |\n').tablePadding).toBe('aligned');
  });
  it('detects eol, final newline and BOM', () => {
    expect(prof('a\r\n\r\nb\r\n').eol).toBe('\r\n');
    expect(prof('a').finalNewline).toBe(false);
    expect(prof('\uFEFFa\n').bom).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/source-index.test.ts test/profile.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `source-index.ts`, `profile.ts`, dan perluas `build.ts`** sesuai aturan entri dan profil di atas.
- [ ] **Step 4: Run test yang sama, ditambah `test/parse.test.ts`.** Expected: semua PASS.
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): build source index and detect style profile`.

---

### Task 7: Serializer — jalur verbatim dan korpus golden

**Files:**
- Create: `packages/markdown/src/serialize/serialize.ts`, `src/serialize/context.ts`
- Create: `fixtures/markdown-corpus/README.md` dan `fixtures/markdown-corpus/gfm/` berisi: `tables.md`, `tasklists.md`, `strikethrough.md`, `autolinks.md`, `footnotes.md`, `frontmatter.md`, `html.md`, `nested-lists.md`, `crlf.md` (CRLF di seluruh file), `mixed-eol.md`, `bom.md` (diawali BOM), `no-final-newline.md`, `trailing-blank-lines.md`, `tabs.md`, `setext.md`, `indented-code.md`, `reference-links.md`. Setiap file 10–40 baris dengan isi realistis untuk konstruk tersebut.
- Create: `docs/adr/0002-preservasi-source.md`
- Modify: `packages/markdown/package.json` (devDependency `commonmark-spec@^0.31.2`), `src/index.ts` (ekspor `serializeMarkdown`)
- Test: `packages/markdown/test/golden.test.ts`

**Interfaces:**
- Consumes: `ParsedDoc`, `SourceIndex`.
- Produces:
  - `serializeMarkdown(parsed: ParsedDoc, doc: Node): string` di `serialize.ts`.
  - `interface Ctx { first: string; rest: string }` dan `freshContribution(node: Node, entry: SourceEntry | undefined, profile: Profile, itemIndex: number, list: Node | null, listEntry: SourceEntry | undefined): Contribution` di `context.ts`.
  - `interface SerializerState { readonly index: SourceIndex; readonly profile: Profile; readonly eol: '\n' | '\r\n' }` di `serialize.ts` (`eol = profile.eol`).
  - Kait untuk Task 8/9: `serializeFreshBlock(node: Node, ctx: Ctx, stable: boolean, s: SerializerState): string`. Di task ini cukup stub yang melempar `Error('fresh serialization not implemented')`, karena golden test hanya memakai jalur verbatim.

**Algoritma** (bagian ini menentukan perilaku dan tidak boleh diubah):
1. `serializeChildren(parent, ctxFirstChild, ctxOtherChildren, parentStable)`: untuk setiap anak ke-`i`:
   - `e = index.get(child.attrs.srcKey)`
   - `ctx = i === 0 ? ctxFirstChild : ctxOtherChildren`
   - `stable = parentStable && e !== undefined && ((e.prevKey === null) === (i === 0))`
2. **Verbatim** jika `stable && (child === e.node || child.eq(e.node))`. Khusus container (`blockquote`/`list_item`), syarat tambahannya `deepEqual(freshContribution(...), e.contribution)`. Jika verbatim, keluarkan `e.text`. Jika tidak, keluarkan `serializeFreshBlock(child, ctx, stable, s)`.
3. **Separator sebelum anak ke-`i > 0`:**
   - Jika `stable && e.prevKey !== null && anakOutputSebelumnya.attrs.srcKey === e.prevKey`, pakai `e.sepBefore`.
   - Jika tidak, pakai separator default:
     - `eol` jika parent adalah list `tight`, atau parent `list_item` dari list `tight` dan anak ini adalah list.
     - Selain itu `eol + ctxOtherChildren.rest.trimEnd() + eol`.
4. **Paragraf kosong** (tanpa konten inline) dilewati sepenuhnya, termasuk separatornya. Pengecualian: anak pertama `list_item`, yang menghasilkan item kosong (`ctx.first + contribution.first.trimEnd()`).
5. **Tingkat dokumen:**
   - Output diawali `'\uFEFF'` jika `profile.bom`.
   - `leading` dipakai jika anak pertama yang dikeluarkan punya entri dengan `prevKey === null`.
   - `trailing` dipakai jika anak terakhir yang dikeluarkan punya entri dengan `isLast`. Jika tidak, pakai `profile.finalNewline ? eol : ''`.
   - Jika tidak ada blok yang dikeluarkan: output `index.size === 0 ? index.trailing : ''` (ditambah BOM).
6. Konteks anak tingkat dokumen adalah `{ first: '', rest: '' }` dengan `parentStable = true`.
7. Saat sebuah container diserialisasi ulang, nilai `parentStable` untuk anak-anaknya = `stable` milik container itu sendiri, **dan** (khusus `blockquote`/`list_item`) `deepEqual(freshContribution(...), e.contribution)`. Untuk `bullet_list`/`ordered_list`/`table`, nilainya sama dengan `stable` container.

- [ ] **Step 1: Tulis test golden yang gagal**

```ts
// packages/markdown/test/golden.test.ts
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from '../src';

const require = createRequire(import.meta.url);
const spec: { markdown: string; example: number }[] = require('commonmark-spec').tests;
const root = new URL('../../../', import.meta.url);
const files = [
  ...globSync('fixtures/markdown-corpus/**/*.md', { cwd: root }),
  ...globSync('docs/**/*.md', { cwd: root }),
];
const identity = (text: string) => { const p = parseMarkdown(text); return serializeMarkdown(p, p.doc); };

describe('golden: unedited round-trip is byte-identical', () => {
  it.each(spec.map((t) => [t.example, t.markdown] as const))('commonmark example %i', (_n, md) => {
    expect(identity(md)).toBe(md);
  });
  it.each(files)('%s', (file) => {
    const text = readFileSync(new URL(file, root), 'utf8');
    expect(identity(text)).toBe(text);
  });
  it('covers the corpus', () => { expect(files.length).toBeGreaterThanOrEqual(20); });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/golden.test.ts`. Expected: FAIL (`serializeMarkdown` belum ada).
- [ ] **Step 3: Tulis fixture `gfm/*.md`** (pastikan `crlf.md` benar-benar CRLF dan `bom.md` diawali BOM, cek dengan `file fixtures/markdown-corpus/gfm/*`) dan `README.md` korpus. README menjelaskan cara menambah file `.md` nyata dari repo perusahaan ke `fixtures/markdown-corpus/real/` (izin pemilik repo; pertanyaan terbuka spec #3).
- [ ] **Step 4: Implementasikan `serialize.ts` dan `context.ts`** sesuai algoritma di atas.
- [ ] **Step 5: Run test yang sama.** Expected: PASS untuk 652 contoh CommonMark + semua file korpus.
- [ ] **Step 6: Tulis ADR 0002**: preservasi source, granularitas unit, dan alasan memakai indeks dibanding atribut posisi. Jalankan `pnpm verify`, lalu commit `feat(markdown): verbatim serializer path with golden corpus`.

---

### Task 8: Serialisasi inline dan escape minimal

**Files:**
- Create: `packages/markdown/src/serialize/inline.ts`, `src/serialize/escape.ts`, `src/normalize.ts`
- Test: `packages/markdown/test/inline.test.ts`, `packages/markdown/test/escape.test.ts`

**Interfaces:**
- Consumes: `schema`, `Profile`, `toMdast` + `buildDoc` (untuk parse ulang blok), `Ctx`.
- Produces:
  - `serializeInline(block: Node, profile: Profile, eol: string, opts: { inTable: boolean; inAtxHeading: boolean }): string` di `inline.ts`. Mengembalikan konten inline dengan `soft_break`/`hard_break` sebagai `eol` (prefix `ctx.rest` ditambahkan pemanggil).
  - `escapeMinimal(blockMarkdown: string, candidates: readonly number[], node: Node, reparse: (md: string) => Node | null): string` di `escape.ts`.
  - `normalizeForCompare(node: Node): unknown` di `normalize.ts`, yaitu struktur JSON semantik (dipakai juga oleh guard di Task 10):
    - `srcKey` dan atribut gaya dibuang: `marker`, `style`, `fence`, `fenceLength`, `delim`, `kind`, `refLabel`, `tight`, `delimiter`.
    - Paragraf kosong dibuang, kecuali anak pertama `list_item`.
    - Spasi/tab di awal dan akhir setiap baris konten inline (dipisah oleh `soft_break`/`hard_break`) di-trim.
    - Mark pada segmen whitespace di tepi rentang mark dibuang.
    - Text bersebelahan dengan mark identik digabung.
    - Teks `raw_block` di-`trimEnd` per baris.

**Aturan inline:**
- **Urutan mark:** `link` paling luar, lalu `strong`, `em`, `strike`, `code`. Mark dibuka dan ditutup seminimal mungkin di batas text.
- **Whitespace di tepi rentang mark** dikeluarkan ke luar delimiter (`**a **` → `**a** `).
- **Delimiter:** `em`/`strong` memakai `delim ?? profile`. Jika delimiter keluarga `_` dan rentangnya intraword (karakter alfanumerik tepat di luar rentang), ganti ke `*`/`**`. `strike` → `~~`.
- **Inline `code`:** delimiter = deret backtick sepanjang (run backtick terpanjang di isi + 1). Tambahkan satu spasi di kedua sisi jika isi diawali/diakhiri backtick atau spasi (dan isinya tidak seluruhnya spasi). Isi code tidak di-escape.
- **`link`:**
  - `inline` → `[teks](href "title")`. `href` dibungkus `<…>` jika mengandung spasi atau tanda kurung yang tidak seimbang. `"` di title di-escape menjadi `\"`.
  - `autolink` → `<href>` (tanpa prefiks `mailto:` jika teks tidak memuatnya).
  - `literal` → teks apa adanya.
  - `reference` → `[teks][refLabel]` / `[teks][]` / `[teks]`. Serializer mengasumsikan `href` tidak berubah dari definisinya. Saat `href` diedit, editor (Fase 2) wajib mengubah `kind` menjadi `'inline'`; jika tidak, guard akan menolak.
- **Lainnya:**
  - `image` → `![alt](src "title")`. Alt di-escape seperti teks.
  - `raw_inline` → `source` apa adanya (tidak pernah di-escape).
  - `hard_break` → `'\\' + eol` (backslash) atau `'  ' + eol` (spaces).
  - `soft_break` → `eol`, kecuali di heading ATX → `' '`. Karakter `\n` di dalam text node diperlakukan sama seperti `soft_break`.
- **Kandidat escape** (offset di teks biasa, di luar `code`/`raw_inline`/URL):
  - setiap `\`, `` ` ``, `*`, `_`, `[`, `]`, `<`, `>`, `~`, `|`, `&`, `#`, `!`
  - di awal baris: `-`, `+`, `=`
  - titik/`)` setelah deret digit di awal baris
  - Di sel tabel, `|` selalu kandidat.
- **`escapeMinimal`:**
  1. Mulai dari versi dengan semua kandidat di-escape.
  2. Dari kiri ke kanan, coba hapus satu escape. Pertahankan penghapusan jika `normalizeForCompare(reparse(md))` sama dengan `normalizeForCompare(node)`.
  3. `reparse` mem-parse markdown blok sebagai dokumen berdiri sendiri dan mengembalikan blok satu-satunya (atau `null` jika jumlah blok ≠ 1).

- [ ] **Step 1: Tulis test yang gagal.** Helper `freshParagraph(text, marks?)` membuat `doc(paragraph(text))` lewat `schema`, lalu `serialize` memanggil `serializeMarkdown(parseMarkdown(''), doc)`:

```ts
// packages/markdown/test/escape.test.ts
import { describe, expect, it } from 'vitest';
import { schema, parseMarkdown, serializeMarkdown } from '../src';

const out = (text: string) => serializeMarkdown(parseMarkdown(''), schema.node('doc', null, [schema.node('paragraph', null, [schema.text(text)])])).replace(/\n$/, '');

describe('minimal escaping', () => {
  it.each([
    ['2 * 3 = 6', '2 * 3 = 6'],
    ['a_b_c', 'a_b_c'],
    ['# not heading', '\\# not heading'],
    ['1. not list', '1\\. not list'],
    ['- not list', '\\- not list'],
    ['x <y> z', 'x \\<y> z'],
    ['*not em*', '*not em\\*'],
    ['[x](y)', '[x\\](y)'],
    ['C:\\path', 'C:\\path'],
  ])('%s → %s', (input, expected) => { expect(out(input)).toBe(expected); });

  it.each(['~~no~~', 'a | b', '&amp; &copy;', '`tick`', '***', '<!-- c -->', '[^1]', 'line\n===', '> quote', '+ plus', '1) paren'])(
    'round-trips %j as literal text', (input) => {
      const p = parseMarkdown(out(input) + '\n');
      expect(p.doc.child(0).textContent).toBe(input.replace('\n', ' '));
    });
});
```

```ts
// packages/markdown/test/inline.test.ts
import { describe, expect, it } from 'vitest';
import { schema, parseMarkdown, serializeMarkdown } from '../src';

const para = (...content: Parameters<typeof schema.node>[2][]) =>
  serializeMarkdown(parseMarkdown(''), schema.node('doc', null, [schema.node('paragraph', null, content.flat() as never)])).replace(/\n$/, '');
const t = (s: string, ...marks: ReturnType<typeof schema.mark>[]) => schema.text(s, marks);

describe('inline serialization', () => {
  it('moves edge whitespace outside delimiters', () => {
    expect(para(t('a '), t('b ', schema.mark('strong')), t('c'))).toBe('a **b** c');
  });
  it('switches underscore to star for intraword emphasis', () => {
    expect(para(t('foo'), t('bar', schema.mark('em', { delim: '_' })), t('baz'))).toBe('foo*bar*baz');
  });
  it('fences inline code around backticks', () => {
    expect(para(t('a`b', schema.mark('code')))).toBe('``a`b``');
    expect(para(t('`x', schema.mark('code')))).toBe('`` `x ``');
  });
  it('serializes link kinds', () => {
    expect(para(t('docs', schema.mark('link', { href: 'https://x/a b', title: 'T "q"' })))).toBe('[docs](<https://x/a b> "T \\"q\\"")');
    expect(para(t('https://x', schema.mark('link', { href: 'https://x', kind: 'autolink' })))).toBe('<https://x>');
    expect(para(t('www.y.com', schema.mark('link', { href: 'http://www.y.com', kind: 'literal' })))).toBe('www.y.com');
    expect(para(t('r', schema.mark('link', { href: 'u', kind: 'reference', refLabel: 'l' })))).toBe('[r][l]');
  });
  it('serializes breaks and images', () => {
    expect(para(t('a'), schema.node('hard_break'), t('b'))).toBe('a\\\nb');
    expect(para(t('a'), schema.node('soft_break'), t('b'))).toBe('a\nb');
    expect(para(schema.node('image', { src: 'assets/x.png', alt: 'a [b]', title: null }))).toBe('![a \\[b\\]](assets/x.png)');
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/escape.test.ts test/inline.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `normalize.ts`, `inline.ts`, dan `escape.ts`.** Isi `serializeFreshBlock` hanya untuk `paragraph` dengan prefix `ctx` (blok lain menyusul di Task 9) agar test ini bisa jalan.
- [ ] **Step 4: Run test yang sama.** Expected: PASS. Jika satu kasus `*not em*`/`[x](y)` berbeda dari yang tertulis tetapi round-trip-nya tetap benar, **ikuti algoritma kiri-ke-kanan**. Ekspektasi di test diturunkan dari algoritma itu; jangan mengubah algoritma demi test.
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): inline serialization with minimal escaping`.

---

### Task 9: Serialisasi ulang blok, konteks bersarang, dan test edit tertarget

**Files:**
- Create: `packages/markdown/src/serialize/blocks.ts`, `src/serialize/table.ts`
- Modify: `src/serialize/serialize.ts` (implementasi penuh `serializeFreshBlock`), `src/serialize/context.ts`
- Create: `packages/markdown/test/helpers.ts`
- Test: `packages/markdown/test/edit.test.ts`

**Interfaces:**
- Consumes: semua dari Task 5–8.
- Produces:
  - `test/helpers.ts`:
    - `edit(text: string, change: (tr: Transform, doc: Node) => void): string`: parse, terapkan `change` ke `new Transform(parsed.doc)`, lalu `serializeMarkdown(parsed, tr.doc)`.
    - `posOf(doc: Node, needle: string): number`: posisi karakter pertama `needle` di dalam satu text node; melempar error jika tidak ditemukan.
    - `childPos(doc: Node, path: number[]): number`: posisi awal node pada path anak.

**Aturan blok fresh** (setiap baris non-pertama memakai `ctx.rest`; baris kosong memakai `ctx.rest.trimEnd()`; semua line break yang dihasilkan memakai `profile.eol`):
- **`paragraph`:** `ctx.first` + inline (setelah escape).
- **`heading`:**
  - ATX: `#`×level + spasi + inline.
  - `setext` (gaya node atau profil, hanya untuk level ≤ 2): inline, lalu baris garis bawah `=`/`-` sepanjang `max(3, panjang baris teks terakhir)`.
- **`code_block`:**
  - `indented` (hanya jika `lang` kosong): setiap baris isi diberi 4 spasi.
  - Selain itu fence: karakter dari `fence ?? profile.fence`, panjang `max(fenceLength ?? 3, run terpanjang karakter fence di isi + 1)`, info string `lang`.
- **`horizontal_rule`:** `marker ?? '---'`.
- **`raw_block`:** teks isi, baris per baris, dengan prefix.
- **`blockquote`:** `contribution = e?.contribution ?? { first: '> ', rest: '> ' }`. Anak pertama: `{ first: ctx.first + c.first, rest: ctx.rest + c.rest }`. Anak lain: `{ first: ctx.rest + c.rest, rest: ctx.rest + c.rest }`. Anak dianggap stabil jika `stable` dan kontribusinya sama dengan entri.
- **`bullet_list` / `ordered_list`:** setiap item diserialisasi dengan `ctx` list (item pertama `ctx.first`, lainnya `ctx.rest`).
  - Nomor item ke-`i`: `start + i` (increment) atau `start` (same). Gaya penomoran: `'same'` jika list punya ≥ 2 item berentri dengan `listNumber` sama; `'increment'` jika `listNumber` berentri berbeda; selain itu `profile.orderedNumbering`.
  - Marker: `marker ?? profile.bulletMarker`, atau `${n}${delimiter}`.
- **`list_item`:** `freshContribution`:
  - Jika entri ada dan `e.contribution.first` diawali marker yang sama dengan bagian setelah marker hanya whitespace (sebelum checkbox), padding-nya dipakai ulang.
  - Jika tidak: padding sampai lebar `profile.listIndent` (jika berupa angka dan lebih lebar dari marker), atau marker + satu spasi.
  - Checkbox `[ ] `/`[x] ` ditambahkan ke `first` jika `checked !== null`.
  - `rest` = spasi selebar marker+padding.
  - Item kosong → `ctx.first + first.trimEnd()`.
- **`table`:** lihat `table.ts`.
  - Mode `aligned` jika `e?.tableAligned` (tabel lama) atau `profile.tablePadding === 'aligned'` (tabel baru): lebar kolom = `max(3, isi terpanjang)`, sel di-pad, dan baris delimiter memakai `---`/`:--`/`:-:`/`--:` yang dilebarkan.
  - Mode `compact`: `| ` + sel digabung dengan ` | ` + ` |`. Baris delimiter dibentuk dari align: `---`, `:---`, `:---:`, `---:`.
  - **Preservasi baris** (compact, tabel lama, jumlah kolom sama): baris header/body yang `eq` dengan baris asli di indeks yang sama → pakai `tableLines[i]`; baris delimiter dipakai ulang jika `align` tidak berubah.
  - Sel di-serialize dengan `inTable: true`.

- [ ] **Step 1: Tulis test yang gagal.** Setiap kasus berbentuk `expect(edit(input, change)).toBe(expected)`:

| Nama test | Input | Perubahan | Expected |
|---|---|---|---|
| `edit: paragraph among others` | `"# Title\n\nPara one\nwrapped line.\n\nPara two.\n"` | sisip `"!"` di akhir `"Para two."` | `"# Title\n\nPara one\nwrapped line.\n\nPara two.!\n"` |
| `edit: soft breaks preserved` | sama | ganti `"one"` → `"ONE"` | `"# Title\n\nPara ONE\nwrapped line.\n\nPara two.\n"` |
| `edit: bullet item with star marker` | `"* a\n* b\n* c\n"` | `"b"` → `"bb"` | `"* a\n* bb\n* c\n"` |
| `edit: insert ordered item renumbers` | `"1. a\n2. b\n"` | sisip item `"z"` di posisi 1 | `"1. z\n2. a\n3. b\n"` |
| `edit: insert ordered item same numbering` | `"1. a\n1. b\n"` | sisip item `"z"` di posisi 1 | `"1. z\n1. a\n1. b\n"` |
| `edit: nested list item` | `"- a\n  - b\n  - c\n- d\n"` | `"c"` → `"cc"` | `"- a\n  - b\n  - cc\n- d\n"` |
| `edit: blockquote without space` | `">a\n>\n>b\n"` | `"b"` → `"bb"` | `">a\n>\n>bb\n"` |
| `edit: toggle task` | `"- [ ] todo\n- [x] done\n"` | `checked` item 0 → `true` | `"- [x] todo\n- [x] done\n"` |
| `edit: emphasis delimiter kept` | `"This is _important_ text.\n"` | `"text"` → `"texts"` | `"This is _important_ texts.\n"` |
| `edit: setext heading` | `"Title\n=====\n\nBody\n"` | `"Title"` → `"Title2"` | `"Title2\n======\n\nBody\n"` |
| `edit: tilde fence kept` | `"~~~py\nx = 1\n~~~\n"` | `"1"` → `"2"` | `"~~~py\nx = 2\n~~~\n"` |
| `edit: compact table row only` | `"| a | b |\n| --- | :-: |\n| 1 | 2 |\n"` | `"2"` → `"22"` | `"| a | b |\n| --- | :-: |\n| 1 | 22 |\n"` |
| `edit: aligned table re-padded` | `"| a   | b   |\n| --- | --- |\n| 1   | 2   |\n"` | `"2"` → `"2222"` | `"| a   | b    |\n| --- | ---- |\n| 1   | 2222 |\n"` |
| `edit: insert paragraph` | `"A\n\nB\n"` | sisip paragraf `"N"` setelah A | `"A\n\nN\n\nB\n"` |
| `edit: delete block` | `"A\n\nB\n\nC\n"` | hapus paragraf B | `"A\n\nC\n"` |
| `edit: crlf preserved` | `"A\r\n\r\nB\r\n"` | `"B"` → `"BB"` | `"A\r\n\r\nBB\r\n"` |
| `edit: frontmatter untouched` | `"---\ntitle: x\n---\n\n# H\n"` | `"H"` → `"H2"` | `"---\ntitle: x\n---\n\n# H2\n"` |
| `edit: html block untouched` | `"<div>\nx\n</div>\n\nP\n"` | `"P"` → `"PP"` | `"<div>\nx\n</div>\n\nPP\n"` |
| `edit: hard break spaces` | `"a  \nb\n"` | `"b"` → `"bb"` | `"a  \nbb\n"` |
| `edit: hard break backslash` | `"a\\\nb\n"` | `"b"` → `"bb"` | `"a\\\nbb\n"` |
| `edit: reference link kept` | `"See [docs][d].\n\n[d]: https://x\n"` | `"See"` → `"Read"` | `"Read [docs][d].\n\n[d]: https://x\n"` |
| `edit: literal autolink kept` | `"Go to www.x.com now\n"` | `"now"` → `"later"` | `"Go to www.x.com later\n"` |
| `edit: loose list` | `"- a\n\n- b\n"` | `"b"` → `"bb"` | `"- a\n\n- bb\n"` |
| `edit: indented code kept` | `"    code\n"` | sisip `"2"` setelah `"code"` | `"    code2\n"` |
| `edit: wide list padding kept` | `"-   a\n-   b\n"` | `"b"` → `"bb"` | `"-   a\n-   bb\n"` |
| `edit: trailing blank lines kept` | `"A\n\n\n"` | `"A"` → `"AA"` | `"AA\n\n\n"` |
| `edit: empty file gets final newline` | `""` | sisip text `"Hi"` ke paragraf | `"Hi\n"` |
| `edit: list with tab indentation` (Review Focus 1) | `"-\ta\n-\tb\n"` | `"b"` → `"bb"` | `"-\ta\n-\tbb\n"` |
| `edit: mixed line endings` (Review Focus 2) | `"A\r\nwrapped\n\nB\n"` | `"wrapped"` → `"wrapped2"` | `"A\nwrapped2\n\nB\n"` |
| `edit: paragraph with inline html comment` (Review Focus 4) | `"Text <!-- TODO --> here\n"` | `"here"` → `"there"` | `"Text <!-- TODO --> there\n"` |

  Implementasikan setiap baris tabel sebagai satu `it(...)` di `edit.test.ts` memakai `edit`, `posOf`, dan `childPos`. Contohnya:

```ts
it('edit: nested list item', () => {
  expect(edit('- a\n  - b\n  - c\n- d\n', (tr, doc) => tr.insertText('cc', posOf(doc, 'c'), posOf(doc, 'c') + 1)))
    .toBe('- a\n  - b\n  - cc\n- d\n');
});
it('edit: insert ordered item renumbers', () => {
  expect(edit('1. a\n2. b\n', (tr) => tr.insert(1, schema.node('list_item', null, [schema.node('paragraph', null, [schema.text('z')])]))))
    .toBe('1. z\n2. a\n3. b\n');
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/edit.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `blocks.ts`, `table.ts`, dan `serializeFreshBlock` lengkap** sesuai aturan di atas.
- [ ] **Step 4: Run test yang sama ditambah `test/golden.test.ts`.** Expected: semua PASS (golden tidak boleh regresi).
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): fresh block serialization with nested contexts`.

---

### Task 10: Guard round-trip, `diffText`, property test, performa, dan API publik

**Files:**
- Create: `packages/markdown/src/guard.ts`, `src/diff.ts`
- Modify: `src/index.ts` (API publik final)
- Test: `packages/markdown/test/guard.test.ts`, `test/diff.test.ts`, `test/property.test.ts`, `test/perf.test.ts`, `test/api.test.ts`

**Interfaces:**
- Consumes: `normalizeForCompare` (Task 8), `parseMarkdown`, `serializeMarkdown`.
- Produces (API publik `@markpiw/markdown`, persis seperti ini):
  ```ts
  export { schema } from './schema';
  export type { NodeName, MarkName, BlockNodeName, InlineNodeName, SrcKey, Profile, SourceEntry, SourceIndex, ParsedDoc, GuardFailure, Contribution } from './types';
  export function parseMarkdown(text: string): ParsedDoc;
  export function serializeMarkdown(parsed: ParsedDoc, doc: Node): string;
  export function verifyRoundTrip(output: string, doc: Node): Result<void, GuardFailure>;
  export function diffText(oldText: string, newText: string): TextChange[];
  ```
  - `verifyRoundTrip`: parse `output`, lalu bandingkan `normalizeForCompare` kedua dokumen secara rekursif. Pada perbedaan pertama, kembalikan `{ ok: false, error: { path, expected, actual } }`: `path` = indeks anak dari root, `expected`/`actual` = `JSON.stringify` subtree yang dinormalisasi, dipotong 500 karakter.
  - `diffText`: `[]` jika sama. Jika berbeda, satu `TextChange` hasil pemangkasan prefix dan suffix bersama (suffix tidak boleh tumpang tindih dengan prefix). Batas digeser keluar agar tidak membelah surrogate pair.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// packages/markdown/test/guard.test.ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown, verifyRoundTrip, schema } from '../src';

describe('verifyRoundTrip', () => {
  it('accepts output that re-parses to the same semantics', () => {
    const { doc } = parseMarkdown('* a\n* b\n');
    expect(verifyRoundTrip('- a\n- b\n', doc)).toEqual({ ok: true, value: undefined });
  });
  it('rejects output that changes semantics and reports the path', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('a', [schema.mark('strong')])])]);
    const r = verifyRoundTrip('a\n', doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.path).toEqual([0]);
  });
  it('ignores empty paragraphs and edge whitespace', () => {
    const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('  x  ')]), schema.node('paragraph')]);
    expect(verifyRoundTrip('x\n', doc).ok).toBe(true);
  });
});
```

```ts
// packages/markdown/test/diff.test.ts
import { describe, expect, it } from 'vitest';
import { diffText } from '../src';

describe('diffText', () => {
  it('returns no change for equal text', () => { expect(diffText('abc', 'abc')).toEqual([]); });
  it('trims common prefix and suffix', () => {
    expect(diffText('abcdef', 'abXYef')).toEqual([{ from: 2, to: 4, insert: 'XY' }]);
    expect(diffText('ab', 'aXb')).toEqual([{ from: 1, to: 1, insert: 'X' }]);
    expect(diffText('aaa', 'aaaa')).toEqual([{ from: 3, to: 3, insert: 'a' }]);
  });
  it('diffText never splits surrogate pairs', () => {
    expect(diffText('x😀y', 'x😁y')).toEqual([{ from: 1, to: 3, insert: '😁' }]);
    expect(diffText('中文😀', '中文😀!')).toEqual([{ from: 4, to: 4, insert: '!' }]);
  });
});
```

```ts
// packages/markdown/test/property.test.ts
import { readFileSync, globSync } from 'node:fs';
import fc from 'fast-check';
import { Transform } from 'prosemirror-transform';
import { describe, it } from 'vitest';
import { parseMarkdown, serializeMarkdown, verifyRoundTrip, schema } from '../src';

const root = new URL('../../../', import.meta.url);
const corpus = globSync('fixtures/markdown-corpus/gfm/*.md', { cwd: root }).map((f) => readFileSync(new URL(f, root), 'utf8'));
const alphabet = fc.constantFrom(...'ab *_`#[]()<>|~\\!-+=.1\n'.split(''));

describe('property: random edits keep the round-trip guard green', () => {
  it('holds for insert/delete/mark/blockType edits', () => {
    fc.assert(fc.property(fc.nat(corpus.length - 1), fc.array(fc.tuple(fc.nat(4), fc.nat(), fc.nat(), fc.stringOf(alphabet, { maxLength: 6 })), { minLength: 1, maxLength: 8 }),
      (ci, ops) => {
        const parsed = parseMarkdown(corpus[ci]!);
        const tr = new Transform(parsed.doc);
        for (const op of ops) applyRandomOp(tr, op); // definisikan di file ini: 0=insertText, 1=delete, 2=toggle strong/em/strike/code, 3=setBlockType paragraph↔heading(1-3), 4=no-op; posisi = op[1]/op[2] modulo posisi teks yang valid di textblock non-code/non-raw
        const out = serializeMarkdown(parsed, tr.doc);
        const r = verifyRoundTrip(out, tr.doc);
        if (!r.ok) throw new Error(`${JSON.stringify(r.error)}\n--- output ---\n${out}`);
      }), { numRuns: 300, seed: 20261028 });
  });
});
```

```ts
// packages/markdown/test/perf.test.ts
import { describe, expect, it } from 'vitest';
import { parseMarkdown, serializeMarkdown } from '../src';

describe('performance', () => {
  it('performance: 5000-line document', () => {
    const block = '## Section\n\nSome *text* with `code` and [link](u).\n\n- item one\n- item two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n';
    const text = block.repeat(Math.ceil(5000 / block.split('\n').length));
    const t0 = performance.now();
    const p = parseMarkdown(text);
    expect(serializeMarkdown(p, p.doc)).toBe(text);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
```

```ts
// packages/markdown/test/api.test.ts
import { describe, expect, it } from 'vitest';
import * as api from '../src';

describe('public API', () => {
  it('exports exactly the documented runtime symbols', () => {
    expect(Object.keys(api).sort()).toEqual(['diffText', 'parseMarkdown', 'schema', 'serializeMarkdown', 'verifyRoundTrip']);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @markpiw/markdown exec vitest run test/guard.test.ts test/diff.test.ts test/property.test.ts test/perf.test.ts test/api.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implementasikan `guard.ts`, `diff.ts`, `applyRandomOp` di test properti, dan rapikan `index.ts`.** Jika property test menemukan kasus gagal, perbaiki serializer (bukan guard) dan tambahkan contoh minimal hasil shrink fast-check sebagai kasus tetap di `edit.test.ts` atau `escape.test.ts`.
- [ ] **Step 4: Run seluruh test paket.** Run: `pnpm --filter @markpiw/markdown exec vitest run`. Expected: semua PASS.
- [ ] **Step 5: `pnpm verify`, lalu commit** `feat(markdown): round-trip guard, diffText, property and perf tests`.

---

## Kriteria selesai Fase 1

- `pnpm verify` lulus dari clone bersih (`pnpm install` lalu `pnpm verify`).
- 10 paket ProseMirror ter-vendor dengan `VENDOR.md`. Test upstream non-browser lulus, dan setiap pengecualian punya alasan harness.
- `@markpiw/markdown`:
  - 652 contoh CommonMark + korpus GFM + `docs/**/*.md` identik byte-per-byte.
  - 30 test edit tertarget lulus.
  - Property test (300 run) lulus.
  - Test performa lulus.
- ADR 0001–0004 ada di `docs/adr/`.
