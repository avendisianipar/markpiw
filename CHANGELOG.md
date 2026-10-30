# Changelog

Semua perubahan penting pada markpiw akan dicatat di file ini.

Format dokumen mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) dan versi
rilis mengikuti [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/avendisianipar/markpiw/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/avendisianipar/markpiw/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/avendisianipar/markpiw/releases/tag/v0.1.0
