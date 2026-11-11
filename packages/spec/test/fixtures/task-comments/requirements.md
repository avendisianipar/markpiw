# Requirements: Task Comments

Workflow: **Design-First** — spesifikasi ini diderivasi dari implementasi yang sudah berjalan
dan prototype di `design/05-task-detail/`. Digunakan sebagai baseline formula dokumentasi tim.

---

## User Stories

### Sebagai Space member, saya ingin menulis komentar di task
Agar saya bisa berdiskusi dan memberikan update terkait pekerjaan dalam konteks yang tepat.

### Sebagai penulis komentar, saya ingin mengedit komentar saya sendiri
Agar saya bisa memperbaiki typo atau menambah informasi tanpa harus menulis komentar baru.

### Sebagai penulis komentar, saya ingin menghapus komentar saya sendiri
Agar saya bisa menarik komentar yang tidak relevan atau keliru.

### Sebagai Space member, saya ingin me-mention anggota lain di komentar
Agar orang yang relevan mendapat notifikasi dan bisa merespons langsung.

### Sebagai Space member, saya ingin memberikan reaksi emoji di komentar
Agar saya bisa merespons singkat tanpa perlu menulis komentar baru.

---

## Requirements

### FR-1: Menulis Komentar

WHEN Space member mengirim POST ke `/api/v1/tasks/{task_id}/comments` dengan `body` yang valid  
THE SYSTEM SHALL menyimpan komentar dan mengembalikan representasi komentar dengan status 201

WHEN Space member mengirim komentar  
THE SYSTEM SHALL mencatat `comment_count` pada task bertambah satu

WHEN `body` kosong, melebihi 10.000 karakter, atau field asing dikirim  
THE SYSTEM SHALL menolak dengan 400 `validation_failed`

WHEN pengguna yang bukan anggota Space mencoba menulis komentar  
THE SYSTEM SHALL mengembalikan 404 (tidak membocorkan keberadaan task)

WHEN task tidak ditemukan  
THE SYSTEM SHALL mengembalikan 404

### FR-2: Membaca Komentar

WHEN Space member mengambil GET `/api/v1/tasks/{task_id}/comments`  
THE SYSTEM SHALL mengembalikan halaman komentar yang belum dihapus, diurutkan dari yang terlama

WHEN jumlah komentar melebihi satu halaman  
THE SYSTEM SHALL menyediakan `next_cursor` untuk mengambil halaman berikutnya

WHEN cursor yang dikirim tidak valid  
THE SYSTEM SHALL mengembalikan 400

### FR-3: Mengedit Komentar

WHEN penulis komentar mengirim PATCH `/api/v1/comments/{comment_id}` dengan `body` baru  
THE SYSTEM SHALL memperbarui isi komentar dan mengisi `edited_at`

WHEN `mention_ids` dikirim bersamaan dengan edit  
THE SYSTEM SHALL mengganti seluruh daftar mention dengan yang baru

WHEN `mention_ids` tidak dikirim  
THE SYSTEM SHALL mempertahankan daftar mention yang ada

WHEN pengguna yang bukan penulis — termasuk leader — mencoba mengedit  
THE SYSTEM SHALL mengembalikan 403

### FR-4: Menghapus Komentar

WHEN penulis komentar mengirim DELETE `/api/v1/comments/{comment_id}`  
THE SYSTEM SHALL soft-delete komentar dan mengembalikan 204

WHEN komentar dihapus  
THE SYSTEM SHALL menghilangkannya dari daftar dan mengurangi `comment_count` di task

WHEN komentar yang sudah dihapus diakses untuk edit atau hapus ulang  
THE SYSTEM SHALL mengembalikan 404

WHEN pengguna yang bukan penulis — termasuk leader — mencoba menghapus  
THE SYSTEM SHALL mengembalikan 403

### FR-5: Mention Anggota

WHEN penulis menyertakan `mention_ids` saat membuat komentar  
THE SYSTEM SHALL menyimpan mention dan mengirim notifikasi `comment.mention` ke setiap anggota yang di-mention, kecuali penulisnya sendiri

WHEN `mention_ids` berisi id yang sama lebih dari sekali  
THE SYSTEM SHALL menghilangkan duplikat sebelum disimpan

WHEN `mention_ids` berisi id yang bukan anggota Space  
THE SYSTEM SHALL menolak seluruh permintaan dengan 400 `validation_failed`

WHEN penulis mengedit komentar dan `mention_ids` baru memuat anggota yang belum pernah di-mention sebelumnya  
THE SYSTEM SHALL mengirim notifikasi `comment.mention` hanya untuk anggota yang baru di-mention

### FR-6: Notifikasi Komentar ke Follower dan Assignee

WHEN komentar baru dibuat  
THE SYSTEM SHALL mengirim notifikasi `task.comment` ke follower task dan assignee yang bukan penulis dan belum di-mention

WHEN task punya co-assignee  
THE SYSTEM SHALL menyertakan co-assignee dalam penerima notifikasi `task.comment`

### FR-7: Reaksi Emoji

WHEN Space member mengirim PUT ke `/api/v1/comments/{comment_id}/reactions/{emoji}`  
THE SYSTEM SHALL menambahkan reaksi; idempoten bila emoji yang sama sudah ada

WHEN jumlah emoji unik yang dimiliki satu pengguna di satu komentar melebihi 20  
THE SYSTEM SHALL menolak dengan 409 `too_many_reactions`

WHEN Space member mengirim DELETE ke `/api/v1/comments/{comment_id}/reactions/{emoji}`  
THE SYSTEM SHALL menghapus reaksi; idempoten bila reaksi tidak ada

WHEN reaksi ditambahkan  
THE SYSTEM SHALL mengirim notifikasi `comment.reaction` ke penulis komentar, kecuali bila penulis adalah yang memberi reaksi

---

## Non-Functional Requirements

WHEN komentar dimuat  
THE SYSTEM SHALL mengembalikan respons dalam bentuk halaman dengan `next_cursor`, tidak memuat seluruh riwayat sekaligus

WHEN soft-delete komentar dilakukan  
THE SYSTEM SHALL memastikan data komentar tetap tersimpan di database (tidak dihapus permanen) agar audit trail terjaga
