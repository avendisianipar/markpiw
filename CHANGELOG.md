# Changelog

Semua perubahan penting pada markpiw akan dicatat di file ini.

Format dokumen mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) dan versi
rilis mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-11-02

### Changed

- Tampilan dokumen meniru render GitHub: padding halaman 32px (jarak kiri-kanan lebih rapat di
  VS Code), lebar konten maks. 1012px, serta ukuran dan jarak heading, paragraf, list, kode,
  dan tabel mengikuti `.markdown-body` GitHub.
- Callout tampil seperti alert GitHub: judul berikon, tanpa latar, dan marker `[!NOTE]`
  disembunyikan sampai kursor berada di baris marker.
- Tag HTML blok `<div align="…">`/`<p align="…">` tidak lagi tampil sebagai blok mentah; isinya
  ikut rata sesuai atribut. `<details>`/`<summary>` tampil terlipat dan bisa dibuka/ditutup.
  Source tag muncul saat kursor masuk ke wilayahnya; file tidak berubah.
- Tabel selebar isinya dengan baris belang; header kosong (`| | |`) tampil tipis.
- Diagram Mermaid dan blok rumus hanya menampilkan hasil render; klik untuk mengedit source.

## [1.0.0] - 2026-10-30

### Added

- Outline dokumen melayang untuk navigasi heading.
- Tema terang dan gelap yang konsisten di web app dan VS Code.
- Dukungan tabel lengkap, callout, rumus KaTeX, diagram Mermaid, dan syntax highlighting.
- Toolbar dan slash menu dengan item, ikon, label, dan grup yang konsisten.
- Metadata publisher extension `avendisianipar`.
- Lisensi MIT dan `THIRD_PARTY_NOTICES.txt` yang dibuat otomatis dari bundle.
- README dan fondasi komunitas open-source: panduan kontribusi, Code of Conduct, kebijakan
  keamanan, issue forms, pull request template, changelog, serta CI.

### Changed

- Identitas extension berubah dari `markpiw-internal.markpiw` menjadi
  `avendisianipar.markpiw`.

## [0.1.0] - 2026-10-29

### Added

- Editor Markdown WYSIWYG untuk VS Code.
- Toolbar, shortcut Markdown, dan slash menu.
- Dukungan tabel, task list, link, code block, dan gambar lokal.
- Preservasi source agar perubahan tetap terarah di Git diff.
- Save, undo, dan redo melalui mekanisme bawaan VS Code.
- Mode aman baca-saja ketika edit tidak dapat diserialisasi tanpa mengubah makna dokumen.
- Web app lokal dengan mode demo.

[Unreleased]: https://github.com/avendisianipar/markpiw/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/avendisianipar/markpiw/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/avendisianipar/markpiw/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/avendisianipar/markpiw/releases/tag/v0.1.0
