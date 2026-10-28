# markpiw — Roadmap Rencana Implementasi

Spesifikasi: [docs/superpowers/specs/2026-10-28-markpiw-design.md](../specs/2026-10-28-markpiw-design.md) (bagian 13, "Urutan pengerjaan").

Implementasi dikerjakan end-to-end oleh agen AI. Setiap fase punya rencananya sendiri, dan setiap rencana menghasilkan software yang lulus `pnpm verify` dengan sendirinya.

| Fase | Rencana | Status | Hasil yang bisa diuji |
|---|---|---|---|
| 1 | [2026-10-28-fase-1-fondasi-markdown.md](2026-10-28-fase-1-fondasi-markdown.md) | Selesai | Monorepo + ProseMirror ter-vendor (test upstream non-browser hijau) + `@markpiw/host` (types) + `@markpiw/markdown` (parse, preservasi source, serializer, guard, korpus golden, property test) |
| 2 | [2026-10-28-fase-2-4-editor-web-vscode.md](2026-10-28-fase-2-4-editor-web-vscode.md) | Dieksekusi | `@markpiw/editor` + `@markpiw/ui` + harness dev dengan host palsu; test browser `webtest-*` prosemirror-view dijalankan di sini (infrastruktur Playwright dibangun di fase ini) |
| 3 | (rencana Fase 2–4 yang sama) | Dieksekusi | `apps/web` |
| 4 | (rencana Fase 2–4 yang sama) | Dieksekusi | `apps/vscode` + `.vsix` |
| 5 | Fase 5: hardening & rilis | Setelah Fase 3 & 4 | IME, performa, `THIRD_PARTY_NOTICES`, SBOM, CI, dokumentasi, artefak rilis |

Rencana fase berikutnya ditulis (dengan skill `superpowers:writing-plans`) setelah fase sebelumnya selesai. Dengan begitu, rencana tersebut berangkat dari interface yang benar-benar ada di kode.
