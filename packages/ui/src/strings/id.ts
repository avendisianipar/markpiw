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
  'toolbar.bold': 'Tebal',
  'toolbar.italic': 'Miring',
  'toolbar.strike': 'Coret',
  'toolbar.code': 'Kode inline',
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
  'toolbar.insert': 'Sisipkan lainnya',
  'toolbar.darkMode': 'Mode gelap',
  'toolbar.zoom': 'Zoom',
  'block.group.text': 'Teks & heading',
  'block.group.list': 'List',
  'block.group.block': 'Blok',
  'block.group.insert': 'Sisipkan',
  'block.group.callout': 'Callout',
  'block.group.advanced': 'Rumus & diagram',
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
