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
  'search.open': 'Cari',
  'search.label': 'Cari di dokumen',
  'search.placeholder': 'Cari',
  'search.count': '{current} dari {total}',
  'search.none': 'Tidak ada hasil',
  'search.prev': 'Hasil sebelumnya',
  'search.next': 'Hasil berikutnya',
  'search.close': 'Tutup pencarian',
  'spec.label': 'Dokumen spec',
  'spec.kind.requirements': 'Requirements',
  'spec.kind.design': 'Design',
  'spec.kind.tasks': 'Task list',
  'spec.short.requirements': 'R',
  'spec.short.design': 'D',
  'spec.short.tasks': 'T',
  'spec.missing': '{file} belum ada di folder ini',
  'spec.open': 'Buka {file}',
  'spec.progress': 'Task {done}/{total} selesai',
  'spec.progressHint': '{doing} sedang dikerjakan',
  'spec.coverage': 'Requirement tercakup {covered}/{total}',
  'spec.coverageHint': 'Requirement ber-ID yang sudah dirujuk minimal satu task',
  'spec.traceToggle': 'Trace',
  'spec.traceToggleHint': 'Tampilkan/sembunyikan panel trace',
  'trace.label': 'Trace',
  'trace.close': 'Tutup panel trace',
  'trace.tabSection': 'Bagian ini',
  'trace.tabCoverage': 'Cakupan',
  'trace.noSection':
    'Taruh kursor di sebuah bagian untuk melihat keterkaitannya dengan dokumen lain.',
  'trace.outgoing': 'Merujuk ke',
  'trace.incoming': 'Dirujuk oleh',
  'trace.related': 'Terkait (istilah kode sama)',
  'trace.empty':
    'Belum ada keterkaitan. Sebut ID bagian ini di dokumen lain (mis. "Requirements: {id}"), atau pakai istilah kode yang sama.',
  'trace.emptyNoId':
    'Belum ada keterkaitan. Awali heading dengan ID (mis. "### FR-1: …") agar bisa dirujuk dari dokumen lain.',
  'trace.uncovered': 'Requirement tanpa task',
  'trace.allCovered': 'Semua requirement ber-ID sudah dirujuk task.',
  'trace.noRequirementIds':
    'Belum ada requirement ber-ID. Awali heading dengan ID, mis. "### FR-1: …".',
  'trace.needBoth': 'Cakupan butuh requirements.md dan tasks.md di folder yang sama.',
  'trace.coverageTip':
    'Tambahkan baris seperti "**Requirements:** FR-1, FR-2" di task yang menanganinya.',
  'trace.duplicate': 'ID ganda: {ids}. Tautan menuju definisi pertama.',
  'trace.loading': 'Membaca dokumen spec…',
  'trace.open': 'Buka',
  'trace.modClick': '{mod}+klik untuk membuka',
  'trace.definedHere': 'Didefinisikan di sini',
  'trace.referencedBy': 'Dirujuk {count} bagian',
  'trace.notReferenced': 'Belum dirujuk bagian lain',
  'trace.status.todo': 'Belum dimulai',
  'trace.status.doing': 'Sedang dikerjakan',
  'trace.status.done': 'Selesai',
} as const;

export type StringKey = keyof typeof id;

export function t(key: StringKey, params?: Readonly<Record<string, string | number>>): string {
  let text: string = id[key];
  if (params)
    for (const [name, value] of Object.entries(params))
      text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export const editorStrings: EditorStrings = DEFAULT_EDITOR_STRINGS;
