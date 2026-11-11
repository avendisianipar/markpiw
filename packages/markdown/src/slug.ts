// SPDX-License-Identifier: MIT
// Slug anchor heading seperti GitHub (github-slugger): huruf kecil, tanda baca dibuang, spasi
// menjadi `-`, dan heading kembar diberi akhiran `-1`, `-2`, … sesuai urutan kemunculan.

const STRIP = /[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu;

/** Slug satu teks heading (tanpa penanganan duplikat). */
export function slugBase(text: string): string {
  return text.toLowerCase().replace(STRIP, '').replace(/ /g, '-');
}

/** Slug untuk daftar heading berurutan; duplikat mendapat akhiran seperti di GitHub. */
export function headingSlugs(texts: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return texts.map((text) => {
    const base = slugBase(text);
    let slug = base;
    let count = seen.get(base) ?? 0;
    while (seen.has(slug)) slug = `${base}-${++count}`;
    seen.set(base, count);
    seen.set(slug, 0);
    return slug;
  });
}
