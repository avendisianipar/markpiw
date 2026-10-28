# Korpus markdown

Fixture untuk test golden `packages/markdown/test/golden.test.ts`. Setiap file `.md` di bawah direktori ini harus identik byte-per-byte setelah di-parse lalu diserialisasi tanpa edit.

- `gfm/` berisi fixture tulisan tangan untuk konstruk GFM dan kasus tepi format file: CRLF, line ending campuran, BOM, tanpa newline penutup, tab, dan lain-lain.
- `real/` (opsional) untuk file `.md` nyata dari repo internal.

File di sini ditandai `-text` di `.gitattributes`, sehingga git tidak menormalkan line ending atau BOM. Jangan memformat file-file ini dengan Prettier atau editor yang mengubah whitespace.

## Menambah file nyata dari repo perusahaan

1. Minta izin pemilik repo sumber. Dokumen internal bisa memuat informasi yang tidak boleh disalin ke repo lain (pertanyaan terbuka spec #3).
2. Salin file apa adanya, tanpa membuka dan menyimpannya di editor, ke `fixtures/markdown-corpus/real/<nama-repo>/<path>.md`.
3. Hapus atau samarkan informasi sensitif dengan mengganti teksnya saja; jangan mengubah struktur, whitespace, atau line ending.
4. Jalankan `pnpm --filter @markpiw/markdown exec vitest run test/golden.test.ts`. File baru otomatis ikut diuji.
5. Jika test gagal, itu bug serializer. Laporkan dengan nama file; jangan "memperbaiki" fixture-nya.
