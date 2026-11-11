# Tasks: Task Comments

Referensi: `design.md`, `requirements.md`  
Konvensi branch dan commit: `CONTRIBUTING.md`

Setiap task = satu branch = satu PR. Task berikutnya dimulai setelah PR sebelumnya di-merge.

Status: `[ ]` belum dimulai · `[~]` in progress · `[x]` selesai

---

## Urutan dan Dependensi

```
T1 (schema) → T2 (API contract) → T3 (backend) → T4 (frontend) → T5 (reactions BE) → T6 (reactions FE)
                                               ↘ T5 (paralel setelah T3)
```

T2 dan T4 bisa dimulai paralel oleh FE setelah T2 selesai karena API contract sudah cukup sebagai pegangan.

---

## Tasks

### T1 — Schema database: comments dan mentions
**Komponen:** Backend  
**Branch:** `feature/backend-schema-comments`  
**PR title:** `feat(backend): schema tabel comments dan comment_mentions`  
**Status:** `[ ]`  
**Dependensi:** —

Yang dikerjakan:
- [ ] Migration `00NNN_comments.sql`: tabel `comments` dengan kolom `id, task_id, author_id, body, edited_at, deleted_at, created_at, updated_at`
- [ ] Index `comments_task_id_idx ON comments (task_id, id)` untuk listing oldest-first
- [ ] Migration `00NNN_comment_mentions.sql`: tabel `comment_mentions` dengan PK `(comment_id, user_id)`
- [ ] Setiap migration punya `-- +goose Up` dan `-- +goose Down` yang simetris
- [ ] Komentar satu baris di atas `Up` menjelaskan intent bisnis, bukan teknis SQL

Verifikasi:
- [ ] `make -C backend migrate` dari DB kosong berhasil
- [ ] `make -C backend verify` hijau

---

### T2 — API Contract: comment endpoints di openapi.yaml
**Komponen:** Backend  
**Branch:** `feature/backend-contract-comments`  
**PR title:** `feat(backend): contract API comments di openapi.yaml`  
**Status:** `[ ]`  
**Dependensi:** T1

Yang dikerjakan:
- [ ] Tambah path `GET /api/v1/tasks/{task_id}/comments` (operationId: `ListComments`)
- [ ] Tambah path `POST /api/v1/tasks/{task_id}/comments` (operationId: `CreateComment`)
- [ ] Tambah path `PATCH /api/v1/comments/{comment_id}` (operationId: `UpdateComment`)
- [ ] Tambah path `DELETE /api/v1/comments/{comment_id}` (operationId: `DeleteComment`)
- [ ] Schema `Comment` dengan semua field (lihat `design.md` bagian Response Shape)
- [ ] Schema `CommentCreate` untuk request body
- [ ] Schema `CommentPage` untuk pagination response
- [ ] Semua error response menggunakan `$ref` ke komponen bersama (Unauthorized, Forbidden, NotFound, ValidationError)
- [ ] Setiap schema menggunakan `additionalProperties: false`
- [ ] `make -C backend gen` dan `make -C backend check` hijau (generated code sinkron)

Verifikasi:
- [ ] `make -C backend verify` hijau
- [ ] FE engineer bisa mulai T4 berdasarkan contract ini tanpa perlu menunggu T3

---

### T3 — Backend: service dan handler
**Komponen:** Backend  
**Branch:** `feature/backend-impl-comments`  
**PR title:** `feat(backend): implementasi comment service dan handler`  
**Status:** `[ ]`  
**Dependensi:** T2

Yang dikerjakan:
- [ ] SQL queries di `db/queries/comments.sql`: `InsertComment`, `ListComments`, `GetComment`, `UpdateCommentBody`, `SoftDeleteComment`, `InsertCommentMentions`, `DeleteCommentMentions`, `ListMentionsForComments`, `CountSpaceMembersAmong`
- [ ] `make -C backend gen` untuk regenerate `internal/dbgen/`
- [ ] `internal/comment/service.go`: `Create`, `List`, `Update`, `Delete`
  - Create: validasi mention, INSERT dalam satu transaksi bersama notifikasi dan activity event
  - Update: hanya penulis (`authored()` helper); notifikasi hanya untuk mention baru
  - Delete: soft delete, hanya penulis
  - List: filter `deleted_at IS NULL`, oldest-first, keyset pagination
- [ ] `internal/comment/handler.go`: 4 method implement interface `apigen.StrictServerInterface`
- [ ] Daftarkan `CommentHandler` di `internal/app/app.go`
- [ ] Contract test untuk setiap endpoint menggunakan `apitest.Client`
  - Happy path per endpoint
  - Semua kasus 403: bukan penulis tidak bisa edit/delete
  - Semua kasus 404: orang luar, task tidak ada
  - 400: mention non-member, body kosong, body terlalu panjang

Verifikasi:
- [ ] `make -C backend verify` hijau
- [ ] Setiap test baru **gagal dulu** sebelum implementasi ditulis, baru lulus setelah selesai

---

### T4 — Frontend: API layer dan CommentsPanel
**Komponen:** Frontend  
**Branch:** `feature/frontend-comments`  
**PR title:** `feat(frontend): comments panel di task detail`  
**Status:** `[ ]`  
**Dependensi:** T2 (contract sudah ada), T3 bisa jalan paralel dengan mock

Yang dikerjakan:
- [ ] `frontend/src/features/comments/api/comments.ts`: `listComments`, `createComment`, `updateComment`, `deleteComment`
  - Wire types (snake_case) dikonversi ke domain types (camelCase) di layer ini
  - `validBody()`: trim dan validasi client-side sebelum fetch
- [ ] `frontend/src/features/comments/types/index.ts`: definisi `Comment` domain type
- [ ] React Query hooks di `hooks/`: `useComments`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`
- [ ] `CommentsPanel` component: list komentar, form input, edit inline, hapus dengan konfirmasi
  - Tampilkan `edited_at` jika tidak null
  - Tombol edit/hapus hanya tampil jika `author.id === currentUser.id`
  - Empty state untuk task tanpa komentar
- [ ] `index.ts` hanya mengekspor `CommentsPanel`
- [ ] Integrasikan `CommentsPanel` di task detail view

Verifikasi:
- [ ] `pnpm typecheck` hijau
- [ ] `pnpm lint` hijau
- [ ] Manual test: buat, edit, hapus komentar di task detail

---

### T5 — Backend: reactions
**Komponen:** Backend  
**Branch:** `feature/backend-reactions`  
**PR title:** `feat(backend): comment reactions`  
**Status:** `[ ]`  
**Dependensi:** T3

Yang dikerjakan:
- [ ] Migration `00NNN_comment_reactions.sql`: tabel `comment_reactions` dengan PK `(comment_id, user_id, emoji)`; extend constraint `notifications_type_check` dengan `comment.reaction`
- [ ] SQL queries: `InsertCommentReaction`, `DeleteCommentReaction`, `ListReactionsForComments`
- [ ] `AddReaction` dan `RemoveReaction` di `service.go`
  - AddReaction: INSERT OR IGNORE (idempoten); kirim notifikasi ke penulis komentar jika reactor bukan penulis; cek batas 20 emoji unik per user per komentar
  - RemoveReaction: DELETE (idempoten)
- [ ] API contract di `openapi.yaml`: `PUT` dan `DELETE` `/comments/{id}/reactions/{emoji}` (operationId: `AddCommentReaction`, `RemoveCommentReaction`)
- [ ] Handler di `handler.go`: `AddCommentReaction`, `RemoveCommentReaction`
- [ ] Contract test: idempoten PUT, idempoten DELETE, batas 20 reactions → 409, orang luar → 404

Verifikasi:
- [ ] `make -C backend verify` hijau

---

### T6 — Frontend: reactions UI
**Komponen:** Frontend  
**Branch:** `feature/frontend-reactions`  
**PR title:** `feat(frontend): emoji reactions di komentar`  
**Status:** `[ ]`  
**Dependensi:** T4, T5

Yang dikerjakan:
- [ ] API functions: `addReaction`, `removeReaction` di `comments.ts`
- [ ] Update `Comment` type untuk menyertakan `reactions: { emoji, count, reacted_by_me }[]`
- [ ] Komponen reaction bar: tampilkan emoji + count; klik toggle add/remove
- [ ] Emoji picker untuk menambah reaksi baru
- [ ] Optimistic update: reaksi langsung terlihat sebelum server merespons

Verifikasi:
- [ ] `pnpm typecheck` hijau
- [ ] `pnpm lint` hijau
- [ ] Manual test: add, remove, toggle reaction; batas 20 emoji tampilkan pesan error

---

## Test Scenarios yang Perlu Di-update

Setelah T3 selesai, update status di `tests/scenarios/api.md`:

| ID | Skenario | Update |
|---|---|---|
| API-CMT-01 | Buat/list komentar; mention harus anggota Space | `ada sebagian` → `ada` |
| API-CMT-02 | Edit/hapus hanya penulis | `ada` (sudah ada di `comments.spec.ts`) |
| API-CMT-03 | Reaksi idempoten, maks 20 emoji | `baru` → `ada` setelah T5 |

---

## Catatan untuk Tim Berikutnya

Fitur ini adalah contoh pola **"write dengan side effects dalam satu transaksi"** — semua fitur yang membutuhkan notifikasi atau activity log sebaiknya mengikuti pola yang sama: notifikasi dan activity event di-INSERT dalam transaksi yang sama dengan data utamanya. Ini memastikan konsistensi: jika transaksi rollback, tidak ada notifikasi yang terkirim untuk data yang tidak jadi tersimpan.
