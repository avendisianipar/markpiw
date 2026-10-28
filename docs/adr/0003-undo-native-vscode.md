# ADR 0003: Undo dan save native di VS Code

Status: diterima (2026-10-28) · Spesifikasi: D14

## Konteks

Di VS Code, `TextDocument` adalah sumber kebenaran isi file. Jika editor markpiw juga punya undo stack sendiri (prosemirror-history), akan ada dua riwayat yang bisa saling bertentangan: Ctrl+Z di webview membatalkan perubahan editor, sedangkan Ctrl+Z di menu VS Code membatalkan edit teks. Status dirty, hot exit, dan save juga dikelola VS Code.

## Keputusan

- `FileHost.historyMode = 'host'` di VS Code. Plugin history ProseMirror tidak dipasang; undo/redo diteruskan ke perintah native VS Code.
- Perubahan editor dikirim sebagai `TextEdit` minimal (`applyEdits`) dan dibatch setiap 200 ms.
- Perubahan eksternal (termasuk hasil undo VS Code) masuk lewat satu jalur `applyExternalText`, dengan transaksi `addToHistory: false`.
- Save memakai mekanisme native VS Code; markpiw tidak menulis file sendiri.
- Di web, `historyMode = 'editor'` dan prosemirror-history dipakai.

## Konsekuensi

- Satu undo stack, perilaku konsisten dengan editor teks VS Code (termasuk "Open With" bolak-balik).
- Granularitas undo mengikuti batch 200 ms, bukan langkah transaksi editor.
- Seleksi setelah undo dipetakan ulang dari diff teks; posisi kursor bisa sedikit bergeser di kasus tepi.
