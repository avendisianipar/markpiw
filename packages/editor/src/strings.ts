// SPDX-License-Identifier: LicenseRef-Proprietary

export type SlashItemId =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'ordered'
  | 'task'
  | 'quote'
  | 'code'
  | 'table'
  | 'image'
  | 'hr';

/** Teks yang dipakai engine editor (UI memberikan versi terjemahannya). */
export interface EditorStrings {
  readonly placeholder: string;
  readonly rawBlockLabel: string;
  readonly codeLanguagePlaceholder: string;
  readonly imageMissing: string;
  readonly imageSaveFailed: string;
  readonly slash: Readonly<Record<SlashItemId, { label: string; aliases: readonly string[] }>>;
}

export const DEFAULT_EDITOR_STRINGS: EditorStrings = {
  placeholder: "Ketik '/' untuk perintah…",
  rawBlockLabel: 'Markdown mentah',
  codeLanguagePlaceholder: 'bahasa',
  imageMissing: 'Gambar tidak ditemukan',
  imageSaveFailed: 'Gagal menyimpan gambar',
  slash: {
    text: { label: 'Teks', aliases: ['text', 'paragraf', 'paragraph', 'p'] },
    h1: { label: 'Heading 1', aliases: ['h1', 'judul', 'heading', 'title'] },
    h2: { label: 'Heading 2', aliases: ['h2', 'subjudul', 'heading'] },
    h3: { label: 'Heading 3', aliases: ['h3', 'heading'] },
    bullet: { label: 'Bullet list', aliases: ['bullet', 'list', 'ul', 'daftar'] },
    ordered: { label: 'Numbered list', aliases: ['numbered', 'ordered', 'ol', 'nomor', 'angka'] },
    task: { label: 'Task list', aliases: ['task', 'todo', 'checklist', 'tugas'] },
    quote: { label: 'Quote', aliases: ['quote', 'kutipan', 'blockquote'] },
    code: { label: 'Code block', aliases: ['code', 'kode', 'pre'] },
    table: { label: 'Tabel', aliases: ['table', 'tabel'] },
    image: { label: 'Gambar', aliases: ['image', 'gambar', 'img', 'foto'] },
    hr: { label: 'Garis pemisah', aliases: ['hr', 'divider', 'garis', 'separator'] },
  },
};
