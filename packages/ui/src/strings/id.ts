// SPDX-License-Identifier: MIT
// Semua teks UI (spesifikasi 5.4). Tambahkan `en.ts` dengan kunci yang sama untuk bahasa lain.
import { DEFAULT_EDITOR_STRINGS, type EditorStrings } from '@markpiw/editor';

export const id = {
  'toolbar.label': 'Format',
  'toolbar.undo': 'Urungkan',
  'toolbar.redo': 'Ulangi',
  'toolbar.zoomOut': 'Perkecil',
  'toolbar.zoomIn': 'Perbesar',
  'toolbar.zoomReset': 'Atur ulang zoom',
  'toolbar.block': 'Jenis blok',
  'toolbar.paragraph': 'Paragraf',
  'toolbar.heading': 'Heading',
  'toolbar.codeBlock': 'Code block',
  'toolbar.list': 'List',
  'toolbar.bullet': 'Bullet list',
  'toolbar.ordered': 'Numbered list',
  'toolbar.task': 'Task list',
  'toolbar.bold': 'Tebal',
  'toolbar.italic': 'Miring',
  'toolbar.strike': 'Coret',
  'toolbar.code': 'Kode inline',
  'toolbar.link': 'Link',
  'toolbar.quote': 'Kutipan',
  'toolbar.table': 'Tabel',
  'toolbar.tableInsert': 'Sisipkan tabel…',
  'toolbar.tableSize': 'Ukuran tabel (baris × kolom)',
  'toolbar.tableRowBefore': 'Tambah baris di atas',
  'toolbar.tableRowAfter': 'Tambah baris di bawah',
  'toolbar.tableColBefore': 'Tambah kolom di kiri',
  'toolbar.tableColAfter': 'Tambah kolom di kanan',
  'toolbar.tableRowDelete': 'Hapus baris',
  'toolbar.tableColDelete': 'Hapus kolom',
  'toolbar.tableDelete': 'Hapus tabel',
  'toolbar.alignLeft': 'Rata kiri',
  'toolbar.alignCenter': 'Rata tengah',
  'toolbar.alignRight': 'Rata kanan',
  'toolbar.image': 'Gambar',
  'toolbar.hr': 'Garis pemisah',
  'toolbar.insert': 'Sisipkan lainnya',
  'toolbar.mathInline': 'Rumus inline ($…$)',
  'toolbar.mathBlock': 'Rumus blok ($$)',
  'toolbar.mermaid': 'Diagram Mermaid',
  'toolbar.callout.note': 'Callout: Catatan',
  'toolbar.callout.tip': 'Callout: Tips',
  'toolbar.callout.important': 'Callout: Penting',
  'toolbar.callout.warning': 'Callout: Peringatan',
  'toolbar.callout.caution': 'Callout: Hati-hati',
  'toolbar.darkMode': 'Mode gelap',
  'slash.label': 'Perintah',
  'link.url': 'URL',
  'link.apply': 'Terapkan',
  'link.open': 'Buka',
  'link.remove': 'Hapus link',
  'image.alt': 'Teks alternatif',
  'image.src': 'URL gambar',
  'image.apply': 'Terapkan',
  'readonly.guard':
    'Perubahan terakhir tidak bisa disimpan sebagai markdown tanpa mengubah isi. File tidak ditulis.',
  'readonly.crash':
    'Editor mengalami kesalahan. Isi ditampilkan sebagai teks dan tidak ada yang ditulis.',
  'readonly.copyDiagnostics': 'Salin info diagnostik',
  'readonly.copied': 'Disalin',
  'notice.dismiss': 'Tutup',
  'outline.label': 'Daftar isi',
  'outline.untitled': 'Tanpa judul',
} as const;

export type StringKey = keyof typeof id;

export function t(key: StringKey): string {
  return id[key];
}

export const editorStrings: EditorStrings = DEFAULT_EDITOR_STRINGS;
