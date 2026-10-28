# markpiw

Editor markdown WYSIWYG in-house: edit langsung di preview, bisa dibuka di web (folder lokal via File System Access API) dan sebagai extension VS Code.

- Spesifikasi: [docs/superpowers/specs/2026-10-28-markpiw-design.md](docs/superpowers/specs/2026-10-28-markpiw-design.md)
- Roadmap: [docs/superpowers/plans/2026-10-28-markpiw-roadmap.md](docs/superpowers/plans/2026-10-28-markpiw-roadmap.md)

## Pengembangan

Prasyarat: Node 24 dan pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm verify   # typecheck + lint + format:check + test
```
