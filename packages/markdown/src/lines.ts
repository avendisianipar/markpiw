// SPDX-License-Identifier: LicenseRef-Proprietary

/** Pencarian awal/akhir baris untuk offset UTF-16 dalam sebuah teks. */
export class LineIndex {
  private readonly starts: number[];

  constructor(private readonly text: string) {
    this.starts = [0];
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) {
      this.starts.push(i + 1);
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

  /** Offset akhir baris yang memuat `offset`, sebelum `\r\n`/`\n`. */
  lineEnd(offset: number): number {
    const nl = this.text.indexOf('\n', offset);
    if (nl === -1) return this.text.length;
    return nl > 0 && this.text[nl - 1] === '\r' && nl - 1 >= offset ? nl - 1 : nl;
  }
}
