# markpiw — Roadmap Rencana Implementasi

Spesifikasi: [docs/superpowers/specs/2026-10-28-markpiw-design.md](../specs/2026-10-28-markpiw-design.md) (bagian 13, "Urutan pengerjaan").

Implementasi dikerjakan end-to-end oleh agen AI. Setiap fase punya rencananya sendiri, dan setiap rencana menghasilkan software yang lulus `pnpm verify` dengan sendirinya.

| Fase | Rencana | Status | Hasil yang bisa diuji |
|---|---|---|---|
| 1 | [2026-10-28-fase-1-fondasi-markdown.md](2026-10-28-fase-1-fondasi-markdown.md) | Siap dieksekusi | Monorepo + ProseMirror ter-vendor (test upstream non-browser hijau) + `@markpiw/host` (types) + `@markpiw/markdown` (parse, preservasi source, serializer, guard, korpus golden, property test) |
| 2 | Fase 2: editor + UI | Ditulis setelah Fase 1 selesai | `@markpiw/editor` + `@markpiw/ui` + harness dev dengan host palsu; test browser `webtest-*` prosemirror-view dijalankan di sini (infrastruktur Playwright dibangun di fase ini) |
| 3 | Fase 3: host web | Setelah Fase 2 | `apps/web` |
| 4 | Fase 4: host VS Code | Setelah Fase 2 (paralel dengan Fase 3) | `apps/vscode` + `.vsix` |
| 5 | Fase 5: hardening & rilis | Setelah Fase 3 & 4 | IME, performa, `THIRD_PARTY_NOTICES`, SBOM, CI, dokumentasi, artefak rilis |

Rencana fase berikutnya ditulis (dengan skill `superpowers:writing-plans`) setelah fase sebelumnya selesai. Dengan begitu, rencana tersebut berangkat dari interface yang benar-benar ada di kode.
