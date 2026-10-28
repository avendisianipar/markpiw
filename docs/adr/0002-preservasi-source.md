# ADR 0002: Preservasi source lewat indeks source per blok

Status: diterima (2026-10-28) · Spesifikasi: 3.3–3.4 · Riset: [WYSIWYG editor](../research/2026-10-28-wysiwyg-editor-research.md) (keluarga round-trip a/b/c)

## Konteks

markpiw mengedit file `.md` dokumentasi tim yang di-review lewat diff git. Serializer markdown "bersih" (keluarga a: parse → model → tulis ulang) menormalkan seluruh file saat disimpan: marker list, delimiter emphasis, padding tabel, line ending, baris kosong. Akibatnya satu edit kecil menghasilkan diff ratusan baris, dan tim akan berhenti memakai editornya. Keluarga b (mengedit teks source langsung) mempertahankan byte, tetapi tidak cocok untuk WYSIWYG. Keluarga c (model kaya + preservasi source) menggabungkan keduanya; GitLab memakai pendekatan serupa dengan source map.

## Keputusan

- **Unit preservasi = blok.** Setiap node blok (paragraf, heading, code, tabel, raw, hr, dan juga container blockquote/list/list_item) mendapat atribut `srcKey` yang menunjuk entri di indeks source. Entri menyimpan baris-baris utuh (dengan prefix container), separator sebelumnya, posisi di antara saudara, kontribusi prefix container, nomor list, dan baris tabel.
- **Verbatim jika tidak berubah dan konteksnya stabil.** Node yang identik (`===` atau `eq`) dengan node hasil parse, berada di posisi yang sama relatif terhadap saudaranya, dan konteks prefix leluhurnya tidak berubah dikeluarkan sebagai teks aslinya. Sisanya diserialisasi ulang memakai profil gaya file.
- **Invarian cakupan.** `leading` + teks unit + separator + `trailing` mencakup setiap byte source tepat sekali, sehingga dokumen yang tidak diedit selalu identik byte-per-byte. Ini diuji pada 652 contoh CommonMark, korpus GFM, dan semua `docs/**/*.md`.
- **Indeks terpisah, bukan atribut posisi.** Node hanya membawa `srcKey` (angka). Offset posisi tidak disimpan di node, karena offset langsung basi setelah edit pertama, sedangkan identitas node (`srcKey` + `eq`) tetap bermakna. Indeks juga menyimpan node hasil parse, sehingga perbandingan "berubah atau tidak" murah dan tidak bergantung pada offset.

## Konsekuensi

- Diff git hanya menyentuh blok yang diedit (dan separatornya), termasuk pada file CRLF, BOM, atau tanpa newline penutup.
- Granularitas blok berarti satu karakter yang diedit di paragraf panjang menulis ulang seluruh paragraf itu. Gaya inline paragraf tersebut mengikuti profil, sehingga paragraf yang diedit bisa berubah sedikit lebih banyak dari karakter yang disentuh.
- Konstruk yang tidak dimodelkan (HTML, frontmatter, definisi, footnote, list yang tidak muat di schema) menjadi `raw_block`/`raw_inline` dan selalu dipertahankan apa adanya.
- Guard round-trip (Task 10) tetap diperlukan untuk menolak output yang mengubah semantik.
