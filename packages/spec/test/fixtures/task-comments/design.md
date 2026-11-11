# Design: Task Comments

Referensi prototype: `design/05-task-detail/`  
Referensi requirements: `requirements.md`

---

## Gambaran Sistem

Fitur komentar adalah sub-domain dari task. Setiap komentar melekat pada satu task, dimiliki oleh satu penulis, dan bisa mencantumkan mention ke anggota Space lain. Saat komentar dibuat atau diedit, side effect berupa notifikasi dikirim dalam satu transaksi yang sama.

```
Space Member
    │
    ├─► POST /tasks/{id}/comments ──► CommentService.Create()
    │       │                              │
    │       │                              ├─► INSERT comments
    │       │                              ├─► INSERT comment_mentions
    │       │                              ├─► INSERT notifications (mention)
    │       │                              ├─► INSERT notifications (task.comment → watcher)
    │       │                              └─► INSERT activity_events
    │       │
    ├─► PATCH /comments/{id} ────────► CommentService.Update()
    │       │                              │
    │       │                              ├─► UPDATE comments (body, edited_at)
    │       │                              ├─► DELETE + INSERT comment_mentions (bila mention_ids dikirim)
    │       │                              └─► INSERT notifications (hanya mention baru)
    │       │
    ├─► DELETE /comments/{id} ───────► CommentService.Delete()
    │       │                              └─► UPDATE comments SET deleted_at
    │       │
    └─► PUT/DELETE /comments/{id}/reactions/{emoji}
            │                         ► CommentService.AddReaction / RemoveReaction
            │                              ├─► INSERT/DELETE comment_reactions
            │                              └─► INSERT notifications (comment.reaction → penulis)
```

---

## Skema Database

### Tabel Utama

**`comments`** — dibuat di migration `00001_init.sql`
```
id          uuid PRIMARY KEY
task_id     uuid NOT NULL → tasks(id) ON DELETE CASCADE
author_id   uuid NOT NULL → users(id) ON DELETE RESTRICT
body        text NOT NULL
edited_at   timestamptz           -- NULL = belum pernah diedit
deleted_at  timestamptz           -- NULL = masih hidup (soft delete)
created_at  timestamptz NOT NULL
updated_at  timestamptz NOT NULL
```
Index: `(task_id, id)` — untuk listing urut oldest-first dengan pagination.

**`comment_mentions`** — ditambah di migration `00004_comment_mentions.sql`
```
comment_id  uuid NOT NULL → comments(id) ON DELETE CASCADE
user_id     uuid NOT NULL → users(id) ON DELETE RESTRICT
PRIMARY KEY (comment_id, user_id)
```
Mention adalah relasi many-to-many antara komentar dan anggota Space.

**`comment_reactions`** — ditambah di migration `00029_comment_reactions.sql`
```
comment_id  uuid NOT NULL → comments(id) ON DELETE CASCADE
user_id     uuid NOT NULL → users(id) ON DELETE CASCADE
emoji       text NOT NULL  CHECK (char_length BETWEEN 1 AND 32)
created_at  timestamptz NOT NULL
PRIMARY KEY (comment_id, user_id, emoji)
```
Desain PK memastikan satu user hanya punya satu reaksi per emoji per komentar (idempoten by design).

### Evolusi Schema

| Migration | Perubahan | Alasan |
|---|---|---|
| `00001_init.sql` | Tabel `comments` (tanpa mentions) | Schema awal, comments sudah ada sejak hari pertama |
| `00004_comment_mentions.sql` | Tabel `comment_mentions` | Mentions ditambahkan setelah schema awal, sebagai fitur terpisah |
| `00011_notifications.sql` | Tabel `notifications` dengan tipe `comment.mention` | Notifikasi in-app pertama kali ditambahkan untuk mention |
| `00023_notification_events.sql` | Tambah tipe `task.comment`, `task.assigned`, `task.status_changed` | Extend notifikasi ke lebih banyak event |
| `00029_comment_reactions.sql` | Tabel `comment_reactions`, tambah tipe `comment.reaction` | Reactions ditambahkan sebagai fitur tersendiri, sekaligus memperluas notifikasi |

---

## API Endpoints

Semua endpoint memerlukan autentikasi (cookie `gli_session` atau Bearer token).  
Error selalu `application/problem+json` dengan field `code` dan `detail`.

### Comments

| Method | Path | Auth | Status sukses | Deskripsi |
|---|---|---|---|---|
| `GET` | `/api/v1/tasks/{task_id}/comments` | Space member | 200 | List komentar, oldest-first, paginated |
| `POST` | `/api/v1/tasks/{task_id}/comments` | Space member | 201 | Buat komentar baru |
| `PATCH` | `/api/v1/comments/{comment_id}` | Penulis saja | 200 | Edit body dan/atau mentions |
| `DELETE` | `/api/v1/comments/{comment_id}` | Penulis saja | 204 | Soft-delete |

### Reactions

| Method | Path | Auth | Status sukses | Deskripsi |
|---|---|---|---|---|
| `PUT` | `/api/v1/comments/{comment_id}/reactions/{emoji}` | Space member | 200 | Tambah reaksi (idempoten) |
| `DELETE` | `/api/v1/comments/{comment_id}/reactions/{emoji}` | Space member | 200 | Hapus reaksi (idempoten) |

### Request / Response Shape

**POST/PATCH body:**
```json
{
  "body": "string (1–10.000 karakter)",
  "mention_ids": ["uuid", "..."]   // opsional; PATCH: null = jangan ubah, [] = kosongkan
}
```

**Comment response:**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "author": { "id": "uuid", "display_name": "string", "avatar_url": "string|null" },
  "body": "string",
  "mentions": [{ "id": "uuid", "display_name": "string", "avatar_url": "string|null" }],
  "reactions": [{ "emoji": "string", "count": 1, "reacted_by_me": true }],
  "edited_at": "RFC3339|null",
  "created_at": "RFC3339"
}
```

**Pagination response:**
```json
{
  "data": [ /* Comment[] */ ],
  "next_cursor": "string|null"
}
```

---

## Authorization Matrix

| Aksi | Space member | Penulis | Leader | Orang luar |
|---|---|---|---|---|
| List komentar | ✅ | ✅ | ✅ | 404 |
| Tulis komentar | ✅ | ✅ | ✅ | 404 |
| Edit komentar | ❌ 403 | ✅ | ❌ 403 | 404 |
| Hapus komentar | ❌ 403 | ✅ | ❌ 403 | 404 |
| Tambah/hapus reaksi | ✅ | ✅ | ✅ | 404 |

> **Catatan desain:** Leader tidak mendapat hak istimewa untuk edit/hapus komentar orang lain.
> Ini berbeda dari pengelolaan task. Alasannya: komentar adalah ekspresi personal, bukan artefak kerja tim.

---

## Alur Transaksi

Semua operasi write berjalan dalam satu transaksi database:

**Create comment:**
```
BEGIN
  INSERT comments
  INSERT comment_mentions (deduplicated)
  INSERT notifications type=comment.mention  (untuk mention selain penulis)
  INSERT notifications type=task.comment     (untuk watcher: follower + assignee, dikurangi penulis + yang di-mention)
  INSERT activity_events type=comment.added
COMMIT
```

**Update comment:**
```
BEGIN
  UPDATE comments SET body, edited_at
  IF mention_ids dikirim:
    DELETE comment_mentions WHERE comment_id
    INSERT comment_mentions (mentions baru)
    INSERT notifications type=comment.mention  (hanya untuk mention BARU, bukan yang sudah ada)
COMMIT
```

**Add reaction:**
```
BEGIN
  INSERT comment_reactions (ON CONFLICT DO NOTHING → idempoten)
  INSERT notifications type=comment.reaction  (ke penulis komentar, kecuali jika penulis = reactor)
COMMIT
```

---

## Error Codes

| HTTP | Code | Kondisi |
|---|---|---|
| 400 | `validation_failed` | `body` kosong, terlalu panjang, field asing, atau `mention_ids` berisi non-member |
| 401 | `unauthenticated` | Tidak ada sesi |
| 403 | `forbidden` | Bukan penulis (edit/delete) |
| 404 | `not_found` | Task atau komentar tidak ditemukan, atau bukan anggota Space |
| 409 | `too_many_reactions` | Lebih dari 20 emoji unik per user per komentar |

---

## Komponen Frontend

Fitur ini hidup di `frontend/src/features/comments/`.

```
comments/
  api/
    comments.ts        # listComments, createComment, updateComment, deleteComment
  components/
    comments-panel.tsx # Panel utama yang di-render di task detail
  hooks/               # React Query hooks untuk fetching dan mutation
  types/               # Comment domain type (camelCase, sudah dikonversi dari wire)
  index.ts             # Public surface: hanya CommentsPanel yang diekspor
```

**Pola API layer:**
- Wire types (snake_case JSON dari server) dikonversi ke domain types (camelCase) di `api/comments.ts`
- Validasi client-side (`validBody()`) dilakukan sebelum request dikirim untuk UX yang lebih baik
- Error dari server (`ApiError` dengan `code` dan `detail`) ditangani di komponen

---

## Keputusan Desain

| Keputusan | Alternatif yang Ditolak | Alasan |
|---|---|---|
| Soft delete, bukan hard delete | Hard delete | Menjaga integritas referensial notification yang menunjuk ke comment; audit trail tetap ada |
| Edit restriction hanya penulis, leader tidak bisa | Leader bisa edit/hapus semua komentar | Komentar adalah ekspresi personal; memberi leader hak tersebut menurunkan kepercayaan tim terhadap diskusi |
| Notifikasi dikirim dalam transaksi yang sama | Async queue | Konsistensi lebih penting dari performa di skala saat ini; jika commit berhasil, notifikasi pasti terkirim |
| Mention hanya untuk Space member | Siapa saja bisa di-mention | Mencegah kebocoran informasi task ke pihak luar Space |
| Reaksi idempoten (PUT = insert or ignore) | 409 jika sudah ada | UX lebih bersih; double-click atau retry tidak menghasilkan error |
