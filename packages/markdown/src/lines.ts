// SPDX-License-Identifier: LicenseRef-Proprietary

/** Line ending seperti CommonMark/micromark: `\r\n`, `\r`, atau `\n`. */
export const LINE_BREAK = /\r\n|\r|\n/;
const LINE_BREAK_G = /\r\n|\r|\n/g;

/** Pencarian awal/akhir baris untuk offset UTF-16 dalam sebuah teks. */
export class LineIndex {
  private readonly starts: number[] = [0];
  /** Offset awal setiap line ending (urut naik). */
  private readonly breaks: number[] = [];

  constructor(private readonly text: string) {
    for (const m of text.matchAll(LINE_BREAK_G)) {
      this.breaks.push(m.index);
      this.starts.push(m.index + m[0].length);
    }
  }

  /** Offset awal baris yang memuat `offset`. */
  lineStart(offset: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.starts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return this.starts[lo] as number;
  }

  /** Offset akhir baris yang memuat `offset` (sebelum line ending-nya). */
  lineEnd(offset: number): number {
    const i = this.firstBreakAtOrAfter(offset);
    return i === -1 ? this.text.length : (this.breaks[i] as number);
  }

  /** Awal baris setelah baris yang memuat `offset`. */
  nextLineStart(offset: number): number {
    const i = this.firstBreakAtOrAfter(offset);
    return i === -1 ? this.text.length : (this.starts[i + 1] as number);
  }

  private firstBreakAtOrAfter(offset: number): number {
    let lo = 0;
    let hi = this.breaks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((this.breaks[mid] as number) < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo < this.breaks.length ? lo : -1;
  }
}

/** Jumlah line ending di `text`. */
export const countLineBreaks = (text: string) => text.match(LINE_BREAK_G)?.length ?? 0;
