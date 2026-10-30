// SPDX-License-Identifier: MIT

export type SlashItemId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'
  | 'table'
  | 'image'
  | 'hr'
  | 'note'
  | 'tip'
  | 'important'
  | 'warning'
  | 'caution'
  | 'math'
  | 'mathInline'
  | 'mermaid'
  | 'link';

/** Kelompok item blok; urutannya sama di slash menu dan toolbar. */
export type SlashGroupId = 'text' | 'list' | 'block' | 'insert' | 'callout' | 'advanced';

/** Teks yang dipakai engine editor (UI memberikan versi terjemahannya). */
export interface EditorStrings {
  readonly placeholder: string;
  readonly rawBlockLabel: string;
  readonly codeLanguagePlaceholder: string;
  readonly imageMissing: string;
  readonly imageSaveFailed: string;
  readonly previewEmpty: string;
  readonly previewLoading: string;
  readonly previewError: string;
  readonly mathBlockLabel: string;
  readonly mathInlineLabel: string;
  readonly mathInlinePlaceholder: string;
  /** Label kotak callout GitHub per jenis. */
  readonly callouts: Readonly<Record<'note' | 'tip' | 'important' | 'warning' | 'caution', string>>;
  readonly slash: Readonly<Record<SlashItemId, { label: string; aliases: readonly string[] }>>;
}

export const DEFAULT_EDITOR_STRINGS: EditorStrings = {
  placeholder: "Ketik '/' untuk perintah…",
  rawBlockLabel: 'Markdown mentah',
  codeLanguagePlaceholder: 'bahasa',
  imageMissing: 'Gambar tidak ditemukan',
  imageSaveFailed: 'Gagal menyimpan gambar',
  previewEmpty: 'Pratinjau muncul di sini',
  previewLoading: 'Memuat pratinjau…',
  previewError: 'Tidak bisa dirender',
  mathBlockLabel: 'Rumus (LaTeX)',
  mathInlineLabel: 'Rumus LaTeX',
  mathInlinePlaceholder: 'rumus',
  callouts: {
    note: 'Catatan',
    tip: 'Tips',
    important: 'Penting',
    warning: 'Peringatan',
    caution: 'Hati-hati',
  },
  slash: {
    text: { label: 'Teks', aliases: ['text', 'teks', 'paragraf', 'paragraph', 'p'] },
    h1: { label: 'Heading 1', aliases: ['h1', 'judul', 'heading', 'title'] },
    h2: { label: 'Heading 2', aliases: ['h2', 'subjudul', 'heading'] },
    h3: { label: 'Heading 3', aliases: ['h3', 'heading'] },
    h4: { label: 'Heading 4', aliases: ['h4', 'heading'] },
    h5: { label: 'Heading 5', aliases: ['h5', 'heading'] },
    h6: { label: 'Heading 6', aliases: ['h6', 'heading'] },
    bullet: { label: 'Bullet list', aliases: ['bullet', 'list', 'ul', 'daftar'] },
    ordered: { label: 'Numbered list', aliases: ['numbered', 'ordered', 'ol', 'nomor', 'angka'] },
    task: { label: 'Task list', aliases: ['task', 'todo', 'checklist', 'tugas'] },
    quote: { label: 'Kutipan', aliases: ['quote', 'kutipan', 'blockquote'] },
    code: { label: 'Code block', aliases: ['code', 'kode', 'pre'] },
    table: { label: 'Tabel', aliases: ['table', 'tabel'] },
    image: { label: 'Gambar', aliases: ['image', 'gambar', 'img', 'foto'] },
    hr: { label: 'Garis pemisah', aliases: ['hr', 'divider', 'garis', 'separator'] },
    link: { label: 'Link', aliases: ['link', 'tautan', 'url'] },
    note: { label: 'Catatan', aliases: ['callout', 'note', 'catatan', 'info', 'alert'] },
    tip: { label: 'Tips', aliases: ['callout', 'tip', 'tips', 'saran', 'alert'] },
    important: { label: 'Penting', aliases: ['callout', 'important', 'penting', 'alert'] },
    warning: {
      label: 'Peringatan',
      aliases: ['callout', 'warning', 'peringatan', 'awas', 'alert'],
    },
    caution: { label: 'Hati-hati', aliases: ['callout', 'caution', 'bahaya', 'hati', 'alert'] },
    math: { label: 'Rumus blok', aliases: ['math', 'rumus', 'latex', 'equation', 'persamaan'] },
    mathInline: { label: 'Rumus inline', aliases: ['math', 'rumus', 'latex', 'inline'] },
    mermaid: {
      label: 'Diagram Mermaid',
      aliases: ['mermaid', 'diagram', 'flowchart', 'bagan', 'grafik'],
    },
  },
};
