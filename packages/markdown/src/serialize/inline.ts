// SPDX-License-Identifier: LicenseRef-Proprietary
// Serialisasi konten inline + mark (rencana Fase 1, Task 8). Menghasilkan markdown dengan
// semua kandidat escape sudah di-escape, beserta offset backslash-nya untuk escapeMinimal.
import type { Mark, Node } from 'prosemirror-model';
import type { Profile } from '../types';

/** Definisi link dokumen (`[label]: url "title"`). */
export interface LinkDefinition {
  readonly label: string;
  readonly url: string;
  readonly title: string | null;
}

export interface InlineOptions {
  readonly inTable: boolean;
  readonly inAtxHeading: boolean;
  /** Definisi link dokumen; jika tidak diberikan, referensi ditulis apa adanya. */
  readonly definitions?: readonly LinkDefinition[];
}

/** Normalisasi label referensi (CommonMark): whitespace diringkas, case-insensitive. */
const normLabel = (label: string) =>
  label
    .replace(/[\t\n\r ]+/g, ' ')
    .trim()
    .toLowerCase();

export interface InlineResult {
  /** Markdown dengan semua kandidat di-escape. */
  readonly text: string;
  /** Offset backslash escape yang boleh dicoba dihapus (urut naik). */
  readonly candidates: readonly number[];
}

type Seg =
  | { readonly kind: 'text'; readonly text: string; readonly marks: readonly Mark[] }
  | { readonly kind: 'node'; readonly node: Node; readonly marks: readonly Mark[] }
  | { readonly kind: 'break'; readonly node: Node | null; readonly marks: readonly Mark[] };

const ALWAYS = new Set(['\\', '`', '*', '_', '[', ']', '<', '>', '~', '|', '&', '#', '!']);
const LINE_START = new Set(['-', '+', '=']);
const ALNUM = /[\p{L}\p{N}]/u;

const isCode = (marks: readonly Mark[]) => marks.some((m) => m.type.name === 'code');
const hasMark = (marks: readonly Mark[], mark: Mark) => mark.isInSet(marks);

/** Ratakan konten inline menjadi segmen; `\n` di text node menjadi break. */
function flatten(block: Node): Seg[] {
  const segs: Seg[] = [];
  block.forEach((child) => {
    if (child.isText) {
      (child.text ?? '').split('\n').forEach((part, i) => {
        if (i > 0) segs.push({ kind: 'break', node: null, marks: child.marks });
        if (part !== '') segs.push({ kind: 'text', text: part, marks: child.marks });
      });
    } else if (child.type.name === 'soft_break' || child.type.name === 'hard_break') {
      segs.push({ kind: 'break', node: child, marks: child.marks });
    } else {
      segs.push({ kind: 'node', node: child, marks: child.marks });
    }
  });
  return segs;
}

/** Buang spasi/tab di tepi setiap baris (tidak bermakna, dan bisa mengubah struktur). */
function trimLines(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  let line: Seg[] = [];
  const trimAt = (i: number, re: RegExp): boolean => {
    const seg = line[i];
    if (!seg || seg.kind !== 'text' || isCode(seg.marks)) return false;
    const text = seg.text.replace(re, '');
    if (text === '') {
      line.splice(i, 1);
      return true;
    }
    line[i] = { ...seg, text };
    return false;
  };
  const flush = () => {
    while (trimAt(0, /^[ \t]+/));
    while (line.length > 0 && trimAt(line.length - 1, /[ \t]+$/));
    out.push(...line);
    line = [];
  };
  for (const seg of segs) {
    if (seg.kind === 'break') {
      flush();
      out.push(seg);
    } else {
      line.push(seg);
    }
  }
  flush();
  return collapseBreaks(out);
}

/**
 * Break di tepi blok tidak bermakna, dan soft break tepat setelah break lain akan menulis
 * baris kosong yang memecah paragraf; keduanya dibuang.
 */
function collapseBreaks(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const seg of segs) {
    if (seg.kind === 'break') {
      const prev = out[out.length - 1];
      const soft = seg.node?.type.name !== 'hard_break';
      if (prev === undefined || (soft && prev.kind === 'break')) continue;
    }
    out.push(seg);
  }
  while (out.length > 0 && (out[out.length - 1] as Seg).kind === 'break') out.pop();
  return out;
}

/**
 * Pecah teks non-code menjadi potongan whitespace / non-whitespace, lalu buang mark dari
 * whitespace di tepi rentang mark, sehingga whitespace keluar dari delimiter (`**a **` →
 * `**a** `).
 */
function moveEdgeWhitespace(segs: Seg[]): Seg[] {
  const pieces: Seg[] = [];
  for (const seg of segs) {
    if (seg.kind === 'text' && !isCode(seg.marks)) {
      for (const text of seg.text.match(/[ \t]+|[^ \t]+/g) ?? []) pieces.push({ ...seg, text });
    } else {
      pieces.push(seg);
    }
  }
  const isWsText = (seg: Seg) =>
    seg.kind === 'text' && !isCode(seg.marks) && /^[ \t]+$/.test(seg.text);
  const neighbor = (from: number, step: number): Seg | null => {
    for (let i = from + step; i >= 0 && i < pieces.length; i += step) {
      const seg = pieces[i] as Seg;
      if (seg.kind === 'break') return null;
      if (!isWsText(seg)) return seg;
    }
    return null;
  };
  const marked = pieces.map((seg, i) => {
    if (seg.kind !== 'text' || !isWsText(seg) || seg.marks.length === 0) return seg;
    const before = neighbor(i, -1);
    const after = neighbor(i, 1);
    const keep = (m: Mark) =>
      before !== null &&
      before.kind !== 'break' &&
      hasMark(before.marks, m) &&
      after !== null &&
      after.kind !== 'break' &&
      hasMark(after.marks, m);
    return { ...seg, marks: seg.marks.filter(keep) };
  });
  // Potongan tidak digabung kembali: whitespace harus tetap segmen tersendiri agar tidak
  // pernah membuka mark (lihat inlineWithCandidates).
  return marked;
}

function sameSet(a: readonly Mark[], b: readonly Mark[]): boolean {
  return a.length === b.length && a.every((m, i) => m.eq(b[i] as Mark));
}

/** Jumlah segmen berturut-turut (break dilewati) mulai `from` yang memuat `mark`. */
function continuation(segs: Seg[], from: number, mark: Mark): number {
  let n = 0;
  for (let i = from; i < segs.length; i++) {
    const seg = segs[i] as Seg;
    if (seg.kind === 'break') continue;
    if (!hasMark(seg.marks, mark)) break;
    n++;
  }
  return n;
}

/** Wrap URL dengan `<…>` jika mengandung spasi atau tanda kurung tidak seimbang. */
function linkDestination(url: string): string {
  let depth = 0;
  let balanced = true;
  for (const ch of url) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) balanced = false;
  }
  if (depth !== 0) balanced = false;
  return /[\s<>]/.test(url) || !balanced || url === '' ? `<${url}>` : url;
}

function linkTitle(title: string | null): string {
  return title === null ? '' : ` "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function codeSpan(content: string): string {
  let longest = 0;
  for (const run of content.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const fence = '`'.repeat(longest + 1);
  const pad = /^[` ]|[` ]$/.test(content) && !/^ *$/.test(content) ? ' ' : '';
  return fence + pad + content + pad + fence;
}

/** `n` karakter pertama setelah segmen `from` (break = `\n`, node inline = `\uFFFC`). */
function following(segs: Seg[], from: number, n: number): string {
  let out = '';
  for (let i = from; i < segs.length && out.length < n; i++) {
    const seg = segs[i] as Seg;
    out += seg.kind === 'text' ? seg.text : seg.kind === 'break' ? '\n' : '\uFFFC';
  }
  return out.slice(0, n);
}

const TRAILING_PUNCT = new Set(['.', ',', ':', ';', '!', '?', ')']);
const isSpace = (ch: string) => ch === '' || /\s/.test(ch);

/**
 * URL telanjang (autolink literal GFM) hanya dikenali jika teksnya sama dengan URL-nya,
 * didahului awal/spasi/`(`/`*`/`_`/`~`, dan diakhiri spasi/akhir (boleh lewat tanda baca
 * penutup).
 */
function literalSafe(content: string, href: string, before: string, after: string): boolean {
  const sameTarget =
    href === content || href === `http://${content}` || href === `mailto:${content}`;
  if (!sameTarget) return false;
  if (!(isSpace(before) || /[(*_~]/.test(before))) return false;
  const [first = '', second = ''] = after;
  return isSpace(first) || (TRAILING_PUNCT.has(first) && isSpace(second));
}

/**
 * Rentang link autolink/literal yang bisa ditulis telanjang: semua segmennya teks dengan set
 * mark identik (tanpa code), dan teksnya sama dengan URL-nya. `null` jika harus ditulis
 * sebagai link inline.
 */
function bareLink(
  segs: Seg[],
  from: number,
  mark: Mark,
  marks: readonly Mark[],
): { content: string; end: number } | null {
  const kind = mark.attrs.kind as string;
  if ((kind !== 'autolink' && kind !== 'literal') || isCode(marks)) return null;
  let content = '';
  let end = from;
  while (end < segs.length) {
    const s = segs[end] as Seg;
    if (s.kind === 'break' || !hasMark(s.marks, mark)) break;
    if (s.kind !== 'text' || !sameSet(s.marks, marks)) return null;
    content += s.text;
    end++;
  }
  const href = mark.attrs.href as string;
  const same =
    href === content ||
    href === `mailto:${content}` ||
    (kind === 'literal' && href === `http://${content}`);
  return same ? { content, end } : null;
}

/** Semua segmen teks di rentang link punya set mark yang sama dengan `marks`. */
function uniformRange(segs: Seg[], from: number, mark: Mark, marks: readonly Mark[]): boolean {
  for (let i = from; i < segs.length; i++) {
    const seg = segs[i] as Seg;
    if (seg.kind === 'break') continue;
    if (!hasMark(seg.marks, mark)) break;
    if (seg.kind !== 'text' || !sameSet(seg.marks, marks)) return false;
  }
  return true;
}

/** Teks polos rentang link yang dimulai di segmen `from`. */
function linkText(segs: Seg[], from: number, mark: Mark): string {
  let text = '';
  for (let i = from; i < segs.length; i++) {
    const seg = segs[i] as Seg;
    if (seg.kind === 'break') {
      text += ' ';
      continue;
    }
    if (!hasMark(seg.marks, mark)) break;
    if (seg.kind === 'text') text += seg.text;
  }
  return text;
}

interface Open {
  readonly mark: Mark;
  readonly close: string;
  /** Link referensi shortcut/collapsed: teksnya adalah label, jadi escape dibatasi. */
  readonly label?: boolean;
}

const ASCII_PUNCT = /[!-/:-@[-`{-~]/;

class InlineWriter {
  text = '';
  readonly candidates: number[] = [];
  private lineStart: boolean;
  /** > 0 saat menulis teks link referensi shortcut/collapsed (teks = label). */
  labelDepth = 0;

  constructor(
    private readonly opts: InlineOptions,
    atLineStart: boolean,
  ) {
    this.lineStart = atLineStart;
  }

  /** Tulis sintaks markdown apa adanya (delimiter, URL, source mentah). */
  raw(s: string): void {
    if (s === '') return;
    this.text += s;
    if (/[^ \t]/.test(s)) this.lineStart = false;
  }

  lineBreak(s: string): void {
    this.text += s;
    this.lineStart = true;
  }

  /** Tulis teks biasa dengan semua kandidat escape di-escape. */
  plain(s: string): void {
    if (this.labelDepth > 0) {
      this.label(s);
      return;
    }
    for (let i = 0; i < s.length; i++) {
      const ch = s[i] as string;
      const startOfLine = this.lineStart;
      const candidate = ALWAYS.has(ch) || (startOfLine && LINE_START.has(ch));
      if (startOfLine && /\d/.test(ch)) {
        const m = /^\d{1,9}([.)])/.exec(s.slice(i));
        if (m) {
          this.raw(m[0].slice(0, -1));
          i += m[0].length - 1;
          this.escape(m[1] as string, true);
          continue;
        }
      }
      if (this.opts.inTable && ch === '|') {
        this.escape(ch, false);
        continue;
      }
      if (candidate) this.escape(ch, true);
      else this.raw(ch);
    }
  }

  /**
   * Teks label referensi harus sama dengan label definisinya, jadi hanya `[`, `]`, dan `\`
   * sebelum tanda baca yang di-escape (paksa, bukan kandidat).
   */
  private label(s: string): void {
    for (let i = 0; i < s.length; i++) {
      const ch = s[i] as string;
      const needs = ch === '[' || ch === ']' || (ch === '\\' && ASCII_PUNCT.test(s[i + 1] ?? ']'));
      if (needs) this.escape(ch, false);
      else this.raw(ch);
    }
  }

  private escape(ch: string, removable: boolean): void {
    if (removable) this.candidates.push(this.text.length);
    this.text += '\\' + ch;
    this.lineStart = false;
  }

  lastChar(): string {
    return this.text.slice(-1);
  }
}

/** Markdown konten inline `block` dengan semua kandidat escape di-escape. */
export function inlineWithCandidates(
  block: Node,
  profile: Profile,
  eol: string,
  opts: InlineOptions,
  atLineStart = true,
): InlineResult {
  const segs = moveEdgeWhitespace(trimLines(flatten(block)));
  const w = new InlineWriter(opts, atLineStart);
  const stack: Open[] = [];
  const singleLine = opts.inAtxHeading || opts.inTable;

  const closeTo = (keep: number) => {
    while (stack.length > keep) {
      const open = stack.pop() as Open;
      if (open.label) w.labelDepth--;
      w.raw(open.close);
    }
  };
  const keepCount = (marks: readonly Mark[]) => {
    let keep = 0;
    while (keep < stack.length && hasMark(marks, (stack[keep] as Open).mark)) keep++;
    return keep;
  };

  let i = 0;
  while (i < segs.length) {
    const seg = segs[i] as Seg;
    if (seg.kind === 'break') {
      closeTo(keepCount(seg.marks));
      const hard = seg.node?.type.name === 'hard_break';
      if (singleLine) w.raw(' ');
      else if (!hard) w.lineBreak(eol);
      else w.lineBreak((seg.node?.attrs.style === 'spaces' ? '  ' : '\\') + eol);
      i++;
      continue;
    }

    // Tutup mark aktif yang tidak dimiliki segmen ini (dari yang paling dalam).
    closeTo(keepCount(seg.marks));

    // Buka mark baru: link paling luar, code paling dalam, sisanya yang paling panjang dulu.
    // Whitespace tidak pernah membuka mark (delimiter pembuka tidak boleh diikuti spasi);
    // mark dibuka di segmen non-whitespace berikutnya.
    const wsOnly = seg.kind === 'text' && !isCode(seg.marks) && /^[ \t]+$/.test(seg.text);
    const opening = seg.marks
      .filter((m) => !wsOnly && !stack.some((o) => o.mark.eq(m)))
      .sort((a, b) => {
        const rank = (m: Mark) => (m.type.name === 'link' ? 0 : m.type.name === 'code' ? 2 : 1);
        return (
          rank(a) - rank(b) ||
          continuation(segs, i, b) - continuation(segs, i, a) ||
          a.type.rank - b.type.rank
        );
      });

    const openDelimited = (mark: Mark) => {
      let delim: string;
      if (mark.type.name === 'strike') delim = '~~';
      else {
        const isStrong = mark.type.name === 'strong';
        delim =
          (mark.attrs.delim as string | null) ?? (isStrong ? profile.strongDelim : profile.emDelim);
        if (delim[0] === '_') {
          const next = segs[i + continuation(segs, i, mark)];
          const after = next && next.kind === 'text' ? (next.text[0] ?? '') : '';
          if (ALNUM.test(w.lastChar()) || ALNUM.test(after)) delim = isStrong ? '**' : '*';
        }
      }
      w.raw(delim);
      stack.push({ mark, close: delim });
    };
    /** `plain`: isi link teks polos tanpa mark lain yang dibuka di dalamnya. */
    const openLink = (mark: Mark, plain: boolean) => {
      w.raw('[');
      const href = mark.attrs.href as string;
      const title = mark.attrs.title as string | null;
      if (mark.attrs.kind === 'reference') {
        const label = mark.attrs.refLabel as string | null;
        if (label !== null && label !== '') {
          stack.push({ mark, close: `][${label}]` });
          return;
        }
        // Shortcut/collapsed: teksnya adalah label. Jika teks sudah tidak cocok dengan label
        // definisi URL ini, pakai bentuk full dengan label definisi, atau link inline.
        const defs = opts.definitions;
        const target = (d: LinkDefinition) => d.url === href && d.title === title;
        const text = normLabel(linkText(segs, i, mark));
        if (plain && (!defs || defs.some((d) => target(d) && normLabel(d.label) === text))) {
          w.labelDepth++;
          stack.push({ mark, close: label === null ? ']' : '][]', label: true });
          return;
        }
        const def = defs?.find(target);
        if (def) {
          stack.push({ mark, close: `][${def.label}]` });
          return;
        }
      }
      stack.push({ mark, close: `](${linkDestination(href)}${linkTitle(title)})` });
    };

    let consumed = false;
    for (let k = 0; k < opening.length; k++) {
      const mark = opening[k] as Mark;
      const name = mark.type.name;
      if (name === 'code' && seg.kind === 'text') {
        // Seluruh rentang code (segmen dengan mark identik) ditulis sebagai satu code span.
        let content = '';
        let j = i;
        while (j < segs.length) {
          const s = segs[j] as Seg;
          if (s.kind !== 'text' || !sameSet(s.marks, seg.marks)) break;
          content += s.text;
          j++;
        }
        w.raw(codeSpan(opts.inTable ? content.replace(/\|/g, '\\|') : content));
        i = j;
        consumed = true;
        break;
      }
      if (name === 'code') continue; // code pada node non-teks tidak bisa ditulis
      if (name !== 'link') {
        openDelimited(mark);
        continue;
      }
      const bare = bareLink(segs, i, mark, seg.marks);
      if (!bare) {
        const plain = k === opening.length - 1 && uniformRange(segs, i, mark, seg.marks);
        openLink(mark, plain);
        continue;
      }
      // Bentuk telanjang tidak bisa membawa mark di dalamnya: mark lain dibuka di luar link.
      for (const other of opening.slice(k + 1)) openDelimited(other);
      const kind = mark.attrs.kind as string;
      const href = mark.attrs.href as string;
      if (
        kind === 'literal' &&
        !literalSafe(bare.content, href, w.lastChar(), following(segs, bare.end, 2))
      ) {
        // URL telanjang tidak akan dikenali GFM di posisi ini: tulis sebagai link inline.
        openLink(mark, true);
        break;
      }
      if (kind === 'literal') w.raw(bare.content);
      else {
        const shown =
          href.startsWith('mailto:') && !bare.content.startsWith('mailto:')
            ? href.slice('mailto:'.length)
            : href;
        w.raw(`<${shown}>`);
      }
      i = bare.end;
      consumed = true;
      break;
    }
    if (consumed) continue;

    if (seg.kind === 'text') {
      w.plain(seg.text);
    } else if (seg.node.type.name === 'image') {
      const { src, alt, title } = seg.node.attrs as {
        src: string;
        alt: string;
        title: string | null;
      };
      w.raw('![');
      w.plain(alt);
      w.raw(`](${linkDestination(src)}${linkTitle(title)})`);
    } else {
      w.raw((seg.node.attrs.source as string | undefined) ?? '');
    }
    i++;
  }
  closeTo(0);

  return { text: w.text, candidates: w.candidates };
}

/**
 * Konten inline `block` sebagai markdown (semua kandidat escape di-escape). `soft_break` dan
 * `hard_break` menjadi `eol`; prefix `ctx.rest` ditambahkan pemanggil.
 */
export function serializeInline(
  block: Node,
  profile: Profile,
  eol: string,
  opts: InlineOptions,
): string {
  return inlineWithCandidates(block, profile, eol, opts).text;
}
