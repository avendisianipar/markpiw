# Riset: Arsitektur Editor WYSIWYG & Tech Stack untuk markpiw

Tanggal: 2026-10-28
Tujuan: mempelajari teknologi di balik Notion, Tiptap/ProseMirror, Lexical, Slate, Quill, Draft.js, CKEditor 5, Google Docs, CodeMirror 6, dan editor markdown WYSIWYG (Typora, Obsidian, Milkdown, MarkText, GitLab), sebagai referensi untuk membangun editor sendiri.

Label: **[dok]** = terdokumentasi di sumber; **[inf]** = inferensi / observasi komunitas.

Konteks markpiw: editor `.md` untuk dokumentasi tim di repo git, GFM murni, UX ala Notion (toolbar, markdown shortcut, slash command), berjalan sebagai web SPA (folder lokal via File System Access API) dan custom editor VS Code. Tanpa produk editor pihak ketiga; framework/library umum boleh.

---

## 1. Peta arsitektur engine editor

| Editor | Model dokumen | Strategi input & render | Undo | Kolaborasi |
|---|---|---|---|---|
| ProseMirror / Tiptap | Tree immutable + schema ketat; inline = teks datar + marks; posisi = integer offset | Satu root `contenteditable`; browser mengetik → MutationObserver → parse ulang bagian yang berubah | Inverted steps, grup 500 ms + bersebelahan | Central authority + rebase steps; Tiptap pakai Yjs |
| Lexical (Meta) | Tree node ber-key; format = properti teks datar | Intercept `beforeinput` → command; ketik biasa boleh native lalu dibaca balik; reconciler patch DOM yang berubah saja | Snapshot state, merge 300 ms | Yjs |
| Slate | Tree JSON polos, normalisasi (tanpa schema) | `beforeinput` preventDefault, fast-path native utk 1 karakter; Android input manager terpisah | Invert operasi | slate-yjs (komunitas) |
| Quill | Delta (insert/retain/delete) + Parchment blot paralel ke DOM | `contenteditable` + MutationObserver merekonsiliasi | Berbasis Delta | Cocok untuk OT |
| Draft.js (diarsip 2023) | Blok datar, style per karakter | **React me-render di dalam contenteditable** | Snapshot Immutable.js | — |
| CKEditor 5 | Model tree + virtual view + DOM; schema ketat | Observer → event view → fitur menerjemahkan ke perubahan model | Batch per `change()`, selective undo | OT untuk tree (~42 person-years) |
| Google Docs | Dokumen linear OT [inf] | **Canvas** + layout engine sendiri; DOM tersembunyi untuk aksesibilitas | — | OT + server |
| Notion | Blok datar ber-UUID, parent pointer, array child ID | **Per-blok contenteditable** [inf] | — | Dulu last-writer-wins per blok; sejak 2025 CRDT (RGA + Peritext) |
| CodeMirror 6 | Teks datar + indeks baris | `contenteditable` + MutationObserver; EditContext di Chrome | Transaksi | Central authority |

Sumber utama: prosemirror.net/docs/guide, lexical.dev/docs, docs.slatejs.org, quilljs.com/docs/delta, draftjs.org (Issues & Pitfalls), ckeditor.com/docs/ckeditor5 (editing engine), workspaceupdates.googleblog.com (2021, canvas), notion.com/blog/data-model-behind-notion, notion.com/blog/how-notion-handles-concurrent-editing-with-crdts, codemirror.net/docs/guide.

### Empat keluarga pendekatan

| Keluarga | Contoh | Pro | Kontra |
|---|---|---|---|
| **DOM sebagai sumber kebenaran** | Quill, Draft.js awal | Cepat dibuat | Kelas bug klasik: karakter dobel, kursor lompat, DOM diubah ekstensi (Grammarly) tidak terdeteksi. Draft.js mengakui React "cannot reconcile the DOM" saat ekstensi browser memodifikasinya |
| **Model sebagai kebenaran + input hybrid** | ProseMirror, Lexical, Slate, CKEditor 5, CodeMirror 6 | Konsensus editor matang; undo, seleksi, kolaborasi bisa dibangun di atasnya | Harus menulis reconciler, pemetaan seleksi, penanganan IME sendiri |
| **Canvas + layout sendiri** | Google Docs | Konsistensi render total, performa dokumen besar | Harus membangun layout teks, kursor, IME, aksesibilitas sendiri — di luar jangkauan tim kecil |
| **Per-blok contenteditable** | Notion | Blok terisolasi, mudah drag/reorder | Seleksi & copy lintas blok jadi sulit; perlu logika seleksi kustom |

**Kesimpulan:** pakai keluarga kedua — model sebagai satu-satunya sumber kebenaran, satu root `contenteditable`, input hybrid.

---

## 2. Masalah sulit & cara editor terbaik mengatasinya

| Masalah | Penyebab | Solusi yang terbukti |
|---|---|---|
| **Karakter dobel** | Browser *dan* editor sama-sama menerapkan edit (Lexical PR #5644), atau re-render setelah insert native | Sebelum menerapkan edit native ke model, cek apakah DOM sudah sesuai; diff teks DOM vs model per blok; reconciler ber-key yang tidak mengganti text node yang tidak berubah |
| **Kursor lompat / input hilang** | Re-render saat mengetik; ekstensi pihak ketiga mengubah DOM | Flush mutasi sinkron pada `input`; DOM asing di-revert dengan render ulang dari model; tulis seleksi ke DOM **hanya jika berbeda** |
| **Framework vs contenteditable** | Virtual DOM React/Vue melawan DOM yang diubah browser | React/Vue **tidak boleh** me-render isi area ketik (pelajaran Draft.js). Lexical & Tiptap: React hanya me-render `div` kosong, engine mengambil alih via ref |
| **IME / komposisi** | `insertCompositionText` tidak bisa di-cancel (spesifikasi Input Events L2); Firefox IME `beforeinput` tidak cancelable; Android sering mengabaikan `preventDefault` | Biarkan komposisi native, jangan re-render node yang sedang dikomposisi, baca hasilnya setelah `compositionend`; bekukan sinkronisasi seleksi selama komposisi |
| **Android / Gboard** | Keyboard tidak melaporkan backspace/enter, hapus-tulis ulang seluruh kata | Deteksi maksud dari diff DOM; fallback `keydown`; test di perangkat nyata |
| **Seleksi** | Posisi DOM ≠ posisi model; "di dalam atau di luar `<strong>`?" | Model selection kanonik + fungsi pemetaan dua arah (WeakMap DOM↔model); marks sebagai atribut teks sehingga satu posisi kursor punya satu arti |
| **Undo** | Per karakter terlalu granular | Transaksi berupa *step* yang bisa dibalik + peta posisi; grup per 300–500 ms jika bersebelahan & sejenis; paste, cut, dan shortcut markdown punya entri sendiri |
| **Paste kotor** | HTML Word/Google Docs (`mso-*`, `<b id="docs-internal-guid…">`) | Parse `text/html` di dokumen inert, petakan lewat aturan schema, buang yang tidak dikenal; jika tidak ada HTML berguna, parse `text/plain` **sebagai markdown** |

### Kolaborasi multi-user (referensi, bukan untuk v1)

| Pendekatan | Dipakai oleh | Pro | Kontra |
|---|---|---|---|
| **OT + server** | Google Docs, CKEditor 5 | Matang, server mengatur urutan | Sangat kompleks untuk tree (CKEditor: ~42 person-years) |
| **Central authority + rebase steps** | ProseMirror, CodeMirror 6 | Sederhana; penulis ProseMirror menolak OT klasik karena "a nightmare to implement" | Butuh server; lemah untuk offline |
| **CRDT** | Yjs (Tiptap, Lexical), Notion (RGA + Peritext, 2025) | Offline-first, tanpa server pengatur urutan | Anomali format di batas mark (lihat riset Peritext, Ink & Switch); overhead memori (tombstone) |

Duplikasi pada edit bersamaan dicegah dengan ID unik per karakter `(clientId, clock)` dan pengurutan deterministik. Pelajaran Notion: last-writer-wins per blok membuat edit satu orang bisa "completely lost".

**Untuk markpiw:** file lokal di-versi-kan git, jadi kolaborasi v1 = merge git. Pintu tetap terbuka jika engine memakai *step* yang bisa diserialisasi + ID blok stabil + serializer deterministik.

---

## 3. Markdown round-trip: masalah terbesar untuk file di git

### Tiga keluarga

| Keluarga | Contoh | Pro | Kontra |
|---|---|---|---|
| **(a) Model kaya = kebenaran; parse saat buka, serialize seluruh file saat simpan** | Milkdown, Tiptap markdown, BlockNote, MarkText, Notion, Vditor | UX paling Notion-like | Setiap simpan menormalisasi seluruh file. Penulis ProseMirror: parse/serialize markdown "will never be lossless". MarkText: buka file saja sudah dianggap berubah, list jadi loose, nomor diurut ulang (issue #2189). Tiptap: escape setiap `~`, task list jadi loose, hard break hilang. BlockNote menamai fungsinya `blocksToMarkdownLossy` |
| **(b) Teks markdown = kebenaran + dekorasi render (live preview)** | Obsidian Live Preview, Zettlr, Typora (sebagian) | Byte yang tidak disentuh tidak pernah berubah | UX "editor teks canggih", bukan Notion; sintaks muncul saat kursor mendekat; tabel sulit; praktis butuh engine code editor (CodeMirror 6) |
| **(c) Hybrid: model kaya, tetapi menyimpan potongan source asli** | GitLab rich text editor (2022–2026) | UX blok kaya **dan** blok yang tidak disentuh tetap identik byte-per-byte | Butuh posisi source yang akurat; blok yang diedit tetap dinormalisasi; GitLab masih memperbaiki regresi (mis. `a*b*c` → `a_b_c`, issue #628280) |

GitLab adalah studi kasus paling relevan: epic #7256 mencatat edit satu kata menulis ulang marker list di file 2.500 baris. Percobaan pertama mereka gagal karena *source map* parser lama tidak akurat; pendekatan baru bergantung pada "accurate sourcemaps for all block and inline elements".

### Teknik fidelity

1. **Simpan potongan source per blok** (`source.slice(start, end)`) + flag `dirty`. Saat simpan, blok bersih ditulis apa adanya; hanya blok kotor yang di-serialize ulang. Buka → simpan tanpa edit = identik byte-per-byte.
2. **Deteksi gaya file** saat dibuka (karakter bullet, `*` vs `_`, gaya fence, indentasi list, penomoran list) dan pakai untuk blok yang di-serialize ulang.
3. **Blok mentah (opaque)** untuk yang tidak didukung model: frontmatter, HTML block, komentar HTML, definisi link referensi, footnote. Ditampilkan & diedit sebagai source, disimpan persis.
4. **Escape minimal**: escape hanya jika karakter benar-benar mengubah hasil parse (sumber diff noise #1: `\_`, `\~`, `&#x20;`).
5. **Jebakan lain**: hard break (dua spasi vs backslash), tight vs loose list (`spread`), padding kolom tabel, link referensi jangan diubah jadi inline.
6. **Jaring pengaman**: setiap simpan, parse ulang output dan bandingkan AST dengan model; jika berbeda, tolak/jatuh ke mode source. Test korpus: buka → simpan → `git diff` harus kosong pada semua `.md` nyata di repo tim.

### Pilihan parser

| Parser | Posisi source | Serializer | Catatan |
|---|---|---|---|
| **micromark + mdast-util-from-markdown (+gfm, frontmatter)** | Lengkap, offset di setiap node, event untuk setiap byte | Ada (mdast-util-to-markdown, tapi menormalisasi) | 100% CommonMark & GFM, ~2k test, fuzzing. Paling cocok untuk keluarga (c) |
| markdown-it | Hanya blok (rentang baris) | Tidak | Cepat; terlalu kasar untuk preservasi inline |
| marked | Tidak ada (bisa diturunkan dari `raw`) | Tidak | Paling longgar terhadap spec |
| commonmark.js | Hanya blok | Tidak (HTML saja) | Tanpa GFM |
| @lezer/markdown | Lengkap, incremental | Tidak | Sengaja menyimpang dari spec (link reference tidak divalidasi) |
| **Parser sendiri** | Sesuai desain kita | Sesuai desain kita | CommonMark 0.31.2 = 652 contoh + ekstensi GFM. Area rawan: delimiter emphasis ("rule of 3"), lazy continuation, indentasi list, HTML block. Parser GitHub sendiri (cmark-gfm) kena CVE waktu kuadratik 2020 & 2023. Estimasi [inf]: 1–2 engineer-month untuk lolos test suite + ekor panjang |

---

## 4. Tech stack UI & host

### Framework UI (untuk "chrome" di sekitar editor)

Pola wajib apa pun frameworknya: framework hanya me-render satu elemen host kosong yang tidak pernah di-render ulang; engine mempublikasikan *store* kecil (mark aktif, tipe blok, query slash, posisi caret) yang dibaca UI (`useSyncExternalStore` di React). Slash menu tidak boleh mengambil fokus (pola combobox + `aria-activedescendant`).

| Opsi | Interop contenteditable | Runtime (gzip, ±) | Ekosistem |
|---|---|---|---|
| React 19 | Pola isolasi terbukti (Lexical, Tiptap) | ~55–60 KB | Terbesar; React Aria/Radix, Floating UI |
| Preact | Sama dengan React | ~4–5 KB | Pakai library React via `preact/compat` |
| Vue 3 | Baik (`v-once` / ref host) | ~33 KB | Baik |
| Svelte 5 | Sangat baik (tanpa VDOM) | Kecil | Lebih kecil, paling disukai |
| Solid | Sangat baik | ~7 KB | Kecil |
| TypeScript murni | Tanpa konflik | 0 | Menu, fokus, a11y dibuat sendiri |

Ukuran bundle hampir tidak relevan di webview VS Code (dimuat dari disk lokal).

### VS Code

- **Fakta penting:** VS Code 1.131 (Juli 2026) memperkenalkan *hybrid Markdown editor* eksperimental (utamanya di Agents window, bisa dipilih via "Reopen Editor With"). markpiw akan bersanding dengannya di daftar "Open With…" — nilai tambah kita: engine yang sama dengan versi web, UX Notion-like, dan alur `./assets`.
- `CustomTextEditorProvider` dengan `priority: "option"`. `TextDocument` = sumber kebenaran tersimpan.
- Kirim **`WorkspaceEdit` minimal** (sampel resmi mengganti seluruh dokumen dan menyatakan ekstensi nyata "should compute minimal edits").
- `onDidChangeTextDocument` juga terpicu oleh edit kita sendiri → simpan baseline sebelum `applyEdit` untuk mencegah *echo loop*.
- Undo: Ctrl/Cmd+Z di webview diteruskan ke undo native VS Code. Pakai undo native di host VS Code; di web pakai history engine — keduanya di balik interface `host.history`.
- `retainContextWhenHidden: false` (memori tinggi); simpan scroll/seleksi via `getState/setState`.
- CSP ketat (`default-src 'none'`, script dengan nonce); `localResourceRoots` sempit (folder workspace + folder dokumen); gambar via `asWebviewUri`; simpan aset via `workspace.fs`.
- Tema via variabel CSS `--vscode-*`; `@vscode/webview-ui-toolkit` sudah diarsip (Jan 2025).
- Ekstensi yang ada (zaaack/Vditor, Unotes, Mark Sharp) semuanya punya keluhan **memformat ulang markdown** — pelajaran utama: jangan pernah menulis saat load/normalisasi, hanya saat user mengedit dan hanya rentang yang diedit.
- Distribusi: `vsce package --no-dependencies` → `.vsix` internal (tidak auto-update), atau Private Marketplace jika punya GitHub Enterprise.

### File System Access API (web)

- Hanya Chromium desktop (Chrome/Edge 86+). Safari & Firefox tidak mendukung (dan menolak secara prinsip); Android tidak.
- Izin persisten sejak Chrome 122; simpan handle folder di IndexedDB; `requestPermission` butuh gesture user.
- Perubahan eksternal: `FileSystemObserver` (eksperimental) jika ada; selain itu polling `lastModified` saat fokus; cek konflik sebelum menulis.
- Fallback non-Chromium: buka file tunggal / unduh, atau mode baca saja.

### Tooling

pnpm workspaces · Vite (SPA + harness dev) · esbuild (extension host & bundle webview) · TypeScript strict + project references · Vitest (model, parser, golden round-trip) · Playwright (E2E contenteditable) · `@vscode/test-cli` + `@vscode/test-electron` (sinkronisasi provider).

---

## 5. Rekomendasi untuk markpiw

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Engine editor | **Dibangun sendiri**: model immutable sebagai kebenaran, satu root `contenteditable`, input hybrid (`beforeinput` untuk aksi struktural; teks & IME native lalu dibaca balik), reconciler ber-key sendiri, transaksi *step* + peta posisi, history 500 ms | Konsensus ProseMirror/Lexical/CKEditor; menghindari kelas bug DOM-as-truth |
| Markdown I/O | **Keluarga (c)**: blok menyimpan source asli, hanya blok kotor di-serialize ulang, deteksi gaya file, blok mentah untuk sintaks tak didukung, guard parse-ulang saat simpan | Satu-satunya cara memenuhi "tidak merusak file + diff minimal" dengan UX Notion |
| Parser | micromark + mdast-util-from-markdown + gfm + frontmatter, **di balik interface** sendiri; serializer **ditulis sendiri** | Posisi akurat adalah prasyarat (c); GitLab gagal karena source map tidak akurat. Interface membuka jalan mengganti dengan parser sendiri nanti |
| UI chrome | React 19 + TypeScript; Floating UI untuk posisi menu (opsional, bisa ditulis sendiri) | Pola isolasi terbukti, ekosistem terbesar |
| Target browser v1 | Chromium desktop (Chrome/Edge) + webview VS Code (Electron/Chromium) | FS Access API hanya Chromium; memangkas besar matriks IME/Android/Safari |
| Host | Interface `FileHost` (baca/tulis teks, simpan aset, resolve URL gambar, perubahan eksternal, history) dengan 2 implementasi: web & VS Code | Engine tidak tahu apa-apa soal file |
| Kolaborasi | Tidak di v1; desain step serializable + ID blok stabil | Pintu terbuka untuk rebase/CRDT nanti |

### Estimasi realistis [inf]

Bagian paling mahal bukan parser, melainkan engine contenteditable (seleksi, IME, undo, paste) dan serializer (escape & gaya). Untuk v1 yang solid, harapkan hitungan **beberapa engineer-quarter**, bukan minggu. Membatasi target ke Chromium desktop dan keluarga (c) per-blok (preservasi inline = fase 2, seperti GitLab) adalah cara utama menjaga skop.

### Bukan untuk v1

Canvas/layout sendiri, spellcheck sendiri, CRDT/OT, blok bersarang di dalam sel tabel (GFM tidak mengizinkan), drag handle, bubble menu.
