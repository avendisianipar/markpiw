# markpiw — Spesifikasi Desain v1

- Tanggal: 2026-10-28
- Status: Draf untuk review
- Referensi riset:
  - [docs/research/2026-10-28-wysiwyg-editor-research.md](../../research/2026-10-28-wysiwyg-editor-research.md)
  - [docs/research/2026-10-28-build-vs-fork-analysis.md](../../research/2026-10-28-build-vs-fork-analysis.md)

---

## 1. Ringkasan

markpiw adalah editor markdown WYSIWYG in-house untuk dokumentasi tim di repo git. User mengedit langsung di tampilan jadi, dengan UX ala Notion/Tiptap (toolbar, markdown shortcut, slash command). Yang disimpan tetap file `.md` GFM murni dengan diff git minimal. Satu inti editor dipakai di dua host: **web SPA** (membuka folder lokal) dan **extension VS Code** (custom editor).

### 1.1 Tujuan

1. Anggota tim, termasuk non-developer, bisa mengedit `.md` di repo tanpa harus paham sintaks markdown.
2. **Membuka lalu menyimpan file tanpa edit menghasilkan file yang identik byte-per-byte.** Diff git hanya berisi baris yang diubah user.
3. Satu engine dan UI yang sama untuk web dan VS Code.
4. Kode dimiliki penuh di repo sendiri, tanpa dependency "produk editor".

### 1.2 Bukan tujuan v1

Kolaborasi real-time, backend/integrasi Git hosting, bubble menu, drag handle blok, tabel interaktif lanjutan (seleksi multi-sel), syntax highlighting, Firefox/Safari, mobile, format non-GFM (underline, highlight, alignment paragraf), tab multi-file.

### 1.3 Keputusan utama

| # | Keputusan | Alasan singkat |
|---|---|---|
| D1 | Pengguna: tim yang mengedit dokumentasi `.md` di repo git | Hasil klarifikasi |
| D2 | Web: SPA statis tanpa backend; folder lokal via File System Access API | Paling sederhana; commit tetap lewat git |
| D3 | Format: GFM murni | File bersih dan tampil benar di GitHub/GitLab |
| D4 | VS Code: custom editor `priority: "option"` (via "Open With…") | Tidak mengambil alih editor teks bawaan |
| D5 | UX v1: toolbar + markdown shortcut + slash command | Hasil klarifikasi |
| D6 | Gambar: tampil di editor; paste/drag disimpan ke `./assets/` | Hasil klarifikasi |
| D7 | **Engine: ProseMirror (10 paket) di-vendor** ke repo; lapisan di atasnya ditulis sendiri | Analisis build vs fork (Opsi 2). 8 paket inti dari riset + `schema-list` (perintah list: split/sink/lift, dibutuhkan keymap) + `gapcursor` (kursor di sekitar tabel/garis pemisah) |
| D8 | Markdown I/O: model kaya **dengan preservasi source** per unit blok | Satu-satunya cara memenuhi Tujuan 2 dengan UX kaya |
| D9 | Parser: micromark + mdast-util-* (npm, dipin, tidak di-vendor); serializer ditulis sendiri | Posisi source akurat; tidak berencana memodifikasi parser |
| D10 | UI: React 19 + Vite + TypeScript | Pola isolasi terbukti, ekosistem a11y terbaik |
| D11 | Target v1: Chromium desktop (Chrome/Edge) + webview VS Code | FS Access API hanya di Chromium; memangkas matriks quirk |
| D12 | Bahasa UI: Bahasa Indonesia, semua teks di kamus string | Siap ditambah bahasa lain |
| D13 | Web: satu file terbuka per waktu; simpan otomatis | Sederhana; git sebagai jaring pengaman |
| D14 | VS Code: undo dan save native VS Code | `TextDocument` sebagai sumber kebenaran; tidak ada dua undo stack |

---

## 2. Arsitektur

### 2.1 Pola

Hexagonal (ports & adapters):

- **Inti:** `packages/markdown` dan `packages/editor`. Murni, tidak tahu soal file, React, maupun VS Code.
- **Port:** interface `FileHost` di `packages/host`.
- **Adapter:** `apps/web` dan `apps/vscode` mengimplementasikan `FileHost`.
- **UI:** `packages/ui` (React), dipakai oleh kedua app.

### 2.2 Struktur repo

```
markpiw/
├─ vendor/prosemirror/        model, transform, state, view, history, inputrules, keymap, commands,
│                             schema-list, gapcursor + test upstream · LICENSE · VENDOR.md · patches/
├─ packages/
│  ├─ markdown/               parse ↔ dokumen PM, indeks source, profil gaya, serializer, guard
│  ├─ editor/                 schema GFM, plugin, NodeView, EditorController + store
│  ├─ ui/                     komponen React, tema CSS, kamus string
│  └─ host/                   interface FileHost + tipe protokol bersama (types only)
├─ apps/
│  ├─ web/                    Vite SPA + adapter File System Access
│  └─ vscode/                 extension host (esbuild) + entry webview (Vite)
├─ fixtures/markdown-corpus/  korpus golden round-trip
├─ tooling/                   tsconfig dasar, ESLint, Prettier
└─ docs/                      adr/, research/, superpowers/specs/
```

### 2.3 Aturan dependensi

Aturan ini ditegakkan oleh TS project references dan aturan lint boundaries di CI.

| Paket | Boleh bergantung pada | Dilarang |
|---|---|---|
| `markdown` | vendor/prosemirror (model), micromark/mdast, `host` (types) | Global DOM (`document`, `window`), React, `editor`, `ui` |
| `editor` | `markdown`, vendor/prosemirror, `host` (types) | React, API file |
| `ui` | `editor`, `host` (types), React & lib UI | API file, `vscode` |
| `host` | — (types only: `FileHost`, `Result`, `TextChange`, tipe protokol) | Semua runtime |
| `apps/web` | semua paket | `vscode` |
| `apps/vscode` | semua paket | — |

### 2.4 Sumber kebenaran per host

| Host | Sumber kebenaran | Peran editor | Undo |
|---|---|---|---|
| Web | Dokumen ProseMirror di memori, ditulis ke disk saat simpan | Pemilik state | ProseMirror history (`historyMode: 'editor'`) |
| VS Code | `TextDocument` | View: setiap edit dikirim sebagai `TextEdit` minimal | Native VS Code (`historyMode: 'host'`) |

### 2.5 Jalur sinkronisasi tunggal untuk perubahan dari luar

Undo VS Code, `git checkout`/rebase, dan edit dari editor lain semuanya ditangani lewat jalur yang sama: **`applyExternalText(text)`**.

1. Parse ulang teks → `ParsedDoc` baru.
2. Bandingkan anak tingkat atas dokumen lama dan baru: buang prefix dan suffix yang sama (berdasarkan teks source unit).
3. Ganti hanya rentang yang berbeda dalam satu transaksi (`addToHistory: false` di VS Code).
4. Petakan seleksi melalui transaksi tersebut. Jika posisinya hilang, taruh kursor di awal blok pengganti.
5. Ganti indeks source dan profil dengan yang baru.

### 2.6 Interface `FileHost`

```ts
interface FileHost {
  readonly historyMode: 'editor' | 'host';
  readText(): Promise<Result<string, HostError>>;
  writeText(text: string): Promise<Result<void, HostError>>;   // web; VS Code memakai applyEdits
  applyEdits?(edits: TextChange[], baseVersion: number): Promise<Result<number, HostError>>;
  onExternalChange(cb: (text: string, version?: number) => void): Disposable;
  saveAsset(bytes: Uint8Array, mime: string): Promise<Result<string /* path relatif */, HostError>>;
  resolveImageUrl(relativePath: string): Promise<string | null>;
  openLink(target: string): void;          // .md relatif → buka di markpiw; lainnya → eksternal
  persistUiState(state: UiState): void;    // zoom, scroll, seleksi
  restoreUiState(): UiState | null;
}
```

`Result<T, E>` = `{ ok: true; value: T } | { ok: false; error: E }`.

---

## 3. Lapisan markdown (`packages/markdown`)

### 3.1 API

```ts
parseMarkdown(text: string): ParsedDoc                    // { doc, sourceIndex, profile }
serializeMarkdown(parsed: ParsedDoc, doc: Node): string
verifyRoundTrip(output: string, doc: Node): Result<void, GuardFailure>
diffText(oldText: string, newText: string): TextChange[]  // prefix/suffix trimming → maks 1 change
```

Parser: `mdast-util-from-markdown` dengan ekstensi `micromark-extension-gfm` + `mdast-util-gfm` dan `micromark-extension-frontmatter` + `mdast-util-frontmatter`. Versinya dipin di lockfile.

### 3.2 Schema

| Node / mark | Konten | Atribut |
|---|---|---|
| `doc` | `block+` | — |
| `paragraph` | `inline*` | `srcKey` |
| `heading` | `inline*` | `level` 1–6, `style: 'atx' \| 'setext'`, `srcKey` |
| `blockquote` | `block+` | `srcKey` |
| `bullet_list` | `list_item+` | `marker: '-' \| '*' \| '+'`, `tight`, `srcKey` |
| `ordered_list` | `list_item+` | `start`, `delimiter: '.' \| ')'`, `tight`, `srcKey` |
| `list_item` | `paragraph block*` | `checked: boolean \| null`, `srcKey` |
| `code_block` | `text*` (code, tanpa mark) | `lang` (info string utuh dari source, mis. `js title="x"`), `fence: '```' \| '~~~' \| 'indented'`, `fenceLength`, `srcKey` |
| `table` | `table_row+` (baris pertama = header) | `align: ('left'\|'center'\|'right'\|null)[]`, `srcKey` |
| `table_row` | `table_cell+` | — |
| `table_cell` | `inline*` | `header: boolean` |
| `horizontal_rule` | — | `marker` (string asli), `srcKey` |
| `raw_block` | `text*` (code, tanpa mark) | `kind: 'frontmatter' \| 'html' \| 'definition' \| 'footnote' \| 'unknown'`, `srcKey` |
| `image` | inline atom | `src`, `alt`, `title` |
| `hard_break` | inline | `style: 'spaces' \| 'backslash'` |
| `soft_break` | inline atom, tampil sebagai spasi | — (pindah baris biasa di dalam paragraf; dipertahankan agar paragraf yang di-wrap manual tidak digabung jadi satu baris saat diedit) |
| `raw_inline` | inline atom | `source` (HTML inline, referensi footnote) |
| `text` | — | — |
| mark `strong` | — | `delim: '**' \| '__'` |
| mark `em` | — | `delim: '*' \| '_'` |
| mark `strike` | — | — |
| mark `code` | — | — |
| mark `link` | — | `href`, `title`, `kind: 'inline' \| 'reference' \| 'autolink' \| 'literal'` (`literal` = URL telanjang GFM), `refLabel` |

`srcKey: number | null` menunjuk ke entri di `sourceIndex`. Node baru memiliki `srcKey: null`.

**Fallback struktur:** jika sebuah konstruksi mdast tidak muat di schema, misalnya list item yang tidak diawali paragraf (diawali code block atau heading), **seluruh list tingkat atas yang memuatnya** dipetakan menjadi satu `raw_block` (`kind: 'unknown'`). Isinya tetap tampil dan bisa diedit sebagai source, dan tidak ada konten yang hilang.

### 3.3 Indeks source & preservasi

**Unit source** adalah node blok yang punya `srcKey`: blok daun, `list_item`, `table`, `raw_block`, `horizontal_rule`, dan juga container.

Setiap entri `sourceIndex[srcKey]` menyimpan:
- `node`: node ProseMirror hasil parse.
- `lines`: string baris-baris asli secara utuh, dari awal baris tempat node dimulai sampai akhir baris tempat node berakhir, termasuk prefix leluhur (`> `, indentasi).
- `context`: kunci konteks leluhur, yaitu jalur tipe container + kedalaman, misalnya `blockquote>bullet_list[0]>list_item`.
- `gapBefore`: baris-baris (kosong) antara unit sebelumnya dan unit ini di source.

**Invarian cakupan:** setiap byte source tercakup oleh tepat satu unit tingkat atas atau satu gap. Ini termasuk gap di awal file (sebelum unit pertama) dan gap di akhir file (setelah unit terakhir, termasuk whitespace dan newline penutup). Akibatnya, dokumen yang tidak diedit selalu diserialisasi menjadi teks yang identik dengan aslinya. Invarian ini diperiksa oleh test golden.

**Aturan serialisasi** (rekursif dari `doc`) untuk setiap anak:

1. Jika `srcKey` ada, `node === entry.node || node.eq(entry.node)`, **dan** konteks saat ini sama dengan `entry.context`, tulis `entry.lines` apa adanya.
2. Jika tidak, serialisasi ulang node memakai atribut gayanya ditambah profil file. Anak-anaknya tetap diperiksa dengan aturan yang sama secara rekursif, sehingga list item yang tidak berubah di dalam list yang berubah tetap disalin persis.
3. **Jarak antar unit:** jika dua unit bertetangga juga bertetangga di source asli, pakai `gapBefore` aslinya. Jika tidak, pakai default (satu baris kosong untuk blok, mengikuti `tight` untuk list).

Atribut `srcKey` yang ikut tersalin saat sebuah blok di-split atau di-copy tidak berbahaya. Pemeriksaan `eq()` menentukan apakah salinan verbatim boleh dipakai, jadi tidak diperlukan plugin ID unik.

### 3.4 Serialisasi ulang

- Memakai atribut gaya node (`marker`, `delim`, `fence`, `style`, …). Node baru memakai profil file.
- **Escape minimal:** sebuah karakter hanya di-escape bila blok hasil serialisasi, ketika di-parse ulang, berbeda dari node tersebut. Implementasinya: serialisasi tanpa escape → parse ulang blok itu → jika berbeda, tambahkan escape pada posisi yang bermasalah menurut tabel karakter tidak aman (diadaptasi dari konsep "unsafe" mdast-util-to-markdown), lalu ulangi.
- **Tabel** yang berubah diserialisasi ulang seluruhnya. Jika profilnya `tablePadding: 'aligned'`, kolom dirapikan dengan padding. Jika `compact`, tanpa padding.
- **Link referensi** yang `href`-nya diubah dari UI berubah menjadi link inline (`kind: 'inline'`). Definisinya tetap ada sebagai `raw_block`.
- **List berurutan** mengikuti `profile.orderedNumbering`: `'increment'` (1. 2. 3.) atau `'same'` (1. 1. 1.).

### 3.5 Profil gaya file

Dideteksi saat parse dari kemunculan terbanyak. Untuk file tanpa contoh, dipakai default.

| Properti | Default |
|---|---|
| `bulletMarker` | `-` |
| `emDelim` / `strongDelim` | `*` / `**` |
| `fence` | ```` ``` ```` |
| `headingStyle` | `atx` |
| `listIndent` | lebar marker + 1 spasi |
| `orderedNumbering` | `increment` |
| `tablePadding` | `compact` |
| `eol` | `\n` (dideteksi: `\n` atau `\r\n`) |
| `finalNewline` | `true` (dideteksi) |
| `bom` | `false` (dideteksi) |

### 3.6 Guard round-trip

`verifyRoundTrip(output, doc)`:
1. `parseMarkdown(output)` → `doc'`.
2. Bandingkan `doc'` dengan `doc`, dengan atribut `srcKey` diabaikan dan teks di dalam `raw_block` dinormalisasi sebatas spasi di akhir baris.
3. Jika berbeda, kembalikan `GuardFailure { path, expected, actual }` untuk diagnostik.

Guard dijalankan **sebelum setiap penulisan** (web) dan **sebelum setiap batch edit dikirim** (VS Code).

---

## 4. Engine editor (`packages/editor`)

### 4.1 `EditorController`

- Dibuat dari `{ parsed: ParsedDoc, host: FileHost, strings }`. Membuat `EditorState` dan `EditorView` saat `mount(element)`, dan memanggil `destroy()` saat unmount.
- **Commands:** `toggleMark`, `setBlock(type, attrs)`, `wrapList(kind)`, `liftList`, `insertTable(rows, cols)`, `tableAddRow/Col`, `tableDeleteRow/Col`, `tableSetAlign`, `insertImage(file|url)`, `setLink(href)`, `removeLink`, `insertHorizontalRule`, `undo`, `redo`, `setZoom`.
- **Store:** `subscribe(listener)` dan `getSnapshot(): EditorSnapshot`. Snapshot bersifat immutable dan referensinya hanya berubah bila isinya berubah.

```ts
interface EditorSnapshot {
  activeMarks: ReadonlySet<MarkName>;
  blockType: BlockTypeInfo;          // paragraph | heading(level) | code | quote | ...
  listKind: 'bullet' | 'ordered' | 'task' | null;
  inTable: boolean;
  canUndo: boolean; canRedo: boolean;
  slash: SlashState | null;          // { query, items, selectedIndex, anchorRect }
  link: LinkState | null;            // link di bawah kursor
  zoom: number;
  readOnly: boolean; readOnlyReason?: string;
}
```

- **Event keluar:** `onDocChange(doc)`. Host memakainya untuk menjadwalkan simpan (web) atau batch edit (VS Code).

### 4.2 Plugin (urutan prioritas)

| Plugin | Perilaku |
|---|---|
| `slash` | Aktif bila `/` diketik di paragraf kosong atau setelah spasi. Teks setelah `/` menjadi query sampai spasi ganda, Esc, atau kursor keluar. ↑/↓ memindah pilihan, Enter/Tab memilih, Esc menutup. Item difilter berdasarkan label dan alias ID/EN. Saat item dipilih, teks `/query` dihapus lalu aksi dijalankan |
| `keymap` (kustom) | Mod-B, Mod-I, Mod-E (code), Mod-Shift-X (strike), Mod-K (link), Mod-Alt-1…6 (heading), Mod-Alt-0 (paragraf), Mod-Shift-7 (ordered), Mod-Shift-8 (bullet), Mod-Shift-9 (task), Tab/Shift-Tab (sink/lift list item; pindah sel di tabel), Enter (split list item; item kosong → keluar list), Mod-Z/Mod-Shift-Z/Mod-Y (undo/redo, hanya di `historyMode: 'editor'`) |
| `inputrules` | Blok: `#{1,6} `, `> `, `- `/`* `/`+ ` (marker disimpan ke atribut), `1. `/`1) `, `[ ] `/`[x] ` (di awal list item atau paragraf), ```` ```lang ```` + Enter, `---`/`***` + Enter. Inline: `**x**`, `__x__`, `*x*`, `_x_`, `~~x~~`, `` `x` `` (delimiter disimpan ke atribut). Backspace tepat setelah transformasi memanggil `undoInputRule` |
| `history` | Hanya `historyMode: 'editor'`. `newGroupDelay` 500 ms |
| `pasteDrop` | Lihat 4.3 |
| `clipboardText` | `clipboardTextSerializer` menyerialisasi slice ke markdown |
| `link` | Klik biasa menaruh kursor. Mod+klik → `host.openLink(href)`. Saat kursor berada di link, snapshot menyediakan `link` untuk popover |
| `table` | Perintah tabel dasar dan navigasi sel dengan Tab. Tanpa seleksi multi-sel |
| `placeholder` | Decoration pada paragraf kosong yang sedang aktif: "Ketik '/' untuk perintah…" |
| `trailingNode` | Menjamin paragraf kosong di akhir dokumen |
| `readOnly` | `editable: () => !snapshot.readOnly` |
| `baseKeymap` | Dari prosemirror-commands, sebagai fallback |

### 4.3 Paste & drop

1. **File gambar** (`image/png|jpeg|gif|webp|svg+xml`):
   1. Sisipkan node `image` dengan `src` sementara berupa URL `blob:`.
   2. Panggil `host.saveAsset(bytes, mime)`.
   3. Jika berhasil, ganti `src` dengan path relatif. Jika gagal, hapus node dan tampilkan notifikasi.
2. **`text/html`** (di luar code block):
   1. Parse dengan `DOMParser` (dokumen inert).
   2. Pra-proses: buang wrapper `<b id="docs-internal-guid…">`, ubah list `mso-*` Word menjadi `<ul>/<ol>`, buang `style`, `class`, dan elemen yang tidak dikenal.
   3. `DOMParser` ProseMirror dengan schema GFM.
3. **`text/plain`**: jika terdeteksi seperti markdown (heuristik: baris diawali `#`, `-`, `*`, `>`, angka+titik, fence, atau mengandung `**`/`[x](y)`), parse dengan `parseMarkdown` dan sisipkan sebagai slice. Jika tidak, sisipkan teks biasa.
4. **Di dalam `code_block` atau `raw_block`:** selalu teks polos.

### 4.4 NodeView (vanilla, tanpa React)

| Node | Tampilan |
|---|---|
| `image` | `<img>` dengan `src` dari `host.resolveImageUrl` (diberi cache). Saat dipilih, muncul popover untuk mengedit alt dan URL. Jika gambar gagal dimuat, tampil placeholder berisi path-nya |
| `list_item` dengan `checked !== null` | Checkbox di sebelah kiri; klik mengubah `checked` |
| `code_block` | `<pre><code>` dengan label bahasa di pojok yang bisa diedit |
| `raw_block` | Kotak monospace berlabel "Markdown mentah · {kind}" yang bisa diedit sebagai teks |

### 4.5 Keamanan konten

- HTML mentah tidak pernah dimasukkan ke DOM sebagai HTML.
- `href` link dengan skema selain `http:`, `https:`, `mailto:`, path relatif, atau `#anchor` ditampilkan tetapi tidak bisa dibuka.
- `src` gambar hanya diterima jika berupa path relatif, `https:`, atau `blob:`. Selain itu tampil sebagai placeholder.

---

## 5. UI (`packages/ui`)

### 5.1 Integrasi React ↔ engine

- **`<EditorHost controller>`:** me-render satu `div` kosong. `controller.mount(div)` dipanggil di `useLayoutEffect`, dan `controller.unmount()` di cleanup (aman untuk StrictMode yang me-mount dua kali). Komponen dibungkus `memo` dan tidak pernah me-render anak.
- **`useEditorSnapshot(selector)`:** `useSyncExternalStore` dengan selector, sehingga komponen hanya di-render ulang bila potongan state yang dibacanya berubah.
- **`EditorContext`:** hanya membawa instance controller, yang stabil.
- Tanpa React NodeView. Tanpa Redux/Zustand. State aplikasi memakai `useReducer` + context.
- **`<EditorErrorBoundary>`:** saat crash, tampilkan mode source baca-saja (teks terakhir yang valid) dan jangan menulis apa pun.

### 5.2 Komponen

| Komponen | Detail |
|---|---|
| `Toolbar` | React Aria `Toolbar` (roving focus). Grup: undo/redo · zoom (−, persen, +) · dropdown blok (Paragraf, H1–H6) · dropdown list (bullet, nomor, task) · B, I, S, inline code · link, quote, code block · tabel (menu: sisip, tambah/hapus baris/kolom, perataan kolom), gambar, garis pemisah. Tombol toggle memakai `aria-pressed`. Tooltip memuat shortcut. Toolbar sticky di atas |
| `SlashMenu` | Portal, posisi dari Floating UI (`computePosition` dengan `virtual element` dari `anchorRect`). Pola listbox dengan `aria-activedescendant` di elemen editor. Fokus tetap di editor. Item: Teks, Heading 1, Heading 2, Heading 3, Bullet list, Numbered list, Task list, Quote, Code block, Tabel, Gambar, Garis pemisah |
| `LinkPopover` | Muncul saat kursor berada di link atau saat Mod-K. Field URL, tombol buka, hapus |
| `ImagePopover` | Edit alt dan URL gambar |
| `ReadOnlyBanner` | Menampilkan alasan (guard gagal, crash, izin) dan aksi terkait |
| `Page` | Kanvas abu-abu, halaman putih rata tengah, lebar maksimum ~760 px, padding lega (mengikuti screenshot referensi) |

### 5.3 Gaya & tema

- CSS Modules + CSS variables. Tanpa CSS-in-JS runtime.
- Token dipetakan ke `--vscode-*` dengan nilai default untuk web (tema terang).
- Zoom memakai `--mp-zoom` yang mengalikan ukuran font konten (bukan `transform`). Rentang 50–200%, langkah 10%.
- Mendukung tema high contrast VS Code dan `prefers-reduced-motion`.
- Ikon dari `lucide-react`.

### 5.4 Teks & bahasa

Semua teks UI berada di `strings/id.ts` (bahasa Indonesia) dan diakses lewat `t(key)`. Struktur ini memungkinkan `en.ts` ditambahkan tanpa mengubah komponen.

---

## 6. Host web (`apps/web`)

### 6.1 Alur

1. **Halaman awal:** tombol "Buka folder" dan daftar folder terakhir (handle dari IndexedDB). Di browser tanpa `showDirectoryPicker`, tampil pesan "Browser tidak didukung — gunakan Chrome atau Edge".
2. `showDirectoryPicker({ mode: 'readwrite' })` → simpan handle ke IndexedDB.
3. **Membuka folder terakhir:** `queryPermission`. Jika hasilnya `prompt`, tampilkan tombol "Izinkan akses" (perlu gesture user) → `requestPermission`.
4. **File tree:** dimuat secara lazy per folder, hanya menampilkan `.md` dan folder yang mengandung `.md`. `.git`, `node_modules`, dan folder tersembunyi diabaikan.
5. **Klik file:** simpan perubahan yang tertunda di file aktif → `readText` → `parseMarkdown` → editor baru.

### 6.2 Simpan otomatis

- **Pemicu:** 1 detik setelah perubahan terakhir, saat pindah file, saat `visibilitychange`/blur, dan saat Ctrl/Cmd+S (langsung).
- **Pipeline:**
  1. `serializeMarkdown`.
  2. `verifyRoundTrip`. Jika gagal, editor menjadi read-only dengan banner dan file tidak ditulis.
  3. Cek konflik.
  4. `createWritable` → tulis → tutup.
  5. Catat `lastModified` dan `size` yang baru.
- **Status di top bar:** Tersimpan · Belum disimpan · Menyimpan… · Konflik · Gagal menyimpan.
- **Cek konflik:** sebelum menulis, `getFile()`. Jika `lastModified` atau `size` berbeda dari yang tercatat, autosave dihentikan dan muncul dialog **Pakai versi saya** (timpa) / **Muat versi disk** (`applyExternalText`, perubahan lokal dibuang).
- `beforeunload` memperingatkan bila ada perubahan yang belum tersimpan.

### 6.3 Perubahan dari luar

- Jika `FileSystemObserver` tersedia, observasi file aktif.
- Jika tidak, periksa `lastModified` saat jendela kembali fokus dan setiap 5 detik ketika jendela aktif.
- Jika file berubah dan editor tidak punya perubahan tertunda → `applyExternalText`. Jika ada perubahan tertunda → dialog konflik.

### 6.4 Aset & gambar

- `saveAsset`: hitung SHA-256 dari isi → nama `image-<8 hex pertama>.<ext dari mime>` → `getDirectoryHandle('assets', { create: true })` di folder file `.md` → tulis jika belum ada → kembalikan `./assets/<nama>`.
- **Validasi:** path hasil harus tetap berada di bawah folder root yang dibuka.
- `resolveImageUrl`: resolve path relatif terhadap folder file → `getFile()` → `URL.createObjectURL` (diberi cache dan di-revoke saat pindah file). Path di luar root atau yang tidak ditemukan mengembalikan `null`.

### 6.5 Draf darurat

Jika penulisan gagal karena izin hilang, isi markdown terakhir disimpan di IndexedDB dengan kunci path file dan ditawarkan untuk dipulihkan saat folder dibuka kembali.

### 6.6 Deploy

- `vite build` menghasilkan file statis.
- Dihosting internal **wajib HTTPS** (syarat secure context FS Access API).
- Header CSP: `default-src 'self'; img-src 'self' blob: https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'`.

---

## 7. Host VS Code (`apps/vscode`)

### 7.1 Registrasi (`package.json`)

- `contributes.customEditors`: `viewType: "markpiw.editor"`, `selector: [{ filenamePattern: "*.md" }]`, `priority: "option"`.
- `contributes.commands`: `markpiw.openInMarkpiw` (buka file aktif dengan markpiw), dengan tombol di `editor/title` untuk file `.md`.
- `contributes.configuration`: `markpiw.assetsFolder` (string, default `"assets"`).
- `engines.vscode`: ditetapkan di Fase 4 mengikuti versi minimum yang dipakai tim.

### 7.2 Protokol pesan

Kedua arah divalidasi dengan Valibot.

| Arah | Pesan | Isi |
|---|---|---|
| webview → ext | `ready` | — |
| ext → webview | `init` | `{ text, version, uiState, strings, config }` |
| webview → ext | `edits` | `{ baseVersion, changes: TextChange[] }` |
| ext → webview | `editsApplied` | `{ version }` |
| ext → webview | `externalChange` | `{ text, version }` |
| webview → ext | `saveAsset` | `{ requestId, bytes, mime }` |
| ext → webview | `assetSaved` | `{ requestId, result }` |
| webview → ext | `resolveImages` | `{ requestId, paths[] }` |
| ext → webview | `imagesResolved` | `{ requestId, urls: Record<path, string \| null> }` |
| webview → ext | `openLink` | `{ target }` |
| webview → ext | `uiState` | `{ zoom, scrollTop, selection }` |

### 7.3 Sinkronisasi

- **Webview:** setiap `onDocChange` → debounce 200 ms → `serializeMarkdown` → `verifyRoundTrip` → `diffText(lastText, newText)` → kirim `edits` dengan `baseVersion = lastVersion`.
- **Extension:**
  - Jika `baseVersion !== document.version`, tolak edit dan kirim `externalChange` dengan teks terkini.
  - Jika sama, catat `expectedVersion = version + 1` lalu `workspace.applyEdit`.
  - Event `onDidChangeTextDocument` dengan `document.version === expectedVersion` dan teks yang sama dengan hasil yang diharapkan diabaikan (echo). Event lain, termasuk `reason === Undo/Redo`, dikirim sebagai `externalChange`.
- **Webview menerima `externalChange`:** `applyExternalText(text)`, lalu `lastText` dan `lastVersion` diperbarui.
- **Simpan, dirty, dan hot exit** sepenuhnya ditangani VS Code.

### 7.4 Webview

- `retainContextWhenHidden: false`. `uiState` dipulihkan lewat `getState`/`setState` dan pesan `init`.
- `localResourceRoots`: folder workspace yang memuat dokumen + folder dokumen + folder `dist` extension.
- CSP: `default-src 'none'; img-src ${cspSource} https: blob: data:; style-src ${cspSource}; script-src 'nonce-${nonce}'; font-src ${cspSource}`.
- **Gambar:** extension me-resolve path relatif terhadap folder dokumen → cek berada di dalam `localResourceRoots` → `webview.asWebviewUri`.
- **Aset:** `workspace.fs.writeFile(Uri.joinPath(docDir, assetsFolder, name))` dengan aturan nama yang sama seperti web (hash isi). Bekerja di Remote/WSL/Codespaces.
- **Link:** `.md` relatif → `vscode.openWith(uri, 'markpiw.editor')`. `http(s)`/`mailto` → `env.openExternal`. `#anchor` → scroll di dalam webview.

### 7.5 Build & paket

- Extension host: esbuild (`platform: node`, `format: cjs`, `external: ['vscode']`).
- Webview: Vite dengan nama file tetap, tanpa code splitting, satu JS + satu CSS.
- `vsce package --no-dependencies` → `.vsix` berisi `THIRD_PARTY_NOTICES`.

---

## 8. Penanganan error

| Situasi | Perilaku |
|---|---|
| Sintaks tidak dikenal | Menjadi `raw_block`/`raw_inline`; tidak pernah hilang |
| Pemetaan mdast → dokumen melempar error | Mode source baca-saja + banner "Gagal memuat sebagai WYSIWYG" + "Salin info diagnostik" |
| Guard round-trip gagal | Tidak menulis/mengirim edit; editor read-only; banner + "Salin info diagnostik" (berisi `GuardFailure`, versi, tanpa isi dokumen kecuali user menyetujui) |
| Izin folder hilang (web) | Banner "Izinkan akses kembali"; isi disimpan sebagai draf IndexedDB |
| Konflik file (web) | Dialog konflik (6.2) |
| Gagal menyimpan gambar | Node placeholder dihapus + notifikasi |
| `baseVersion` usang (VS Code) | Sinkronisasi ulang otomatis via `externalChange` |
| Crash komponen editor | Error boundary → mode source baca-saja |
| Telemetri | Tidak ada. Log hanya ke console; "Salin info debug" untuk laporan bug manual |

---

## 9. Vendor & kepatuhan lisensi

- `vendor/prosemirror/<pkg>/` berisi source dan test upstream **tanpa modifikasi** pada commit "vendor: import <pkg>@<versi> (<sha>)".
- Modifikasi hanya lewat `vendor/prosemirror/patches/*.patch` dengan header DEP-3 (`Description`, `Forwarded`, `Author`, `Last-Update`), diterapkan oleh skrip `tooling/vendor/apply-patches`. Target v1: **nol patch**.
- `VENDOR.md` per paket mencatat URL upstream, versi/SHA, daftar patch, pemilik, dan SLA pembaruan (≤ 3 bulan setelah rilis minor upstream).
- Job CI `vendor-drift` membandingkan versi vendor dengan rilis upstream terbaru dan memberi peringatan jika tertinggal lebih dari SLA.
- `tsconfig` vendor mengikuti setelan upstream, bukan setelan ketat proyek.
- **Kepatuhan:**
  - Header lisensi asli dipertahankan.
  - Tag SPDX ditambahkan pada file baru milik proyek.
  - `THIRD_PARTY_NOTICES` digenerate saat build dan disertakan di SPA (`/licenses.txt`) dan `.vsix`. Plugin bundler memastikan komentar lisensi tidak hilang.
  - SBOM (CycloneDX) mencakup paket npm dan kode vendor.
  - Scan lisensi per file di CI.
- **Larangan:** kode dari Tiptap Pro/Cloud, CKEditor 5, BlockNote `xl-*`, dan Typora.
- **AI coding assistant:** filter "suggestions matching public code" diatur ke Block.
- **Sebelum `.vsix` atau akses SPA diberikan kepada pihak di luar karyawan** (kontraktor/mitra), lakukan review legal internal (catatan UU 28/2014 Pasal 83).

---

## 10. Tooling & kualitas kode

- Node LTS dikunci via `.nvmrc`; pnpm via `packageManager` (Corepack). Monorepo memakai pnpm workspaces dengan `pnpm -r`.
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `moduleResolution: "bundler"`, project references. `lib` diatur per paket: `markdown` dengan DOM untuk tipe saja (lihat di bawah), `editor`/`ui` dengan DOM, extension dengan Node.
- `packages/markdown` tetap memakai `lib` DOM **hanya untuk tipe** (deklarasi tipe ProseMirror merujuk tipe DOM); pemakaian global DOM dilarang lewat aturan lint `no-restricted-globals`.
- **Tipe:** union literal untuk nama node/mark, branded types `SrcKey`/`TextVersion`, `switch` exhaustive dengan `never`, `Result` untuk error yang bisa diprediksi. Setiap paket hanya mengekspos API lewat `exports`.
- **Lint:** ESLint flat config + `typescript-eslint` strict-type-checked + `eslint-plugin-react-hooks` + aturan boundaries (2.3). Format dengan Prettier.
- **Decision log:** ADR di `docs/adr/`. ADR awal: 0001 vendor ProseMirror, 0002 preservasi source, 0003 undo native di VS Code, 0004 target Chromium.

---

## 11. Strategi pengujian

| Lapisan | Alat | Cakupan |
|---|---|---|
| Golden round-trip | Vitest | Setiap file di `fixtures/markdown-corpus/` (contoh spesifikasi CommonMark & GFM + file `.md` nyata dari repo perusahaan, dengan izin pemilik repo): `serialize(parse(x)) === x` byte-per-byte, termasuk CRLF, BOM, dan tanpa newline di akhir file |
| Edit tertarget | Vitest | Untuk setiap jenis unit: ubah satu unit → diff hanya menyentuh baris unit itu (dan renumber list sesuai profil) |
| Properti | Vitest + fast-check | Urutan edit acak (sisip/hapus teks, toggle mark, ubah blok) → serialize → `verifyRoundTrip` lulus |
| Escape | Vitest | Teks berisi `* _ ~ \` [ ] # > \| < &` di berbagai posisi → round-trip setara |
| Vendor | Test upstream ProseMirror | Dijalankan di CI tanpa perubahan |
| Editor | Playwright (Chromium) di harness dev dengan host palsu | Input rules, slash menu, toolbar, shortcut, paste (HTML Google Docs/Word, markdown, gambar), undo, tabel, link, read-only, crash → fallback |
| IME | Playwright + CDP `Input.imeSetComposition` (sebagian) + checklist manual | Jepang, Cina, Korea di Windows/macOS; tanpa karakter dobel, kursor tidak melompat |
| Host web | Playwright + mock FS Access | Buka folder, izin, autosave, konflik, aset, perubahan dari luar |
| Host VS Code | `@vscode/test-cli` + `@vscode/test-electron` | Init, edit → `TextDocument`, echo diabaikan, undo native → `externalChange`, `baseVersion` usang, aset via `workspace.fs` |
| Performa | Vitest bench + Playwright | File 5.000 baris: buka < 500 ms; latensi ketik < 16 ms; batas ukuran bundle webview |

---

## 12. Definition of Done v1

1. 100% korpus golden identik byte-per-byte.
2. Semua test edit tertarget, properti, E2E, dan integrasi VS Code lulus di CI.
3. Checklist manual IME lulus.
4. Kepatuhan lisensi lengkap (`THIRD_PARTY_NOTICES`, SBOM, scan lulus).
5. Dua minggu dogfooding oleh satu tim tanpa bug P1 (data hilang, file rusak, diff tidak wajar).
6. Artefak rilis: SPA statis di hosting internal HTTPS + `.vsix` di rilis internal, beserta panduan instalasi singkat.

## 13. Urutan pengerjaan

Implementasi dijalankan end-to-end oleh agen AI, jadi bagian ini hanya mengatur **urutan dan dependensi**, tanpa estimasi durasi. Setiap fase punya rencana implementasi sendiri di `docs/superpowers/plans/` dan menghasilkan software yang bisa diuji secara mandiri.

| Fase | Isi | Bergantung pada |
|---|---|---|
| 1 | Fondasi monorepo, tooling, vendor ProseMirror (+ test upstream), `packages/host` (types), `packages/markdown` lengkap dengan korpus golden | — |
| 2 | `packages/editor` + `packages/ui` + harness dev dengan host palsu | Fase 1 |
| 3 | `apps/web` | Fase 2 |
| 4 | `apps/vscode` | Fase 2 (bisa paralel dengan Fase 3) |
| 5 | Hardening: IME, performa, kepatuhan rilis (`THIRD_PARTY_NOTICES`, SBOM), dokumentasi, artefak rilis | Fase 3 & 4 |

Rencana untuk fase berikutnya ditulis setelah fase sebelumnya selesai, supaya rencana itu berangkat dari kode dan interface yang benar-benar ada.

## 14. Risiko utama & mitigasi

| Risiko | Mitigasi |
|---|---|
| Diff tidak wajar / file rusak | Preservasi source, guard sebelum setiap penulisan, korpus golden dari repo nyata, mode read-only saat ragu |
| Bug IME/seleksi | ProseMirror vendor tanpa modifikasi; checklist IME; target Chromium saja |
| Vendor tertinggal dari upstream | `VENDOR.md` + SLA + job CI `vendor-drift`; target nol patch |
| Echo loop / desinkronisasi VS Code | Protokol berversi, jalur `applyExternalText` tunggal, test integrasi |
| Kode ditulis agen AI, tetapi dipelihara manusia | ADR untuk setiap keputusan besar, komentar pada algoritma non-trivial (preservasi source, escape, sinkronisasi), dokumentasi ProseMirror publik, review manusia per fase |
| User kembali ke editor bawaan VS Code/Obsidian | Dogfooding awal; fokus pada pembeda: UX non-developer, diff bersih, alur `./assets`, satu engine web + VS Code |

## 15. Pertanyaan terbuka (tidak memblokir implementasi)

1. Versi minimum `engines.vscode` yang dipakai tim (diputuskan di Fase 4).
2. Lokasi hosting SPA internal dan CI yang dipakai (GitLab CI atau GitHub Actions).
3. Repo mana yang file `.md`-nya boleh dimasukkan ke korpus golden.
