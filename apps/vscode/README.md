# markpiw untuk VS Code

Editor markdown WYSIWYG: edit langsung di tampilan jadi, file `.md` tetap bersih untuk di-review di git.

## Cara memakai

- Klik kanan file `.md` → **Open With…** → **markpiw**, atau
- buka file `.md`, lalu klik ikon **Buka dengan markpiw** di pojok kanan atas editor.

Undo/redo dan simpan memakai mekanisme bawaan VS Code (Ctrl/⌘+Z, Ctrl/⌘+S).

## Fitur

- Toolbar, shortcut markdown (`# `, `- `, `1. `, `> `, `[ ] `, `**tebal**`, …) dan slash command (`/`).
- Tempel/seret gambar: disimpan ke folder `assets/` di samping file (atur lewat `markpiw.assetsFolder`).
- Preservasi source: hanya blok yang Anda edit yang berubah di diff; file yang tidak diedit tetap identik.
- Jika sebuah edit tidak bisa disimpan sebagai markdown tanpa mengubah isi, editor menjadi baca-saja dan tidak menulis apa pun.

## Pengaturan

| Kunci | Default | Keterangan |
|---|---|---|
| `markpiw.assetsFolder` | `assets` | Folder gambar, relatif terhadap file `.md` |
