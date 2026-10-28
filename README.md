# markpiw

Editor markdown WYSIWYG in-house: edit langsung di tampilan jadi, file `.md` tetap bersih untuk di-review di git. Tersedia sebagai **web app** (folder lokal lewat File System Access API, Chrome/Edge) dan **extension VS Code**.

- Panduan uji manual: [docs/manual-testing.md](docs/manual-testing.md)
- Spesifikasi: [docs/superpowers/specs/2026-10-28-markpiw-design.md](docs/superpowers/specs/2026-10-28-markpiw-design.md)
- Roadmap: [docs/superpowers/plans/2026-10-28-markpiw-roadmap.md](docs/superpowers/plans/2026-10-28-markpiw-roadmap.md)

## Mulai cepat

Prasyarat: Node 24 dan pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev:web          # web di http://localhost:5173 (tambahkan ?demo untuk folder contoh)
pnpm package:vscode   # menghasilkan apps/vscode/markpiw.vsix
```

## Pengembangan

```bash
pnpm verify        # typecheck + lint + format:check + test (unit, golden, property, upstream ProseMirror)
pnpm test:e2e      # E2E web di Chrome terpasang (headless)
pnpm test:vscode   # test integrasi di VS Code terpasang (membuka jendela VS Code sementara)
```

## Struktur

| Path | Isi |
|---|---|
| `vendor/prosemirror/` | 10 paket ProseMirror yang di-vendor tanpa modifikasi |
| `packages/markdown` | Parse GFM ↔ dokumen, preservasi source, serializer, guard round-trip |
| `packages/editor` | `EditorController`: plugin, perintah, input rules, slash, paste, NodeView |
| `packages/ui` | Komponen React: toolbar, slash menu, popover, tema |
| `packages/host` | Interface `FileHost` (types only) |
| `apps/web` | SPA web (folder lokal + mode demo) |
| `apps/vscode` | Extension VS Code (custom editor) |
