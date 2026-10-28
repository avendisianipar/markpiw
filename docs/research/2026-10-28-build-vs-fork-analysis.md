# Analisis: Bangun dari Nol vs Ambil & Kustom Source Open-Source

Tanggal: 2026-10-28
Melengkapi: [2026-10-28-wysiwyg-editor-research.md](2026-10-28-wysiwyg-editor-research.md)

Label: **[dok]** = terdokumentasi / diukur dari source; **[inf]** = inferensi atau estimasi. Ini analisis risiko, **bukan nasihat hukum**.

## Dua opsi yang dibandingkan

| | Opsi 1 — Bangun dari nol | Opsi 2 — Ambil source relevan, lalu kustom |
|---|---|---|
| Definisi | Semua kode engine ditulis sendiri. Open source (ProseMirror, Lexical, Slate, CodeMirror 6, CKEditor) hanya dibaca sebagai referensi ide/desain | Salin (vendor) source open-source yang relevan ke repo sendiri, lalu modifikasi/tingkatkan sesuai kebutuhan. Tetap tanpa dependency "produk editor" di `package.json` |
| Kandidat realistis | — | ProseMirror core (MIT) untuk engine + micromark/mdast (MIT) untuk parsing |

Asumsi bersama: GFM murni, Chromium desktop + webview VS Code dulu, markdown round-trip yang menjaga source asli (diff git minimal), tim 1–3 engineer.

---

## 1. Fakta kunci dari riset

### 1.1 Seberapa besar kode yang dibuat ulang / diambil [dok]

Diukur dari clone 2026-10-28, hanya `src/`, tanpa test/komentar/baris kosong.

| Paket | File | LOC kode | File terbesar | Test bawaan |
|---|---|---|---|---|
| prosemirror-model | 13 | 2.304 | from_dom 594 | 1.622 baris |
| prosemirror-transform | 10 | 1.476 | replace 351 | 1.540 |
| prosemirror-state | 5 | 638 | selection 282 | 405 |
| **prosemirror-view** | 12 | **4.706** | viewdesc 1.169, input 679 | 2.975 (termasuk test browser untuk komposisi/seleksi) |
| prosemirror-history / inputrules / keymap / commands | 4 | 1.165 | | 1.172 |
| **Total ProseMirror core** | **47** | **~10.300** | | **~7.700 baris** |
| Lexical (core) | 56 | 26.343 | LexicalSelection 3.440 | ~56.900 |
| Slate + slate-react + slate-dom + history | 191 | 16.284 | android-input-manager 814 | ~1.190 fixture |
| @codemirror/view | 34 | 9.538 | | 3.340 |

Cabang kode khusus browser: prosemirror-view 74 rujukan `browser.*`, Lexical 72 flag `IS_*`, Slate 71. **Itulah pengetahuan quirk yang harus ditemukan ulang di Opsi 1.**

**Temuan penting untuk Opsi 2:** modul ProseMirror saling terkait erat (view mengimpor model, state, dan transform; ada 88 penanda `@internal`, dan 47 cast `as any` ke internal). **"Ambil sebagian file saja" tidak realistis.** Praktiknya harus vendor 8 paket utuh (~10,3k LOC) atau tidak sama sekali.

### 1.2 Aliran perbaikan bug browser yang tidak pernah berhenti [dok]

prosemirror-view, 2023–2025: 55 rilis, 107 entri changelog; **42% menyebut browser/IME/komposisi** (~56% bila termasuk perbaikan seleksi/DOM). Sekitar 9 entri/tahun relevan untuk target kita (Chrome desktop, IME Windows/CJK). Contoh: *"Chrome misreports the cursor position and breaks composition"* (1.41.5); *"Chrome inserts a random `<br>`… backspace before a widget"* (1.41.7).

Lexical berubah ~4× lebih cepat (2.042 commit dalam 3 tahun), sehingga fork Lexical akan cepat tertinggal dari upstream.

Atlassian menaikkan versi prosemirror-view khusus untuk memperbaiki input bahasa Korea di Windows. Ini bukti bahwa produk nyata bergantung pada aliran perbaikan ini.

### 1.3 Studi kasus organisasi [dok]

| Organisasi | Jalur | Hasil |
|---|---|---|
| Notion, Google Docs, Meta (Lexical), CKSource, Coda | **Bangun sendiri** | Semua perusahaan yang **editornya adalah produk utama** dan punya tim besar. CKEditor 5: ditulis ulang dari nol sejak 2015, stabil ~2018, tim 10→30 orang. Lexical masih versi 0.x setelah ~4 tahun |
| **Basecamp / 37signals** | Trix (buatan sendiri, 2014) → **Lexxy di atas Lexical (2025)** | Engine buatan sendiri "falling short of expectations" dan menemui "technical barriers". **Sinyal terkuat:** tim yang mampu dan berpengalaman 10 tahun pun akhirnya menyerah memiliki engine sendiri |
| Atlassian, GitLab, Ghost, Discourse, Outline, Reflect | **Di atas framework** (ProseMirror/Lexical) | Editor adalah *fitur*, bukan produk. Reflect pindah ke ProseMirror dalam ~3 bulan dan memperbaiki "#1 piece of feedback" (clipboard, list, spellcheck) |
| **GitLab** (paling mirip kasus kita: WYSIWYG GFM) | ProseMirror + Tiptap + source map | ~3 tahun dari proposal sampai jadi default, **padahal tidak membangun engine sendiri**. Preservasi inline masih dikerjakan |
| react-prosemirror (NYT) | **Paling mirip Opsi 2**: mengganti lapisan DOM ProseMirror sambil memakai internalnya | Berhasil, tetapi rilisnya "coupled to specific prosemirror-view releases". Mereka mem-port test upstream untuk membuktikan perilakunya setara |
| Draft.js, Quill | Upstream mati/stagnan → banyak fork | Fork yang didanai perusahaan (DevExpress) bertahan; fork ad-hoc terpecah dan mati |
| ProseMirror sendiri | 1 spesialis kelas dunia, crowdfunding ~$54k (2015) | 1.0 baru keluar Okt 2017 setelah "years of wild experiments" |

### 1.4 Lisensi kandidat [dok]

| Sumber | Lisensi | Boleh di-vendor & dimodifikasi? |
|---|---|---|
| ProseMirror (semua paket), CodeMirror 6, micromark/mdast, Lexical, Slate, Milkdown, Yjs, Trix, Tiptap core | MIT | ✅ Ya, cukup pertahankan copyright notice |
| Quill, Parchment | BSD-3-Clause | ✅ Ya, plus larangan memakai nama penulis untuk endorsement |
| BlockNote core | MPL-2.0 | ⚠️ File yang dimodifikasi tetap MPL dan source-nya wajib diberikan ke penerima |
| CKEditor 5, BlockNote `xl-*` | GPL | ❌ Hindari (copyleft kuat) kecuali membeli lisensi komersial |
| Tiptap Pro/Cloud | Proprietary | ❌ Dilarang |
| Typora | Closed source | ❌ Hanya boleh dilihat UX-nya |

---

## 2. Analisis multi-lensa

### 2.1 Lensa produk

| Aspek | Opsi 1 | Opsi 2 |
|---|---|---|
| Time-to-market (beta internal yang bisa dipakai) | 9–15 bulan | 2–4 bulan |
| Kualitas saat rilis | Rendah–sedang: bug IME/seleksi/paste ditemukan oleh user | Sedang–tinggi: mewarisi ~10 tahun perbaikan |
| Paritas UX dengan Notion/Tiptap | Kecil kemungkinannya | Bisa sebagian (Tiptap sendiri berdiri di atas ProseMirror) |
| Diferensiasi | **Engine bukan pembeda.** User tidak melihat beda engine buatan sendiri | Sama. Tenaga dialihkan ke pembeda yang sebenarnya |
| Risiko adopsi | Tinggi: satu dokumen rusak atau satu diff berantakan meruntuhkan kepercayaan tim | Lebih rendah |

**Pembeda nyata markpiw** [inf] adalah alur kerja: UX toolbar/slash untuk non-developer, diff git yang bersih, alur `./assets`, satu engine untuk web dan VS Code, konvensi dokumentasi perusahaan. **Tidak satu pun membutuhkan engine buatan sendiri.**

**Pesaing gratis** yang sudah dimiliki user: VS Code 1.131 *hybrid Markdown editor* (eksperimental; dilaporkan masih ada kursor bergetar), Obsidian, Typora, editor web GitHub/GitLab. Jika markpiw lebih buggy dari mereka, user akan kembali ke alat itu.

### 2.2 Lensa software engineering

| Aspek | Opsi 1 | Opsi 2 |
|---|---|---|
| Kecocokan arsitektur untuk preservasi source markdown | **Terbaik**: block ID dan rentang source jadi bagian inti sejak awal | **Baik**: node attrs bisa menyimpan `blockId` + `src {from,to,hash}`; node immutable yang tidak berubah dibagi secara struktural, jadi deteksi "blok disentuh?" murah. Perlu de-duplikasi ID saat blok di-split. **Tidak perlu mengubah engine** |
| Risiko bug IME/seleksi/karakter dobel | Tinggi: harus menemukan ulang 74 cabang quirk browser | Rendah: sudah tertangani dan ada test browser-nya |
| Bagian tersulit | Position mapping (~1,5k LOC matematika halus), reconciler DOM↔model, DOMObserver + komposisi, clipboard | Mempelajari ~10k LOC kode orang lain |
| Ukuran kode | Bisa lebih ramping (~5–8k LOC jika dibatasi GFM + Chromium) | ~10,3k LOC (sebagian tidak terpakai) |
| Testability | Semua test ditulis sendiri | ~7,7k baris test upstream ikut di-vendor |
| Fitur masa depan (kolaborasi, drag handle, tabel lanjutan) | Bangun satu per satu | Desainnya sudah ada (collab/rebase, tables, dropcursor) |
| Performa | Bisa lebih ketat untuk GFM | Sudah terbukti di skala Atlassian/NYT |

### 2.3 Lensa maintainability

| Aspek | Opsi 1 | Opsi 2 |
|---|---|---|
| Beban jangka panjang | 0,3–0,5 FTE **selamanya** untuk menemukan & memperbaiki quirk browser setiap kali Chrome/VS Code update | ~1–2 hari/bulan untuk meninjau & menggabungkan 4–5 rilis upstream per kuartal, **asal engine tidak dimodifikasi** |
| Masukan perbaikan dari luar | Tidak ada; hanya bisa membaca changelog orang lain lalu mengimplementasikan ulang | Cherry-pick/rebase ke tag upstream |
| Risiko utama | Bug baru setelah browser update tanpa ada yang tahu sebabnya | **Drift**: makin banyak engine dimodifikasi, makin mahal sinkronisasi. Kalau prosemirror-view diubah, versinya terkunci |
| Bus factor | Pengetahuan terkonsentrasi di 1–2 penulis (Trix: maintainer pergi → engine diganti) | Pengetahuan bisa ditransfer: guide, forum, dan komunitas ProseMirror besar |
| Onboarding engineer baru | Harus membuat dokumentasi internal sendiri | Konsep ProseMirror (schema, transaction, plugin, NodeView) banyak dipahami orang |

Praktik terbaik vendoring [dok/inf]: commit upstream yang murni (`vendor/upstream/<pkg>@<sha>`) dipisah dari perubahan kita; perubahan dikelola sebagai *patch queue* dengan header DEP-3 (alasan, status upstream, pemilik); `VENDOR.md` per paket; job CI yang membandingkan dengan upstream terbaru dan membuka tiket. Contoh standar yang baik: aturan `third_party` Chromium (dua OWNER, update maksimal 3 bulan setelah rilis minor).

### 2.4 Lensa legal

| Aspek | Opsi 1 | Opsi 2 (hanya sumber MIT/BSD) |
|---|---|---|
| Upaya kepatuhan | Rendah: scan kemiripan + log provenance | Sedang: header lisensi, `THIRD_PARTY_NOTICES`, SPDX, SBOM, scan per file |
| Paparan copyleft | ~Tidak ada | Tidak ada (MIT/BSD) |
| Kewajiban atribusi | Tidak ada secara hukum | Wajib di setiap file vendor, **dan ikut dikirim** di bundle SPA serta `.vsix` (minifier sering membuang header, jadi perlu plugin ekstraksi lisensi) |
| Bukti asal-usul | **Sulit membuktikan independen** | Mudah (SHA upstream tercatat) |
| Risiko "developer tetap copy-paste diam-diam" | **Tinggi**: penyalinan tanpa atribusi = pelanggaran yang baru ketahuan belakangan | Rendah: menyalin memang diharapkan dan atribusinya sudah ada |
| Open-source di masa depan | Paling bebas | Mudah (cukup pertahankan notice MIT) |
| Paten | Sama untuk kedua opsi; risiko rendah untuk editor lokal satu pengguna. Paten OT (Microsoft, Dropbox) baru relevan saat kolaborasi real-time | Sama |

Catatan penting:
- **Opsi 1 tidak otomatis lebih "bersih" secara hukum.** "Menulis ulang setelah membaca kode" berisiko menghasilkan parafrase dekat (transliterasi baris per baris, misalnya JS→TS dengan nama variabel diganti), yang tetap bisa dianggap karya turunan. Yang dilindungi hak cipta adalah *ekspresi*, bukan *ide*. Konsep step/mapping/schema bebas dipakai. Jika memilih Opsi 1, terapkan disiplin *clean-room*: tanpa copy-paste, tidak membuka file upstream saat menulis kode, catatan desain dalam kata-kata sendiri, log siapa membaca apa, dan scan kemiripan sebelum rilis.
- **Asisten AI** bisa mengeluarkan potongan kode berlisensi secara verbatim. Atur filter "suggestions matching public code" ke *Block* (GitHub Copilot) dan jalankan scan kemiripan, untuk kedua opsi.
- **Distribusi:** pemakaian internal oleh karyawan menurut GPL FAQ bukan "distribusi". Memberi `.vsix`/akses SPA ke **kontraktor atau mitra** = distribusi. Untuk sumber MIT, kewajiban notice tetap berlaku pada setiap salinan, jadi selalu sertakan notice.
- **Indonesia:** program komputer dilindungi UU 28/2014 Pasal 40(1)(s); karya asing dilindungi lewat Konvensi Bern (Keppres 18/1997), jadi lisensi OSS asing berlaku di Indonesia. Hak moral atribusi (Pasal 5) sejalan dengan kewajiban notice MIT. Pasal 83 (pencatatan lisensi di DJKI) belum jelas penerapannya pada lisensi OSS publik; konfirmasikan ke konsultan hukum sebelum `.vsix` keluar dari perusahaan.
- **Merek:** boleh menyebut "built on ProseMirror (MIT)", tetapi jangan memakai nama upstream dalam nama produk.

### 2.5 Lensa keamanan & supply chain

| Aspek | Opsi 1 | Opsi 2 |
|---|---|---|
| Permukaan serangan | Kode sendiri, belum teruji, termasuk sanitasi paste HTML | Kode teruji publik; tetapi CVE upstream harus dipantau sendiri karena tidak ada di `package.json` |
| Supply chain | Nol dependency | Kode dipin & diaudit di repo; tidak ada tarikan otomatis dari npm, jadi memenuhi kebijakan "in-house" |
| Deteksi oleh scanner | — | Scanner yang hanya membaca dependency tree **tidak melihat** kode vendor → perlu scan per file (ScanCode/FOSSA/ORT) + SBOM yang mencantumkan kode vendor |

### 2.6 Lensa organisasi, SDM & biaya

| Aspek | Opsi 1 | Opsi 2 |
|---|---|---|
| Biaya bangun (sampai layak dipercaya) | ~2–6 engineer-tahun | ~0,5–1,5 engineer-tahun |
| Biaya berjalan | 0,3–0,5 FTE selamanya | ~0,1–0,2 FTE untuk sinkronisasi upstream |
| Opportunity cost | Tinggi: setiap bulan untuk engine = bulan yang tidak dipakai untuk alur kerja pembeda | Rendah |
| Rekrutmen | Butuh orang yang mau belajar engine bespoke tanpa dokumentasi publik | Pengalaman ProseMirror/Tiptap bisa dicari di pasar |
| Pembelajaran / kapabilitas | **Paling dalam**: satu-satunya argumen kuat untuk Opsi 1 | Tetap dalam bila disengaja (membaca & menulis ulang modul tertentu) |

### 2.7 Lensa strategis

Dalam kerangka Wardley map 2026, engine rich-text adalah **komoditas**: ada ProseMirror, Lexical, dan CodeMirror yang matang dan berlisensi permisif. Parser GFM juga komoditas. Bagian yang bersifat **custom/genesis** adalah alur kerja markpiw. Heuristik umumnya: **bangun sendiri hanya untuk komponen genesis/custom.**

Kontrol: Opsi 2 memberi kontrol hampir penuh di level source (kode ada di repo kita, bisa diubah kapan saja) tanpa dependency runtime "produk editor". Anti-lock-in yang sesungguhnya adalah **file `.md` di git**: selama markdown tetap kanonik, engine bisa diganti di kemudian hari.

---

## 3. Ringkasan perbandingan

| Dimensi | Opsi 1: Dari nol | Opsi 2: Vendor & kustom |
|---|---|---|
| Waktu ke versi pertama yang bisa dipakai | 3–5 bulan (engine saja) | 3–6 minggu |
| Waktu ke v1 yang robust (2–3 engineer senior) | **10–16 bulan** | **5–8 bulan** |
| Waktu sampai benar-benar dipercaya (IME, paste kompleks, tanpa insiden data hilang) | 2–4+ tahun | 6–12 bulan |
| Risiko bug IME/seleksi | Tinggi | Rendah |
| Kecocokan dengan preservasi source markdown | Terbaik | Baik |
| Biaya pemeliharaan | 0,3–0,5 FTE selamanya | 0,1–0,2 FTE |
| Bus factor | Buruk | Lebih baik |
| Upaya kepatuhan legal | Rendah, tetapi bukti independensi sulit | Sedang, tetapi jelas & mudah diaudit |
| Kontrol | Total | Hampir total |
| Nilai pembelajaran | Maksimal | Sedang–tinggi |
| **Risiko keseluruhan** | **Tinggi** | **Sedang–rendah** |

Catatan: preservasi source markdown (2–3 bulan) dibutuhkan di kedua opsi; angka di atas sudah memperhitungkannya. Semua estimasi waktu adalah inferensi dari studi kasus, bukan janji.

---

## 4. Kerangka keputusan

| Pertanyaan | Jika "ya" | Jika "tidak" |
|---|---|---|
| Apakah menguasai internal editor adalah **tujuan yang didanai** tersendiri? | Condong ke Opsi 1 (atau Opsi 2 + penulisan ulang terencana) | Opsi 2 |
| Apakah editor ini akan menjadi **produk** yang dijual? | Opsi 1 bisa dibenarkan (logika Notion) | Opsi 2 |
| Ada ≥3 engineer khusus selama ≥2 tahun? | Opsi 1 layak | Opsi 2 |
| Butuh kolaborasi real-time dalam 2 tahun? | Opsi 2 (collab ProseMirror/Yjs sudah terbukti) | Keduanya |
| Bersedia sinkronisasi upstream tiap kuartal? | Opsi 2 | Opsi 2 dibekukan (risiko drift lebih tinggi) |
| Tim harus bisa memercayainya untuk dokumen penting sejak rilis? | Opsi 2 | — |

---

## 5. Rekomendasi

**Opsi 2, dengan disiplin berikut** [inf]:

1. **Vendor 8 paket ProseMirror utuh** (model, transform, state, view, history, inputrules, keymap, commands; ~10,3k LOC, MIT) beserta test-nya, sebagai commit upstream yang murni. Jangan Lexical: ukurannya ~2,5× ProseMirror, monolitik, dan berubah ~4× lebih cepat.
2. **Anggap prosemirror-view read-only.** Di situlah perbaikan quirk browser mendarat. Modifikasi engine hanya lewat patch queue yang terdokumentasi.
3. **Yang ditulis sendiri** (di sinilah nilai dan pembeda markpiw):
   - Lapisan markdown: parsing via micromark/mdast (posisi source) → node attrs (`blockId`, rentang & hash source) → **serializer sendiri** yang menulis potongan asli untuk blok yang tidak disentuh.
   - Schema GFM, input rules (markdown shortcut), slash command, toolbar, dan UI React.
   - Host adapter web (File System Access) & VS Code (CustomTextEditorProvider), alur `./assets`.
4. **Kepatuhan:** header lisensi asli dipertahankan, SPDX per file, `THIRD_PARTY_NOTICES` di SPA & `.vsix`, `VENDOR.md` + SHA upstream, scan per file di CI, filter AI public-code = Block.
5. **Jalur strangler:** tulis ulang sebuah modul **hanya jika** terbukti menghambat, dan **setelah** test upstream-nya di-port sebagai spesifikasi.

**Kapan Opsi 1 tetap masuk akal:** jika penguasaan engine adalah tujuan strategis yang didanai, editor akan menjadi produk, dan ada ≥3 engineer selama ≥2 tahun plus 0,3–0,5 FTE pemeliharaan permanen. Bahkan dalam skenario itu, memulai dari Opsi 2 lalu menulis ulang modul satu per satu memberi jalur belajar yang sama dengan risiko jauh lebih kecil.

**Varian yang perlu dipertimbangkan:** untuk paket yang **tidak** dimodifikasi sama sekali, memakai dependency npm yang dipin (bukan disalin) justru menurunkan biaya audit dan sinkronisasi. Namun pilihan ini bertentangan dengan keinginan "source ada di repo kita", jadi diserahkan ke kebijakan tim.

### Dampak pada keputusan sebelumnya

Riset pertama merekomendasikan "engine dibangun sendiri dengan pola ProseMirror/Lexical". Bila Opsi 2 dipilih, rekomendasi itu berubah menjadi **"engine = ProseMirror yang di-vendor; semua lapisan di atasnya ditulis sendiri"**. Rekomendasi lain tetap berlaku: keluarga (c) preservasi source, micromark/mdast, React untuk UI, target Chromium dulu, dan host adapter.
