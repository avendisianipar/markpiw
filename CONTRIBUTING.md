# Berkontribusi ke markpiw

Terima kasih sudah mempertimbangkan kontribusi untuk markpiw. Kontribusi dapat berupa bug
report, usulan fitur, perbaikan dokumentasi, pengujian, atau kode.

Dengan berpartisipasi, Anda menyetujui [Code of Conduct](CODE_OF_CONDUCT.md) proyek ini.

## Sebelum mulai

- Cari [issue yang sudah ada](https://github.com/avendisianipar/markpiw/issues) agar laporan
  atau pekerjaan tidak duplikat.
- Untuk perubahan besar, buka feature request terlebih dahulu agar pendekatan dan ruang
  lingkupnya dapat disepakati.
- Jangan membuka issue publik untuk kerentanan. Ikuti [kebijakan keamanan](SECURITY.md).

## Menyiapkan lingkungan pengembangan

Prasyarat:

- Node.js 24
- pnpm 10 melalui Corepack
- Git

```bash
git clone https://github.com/avendisianipar/markpiw.git
cd markpiw
corepack enable
pnpm install
pnpm verify
```

Jalankan web app dengan:

```bash
pnpm dev:web
```

Buka `http://localhost:5173/?demo` untuk mencoba editor tanpa memilih folder lokal.

## Memilih verifikasi

Jalankan pemeriksaan yang sesuai dengan perubahan Anda:

| Perubahan | Verifikasi minimum |
|---|---|
| Dokumentasi | Periksa link dan rendering Markdown |
| Parser, serializer, editor, atau UI | `pnpm verify` |
| Perilaku web | `pnpm verify` dan `pnpm test:e2e` |
| Extension VS Code | `pnpm verify` dan `pnpm test:vscode` |

Untuk perubahan visual, sertakan screenshot atau rekaman singkat sebelum dan sesudah.

## Membuka pull request

Pull request yang baik:

1. Berfokus pada satu perubahan yang jelas.
2. Menjelaskan masalah dan alasan pendekatan yang dipilih.
3. Menautkan issue terkait jika tersedia.
4. Menyertakan test untuk perilaku baru atau perbaikan bug.
5. Memperbarui dokumentasi bila perilaku pengguna berubah.
6. Lulus pemeriksaan CI.

Maintainer dapat meminta perubahan ruang lingkup agar pull request tetap mudah di-review.

## Struktur singkat

- `packages/markdown`: parser, serializer, source preservation, dan round-trip guard.
- `packages/editor`: controller dan perilaku editing.
- `packages/ui`: komponen dan tema React.
- `apps/web`: host browser.
- `apps/vscode`: extension dan webview VS Code.
- `vendor/prosemirror`: source ProseMirror yang di-vendor; jangan diubah tanpa mengikuti
  proses vendor yang terdokumentasi.

## Melaporkan bug

Gunakan [form bug report](https://github.com/avendisianipar/markpiw/issues/new/choose). Sertakan:

- langkah reproduksi yang paling kecil;
- hasil yang diharapkan dan hasil aktual;
- versi markpiw, VS Code/browser, dan sistem operasi;
- contoh Markdown yang aman dibagikan;
- `git diff` dan informasi dari **Salin info diagnostik**, bila relevan.
