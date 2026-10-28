# ADR 0004: Target v1 hanya Chromium desktop dan webview VS Code

Status: diterima (2026-10-28) · Spesifikasi: D11

## Konteks

Versi web membuka folder lokal tanpa server lewat File System Access API (`showDirectoryPicker`, handle yang bisa ditulis). API ini hanya tersedia penuh di Chromium (Chrome, Edge) dan membutuhkan konteks aman (HTTPS atau localhost). Sebagian besar bug editor contenteditable berasal dari perbedaan perilaku browser dan IME; setiap browser tambahan memperbesar matriks pengujian.

## Keputusan

- v1 menargetkan Chrome/Edge desktop versi terbaru dan webview VS Code (yang juga Chromium).
- Browser lain menampilkan pesan bahwa browser tidak didukung, bukan editor yang setengah berfungsi.
- Test browser (Playwright) di v1 hanya berjalan di Chromium.

## Konsekuensi

- Pengguna Firefox/Safari tidak bisa memakai versi web v1; mereka tetap bisa memakai extension VS Code.
- Matriks quirk lebih kecil, sehingga upaya hardening IME dan seleksi fokus di satu engine.
- Dukungan browser lain bisa ditambahkan kemudian lewat fallback (misalnya buka/simpan satu file) tanpa mengubah arsitektur host.
