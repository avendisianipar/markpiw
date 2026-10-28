# Panduan uji manual markpiw

Panduan ini untuk mencoba markpiw langsung di **web** dan di **VS Code**. Semua perintah dijalankan dari root repo.

## Persiapan (sekali)

```bash
corepack enable
pnpm install
```

Prasyarat: Node 24, pnpm 10 (lewat Corepack), Chrome/Edge versi terbaru, VS Code ≥ 1.95.

> **`zsh: command not found: pnpm`?** Node 24 menyediakan pnpm lewat Corepack, tetapi Corepack harus diaktifkan sekali dengan `corepack enable`. Saat pertama kali menjalankan `pnpm`, Corepack mungkin bertanya apakah boleh mengunduh pnpm 10.8.0; jawab `Y`. Jika memakai nvm dan berpindah versi Node, jalankan `corepack enable` lagi di versi itu.

---

## A. Web

### Menjalankan

```bash
pnpm --filter @markpiw/web dev
```

Buka `http://localhost:5173` di **Chrome atau Edge** (Firefox/Safari belum didukung).

Untuk mencoba build produksi (dengan CSP aktif):

```bash
pnpm --filter @markpiw/web build && pnpm --filter @markpiw/web preview
```

lalu buka `http://localhost:4173`.

### Dua cara mencoba

- **Coba demo**: folder contoh di memori. Tidak meminta izin file dan tidak ada yang ditulis ke disk. Langsung bisa dipakai via `http://localhost:5173/?demo`.
- **Buka folder**: pilih folder repo dokumentasi Anda. Chrome akan meminta izin baca-tulis. File `.md` di folder itu benar-benar diedit dan disimpan otomatis.

  > Saran: pakai folder yang ada di git. Setelah mencoba, `git diff` menunjukkan persis apa yang diubah markpiw.

### Yang perlu dicek di web

- Simpan otomatis 1 detik setelah berhenti mengetik. Status di atas berubah: Belum disimpan → Menyimpan… → Tersimpan. Ctrl/⌘+S menyimpan langsung.
- Pindah file saat ada perubahan: file lama tetap tersimpan.
- Konflik: ubah file yang sama di editor lain atau lewat `git checkout`, lalu kembali ke tab markpiw.
  - Tanpa perubahan lokal, isi baru langsung dimuat.
  - Dengan perubahan lokal, muncul dialog **Pakai versi saya / Muat versi disk**.
- Tempel gambar (screenshot) dari clipboard. File tersimpan sebagai `assets/image-xxxxxxxx.png` di samping file `.md`, dan markdown-nya `![](./assets/…)`.
- Link ke `.md` lain: Ctrl/⌘+klik untuk membuka file itu di markpiw.
- Folder terakhir muncul di halaman awal. Jika diminta, klik **Izinkan akses** lagi.

---

## B. VS Code

### Memasang extension

1. Build paket `.vsix`:

   ```bash
   pnpm --filter markpiw package
   ```

   Hasilnya `apps/vscode/markpiw.vsix`.

2. Pasang dengan salah satu cara:
   - VS Code → panel **Extensions** → menu `…` → **Install from VSIX…** → pilih `apps/vscode/markpiw.vsix`.
   - Atau dari terminal (jika perintah `code` tersedia di PATH):

     ```bash
     code --install-extension apps/vscode/markpiw.vsix
     ```

3. Reload jendela VS Code jika diminta.

### Membuka file dengan markpiw

- Klik kanan file `.md` di Explorer → **Buka dengan markpiw**, atau **Open With…** → **markpiw**.
- Atau buka file `.md`, lalu klik ikon ✎ **Buka dengan markpiw** di pojok kanan atas editor.

Editor teks bawaan tetap menjadi default; markpiw hanya dipakai saat dipilih.

### Yang perlu dicek di VS Code

- Mengetik menandai file *dirty* (titik di tab). **Ctrl/⌘+S** menyimpan seperti biasa.
- **Ctrl/⌘+Z / Ctrl/⌘+Shift+Z** memakai undo bawaan VS Code. Tampilan markpiw ikut berubah.
- Buka file yang sama di editor teks biasa di sebelahnya (split). Edit di salah satu sisi ikut muncul di sisi lain.
- Tempel gambar: file ditulis ke `assets/` (atur lewat setting `markpiw.assetsFolder`).
- Tema gelap/terang/high contrast VS Code ikut diterapkan.

### Menghapus extension

Panel **Extensions** → markpiw → **Uninstall**.

---

## C. Checklist skenario (web & VS Code)

| # | Skenario | Hasil yang diharapkan |
|---|---|---|
| 1 | Buka file tanpa mengedit, lalu tutup | File tidak berubah sama sekali (`git diff` kosong) |
| 2 | Edit satu kata di satu paragraf | `git diff` hanya menyentuh baris paragraf itu |
| 3 | Ketik `# `, `## `, `- `, `* `, `1. `, `> `, `[ ] ` di awal baris | Berubah menjadi heading/list/kutipan/task |
| 4 | Ketik `**tebal**`, `_miring_`, `` `kode` ``, `~~coret~~` | Format diterapkan; delimiter yang Anda ketik dipertahankan di file |
| 5 | Ketik `/` di baris kosong, lalu `tab` + Enter | Tabel 3×3 tersisip; Tab berpindah antar sel |
| 6 | Toolbar: Bold, list, kutipan, code block, garis pemisah, menu tabel | Sesuai label; tombol aktif tersorot |
| 7 | Pilih teks → Ctrl/⌘+K → isi URL | Teks menjadi link; popover menampilkan Buka/Hapus |
| 8 | Ketik URL `https://…` diikuti spasi | Otomatis menjadi link |
| 9 | Tempel dari Google Docs / Word | Tebal, miring, link, dan list ikut; tanpa gaya/warna asing |
| 10 | Tempel teks markdown (mis. dari README) | Menjadi heading/list sesungguhnya |
| 11 | File CRLF (Windows): edit satu baris | Baris lain tetap CRLF |
| 12 | Blok HTML / frontmatter YAML | Tampil sebagai kotak "Markdown mentah" dan tetap utuh |
| 13 | Centang checkbox task | `[ ]` ↔ `[x]` di file |
| 14 | Zoom −/+ di toolbar | Ukuran teks berubah, file tidak berubah |
| 15 | VS Code: ketik dua kata dengan jeda, tekan Cmd/Ctrl+Z sekali | Hanya satu langkah yang diurungkan |
| 16 | VS Code: Cmd/Ctrl+B, Cmd/Ctrl+K, Cmd/Ctrl+Shift+X di markpiw | Hanya format teks yang berubah; sidebar/panel VS Code tidak ikut bereaksi |
| 17 | Tempel gambar besar lalu langsung Cmd/Ctrl+S | File tidak pernah berisi `blob:`; markdown gambar muncul setelah upload selesai |

### Batas yang sudah diketahui (bukan bug)

- **Mode baca-saja.** Beberapa bentuk format tidak bisa ditulis sebagai markdown tanpa mengubah isi, misalnya miring tepat di `mple.` di dalam `example.com`. Jika itu terjadi, muncul banner merah, file **tidak ditulis**, dan editor menjadi baca-saja. Klik **Urungkan perubahan terakhir** (web) atau **Muat ulang dari file** (VS Code) untuk melanjutkan.
- **List yang induknya dikosongkan.** Mengosongkan baris induk sebuah list yang punya sub-item bisa memicu mode baca-saja. Urungkan, lalu hapus induknya dengan Backspace di awal baris.
- **File non-UTF-8 (web).** File dengan encoding lain (mis. Windows-1252) tidak dibuka agar karakternya tidak rusak. Simpan ulang sebagai UTF-8 terlebih dahulu.
- **Web hanya di Chromium.** Versi web butuh Chrome/Edge desktop dan HTTPS (atau localhost).

Jika menemukan masalah, catat: langkah, isi file sebelum dan sesudah (`git diff`), dan pesan di banner (tombol **Salin info diagnostik**).
