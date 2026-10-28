# ADR 0001: Vendor 10 paket ProseMirror tanpa modifikasi

Status: diterima (2026-10-28) · Spesifikasi: D7 · Analisis: [build vs fork](../research/2026-10-28-build-vs-fork-analysis.md)

## Konteks

markpiw dibangun mandiri tanpa produk editor pihak ketiga (Tiptap, Milkdown, BlockNote, CKEditor, dan sejenisnya). Analisis build vs fork membandingkan menulis engine dari nol dengan mengambil source yang relevan lalu mengembangkannya. Bagian tersulit sebuah editor contenteditable adalah lapisan view: sekitar 42% perbaikan di prosemirror-view berkaitan dengan quirk browser dan IME. Menulis ulang lapisan itu berarti mengulang bertahun-tahun perbaikan bug. ProseMirror berlisensi MIT, inti-nya sekitar 10 ribu baris, dan mirror GitHub-nya sudah tidak diperbarui; sumber kanonik ada di `code.haverbeke.berlin`.

## Keputusan

- Sepuluh paket (model, transform, state, view, history, inputrules, keymap, commands, schema-list, gapcursor) disalin utuh dari tag kanonik ke `vendor/prosemirror/<pkg>/` oleh `tooling/vendor/import.mjs`, satu commit per paket. Versi dan SHA tag dicatat di `tooling/vendor/packages.json` dan `VENDOR.md` tiap paket.
- File upstream tidak pernah diubah. Perubahan hanya lewat patch queue `vendor/prosemirror/patches/*.patch` dengan header DEP-3, dengan target nol patch.
- Paket dikonsumsi sebagai source: TS `paths` + project reference (deklarasi ke `vendor/prosemirror/.types/`) untuk tipe, alias Vite/Vitest (`tooling/vendor-aliases.ts`) untuk runtime. Tidak ada build step dan tidak ada paket npm `prosemirror-*` di dependensi runtime.
- Test upstream non-browser dijalankan di Vitest sebagai bagian dari `pnpm test`.
- Lapisan markdown, UI, dan host ditulis sendiri.

## Konsekuensi

- Kita memiliki seluruh kode yang dikirim, bisa membaca dan men-debug engine langsung, dan bebas dari keputusan produk pihak ketiga.
- Kewajiban sinkronisasi: paket harus diperbarui ≤ 3 bulan setelah rilis minor upstream; `pnpm vendor:drift` mendeteksi ketertinggalan.
- Lisensi MIT mewajibkan pemberitahuan hak cipta tetap ada (`LICENSE` per paket; `THIRD_PARTY_NOTICES` di Fase 5).
- Setiap patch lokal menambah biaya merge saat sinkronisasi, sehingga perbaikan sebaiknya dikirim ke upstream lebih dulu.
