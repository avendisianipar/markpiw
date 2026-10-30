// SPDX-License-Identifier: MIT
import { globSync, readFileSync } from 'node:fs';
import fc from 'fast-check';
import type { MarkType, Node } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, schema, serializeMarkdown, verifyRoundTrip } from '../src';
import { insertText } from './helpers';

const root = new URL('../../../', import.meta.url);
const corpus = globSync('fixtures/markdown-corpus/gfm/*.md', { cwd: root })
  .sort()
  .map((f) => readFileSync(new URL(f, root), 'utf8'));
const alphabet = fc.constantFrom(...'ab *_`#[]()<>|~\\!-+=.1\n:/@w'.split(''));

type Op = [kind: number, a: number, b: number, text: string];

const isWs = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
const isAlnum = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
const STYLE = new Set(['strong', 'em', 'strike']);
const LEAF = '￼';

/** Teks textblock dengan satu karakter per posisi (leaf inline = placeholder). */
const blockText = (doc: Node, start: number, node: Node) =>
  doc.textBetween(start, start + node.content.size, '\n', LEAF);

/** Textblock yang isinya bisa diedit bebas (bukan code/raw), beserta posisi awal kontennya. */
function editableBlocks(doc: Node): { node: Node; start: number }[] {
  const blocks: { node: Node; start: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (!node.type.spec.code) blocks.push({ node, start: pos + 1 });
      return false;
    }
    return true;
  });
  return blocks;
}

/**
 * Batas rentang strong/em/strike harus bisa ditulis dengan delimiter CommonMark: di salah satu
 * sisinya ada whitespace/tepi/leaf, atau kedua sisinya alfanumerik. Batas lain (mis. em pada
 * `mple.` di dalam `example.com`) tidak punya representasi markdown sama sekali; guard
 * menolaknya, dan editor (Fase 2) wajib mencegahnya.
 */
function representable(doc: Node): boolean {
  let ok = true;
  doc.descendants((node, pos) => {
    if (!ok) return false;
    // Item dengan paragraf pertama kosong tetapi punya blok lanjutan di-parse sebagai item yang
    // tidak diawali paragraf, yang dipetakan ke raw_block (spesifikasi 3.2).
    if (
      node.type.name === 'list_item' &&
      node.childCount > 1 &&
      (node.firstChild as Node).content.size === 0
    ) {
      ok = false;
    }
    if (!node.isTextblock) return true;
    if (node.type.spec.code) return false;
    // Heading level 3–6 dengan hard break tidak bisa ditulis (ATX satu baris, setext ≤ 2).
    if (node.type.name === 'heading' && (node.attrs.level as number) > 2) {
      node.forEach((child) => {
        if (child.type.name === 'hard_break') ok = false;
      });
    }
    // Code span markdown hanya bisa memuat teks (bukan HTML, gambar, atau break).
    node.forEach((child) => {
      if (!child.isText && child.marks.some((m) => m.type.name === 'code')) ok = false;
    });
    const text = blockText(doc, pos + 1, node);
    // Teks polos yang berbentuk URL/email/www selalu dijadikan link oleh GFM (escape dan
    // entitas diabaikan micromark); editor (Fase 2) wajib menjadikannya link otomatis.
    let plain = '';
    node.forEach((child) => {
      const linked = child.marks.some((m) => m.type.name === 'link' || m.type.name === 'code');
      const width = child.isText ? (child.text ?? '').length : 1;
      plain += linked || !child.isText ? ' '.repeat(width) : (child.text ?? '');
    });
    if (/(https?:\/\/|www\.)\S|\S@\S/i.test(plain)) ok = false; // perkiraan konservatif
    const styles: string[] = [];
    node.forEach((child) => {
      const key = child.marks
        .filter((m) => STYLE.has(m.type.name))
        .map((m) => m.type.name)
        .join(',');
      const width = child.isText ? (child.text ?? '').length : 1;
      for (let i = 0; i < width; i++) styles.push(key);
    });
    for (let i = 1; i < styles.length; i++) {
      if (styles[i] === styles[i - 1]) continue;
      const left = text[i - 1] as string;
      const right = text[i] as string;
      if (isWs(left) || isWs(right) || left === LEAF || right === LEAF) continue;
      if (!(isAlnum(left) && isAlnum(right))) ok = false;
    }
    return false;
  });
  return ok;
}

/** Perluas rentang ke batas kata (dipisah whitespace), seperti seleksi double-click. */
function snapToWords(text: string, from: number, to: number): [number, number] {
  while (from > 0 && !isWs(text[from - 1])) from--;
  while (to < text.length && !isWs(text[to])) to++;
  return [from, to];
}

const MARKS: MarkType[] = [
  schema.marks.strong,
  schema.marks.em,
  schema.marks.strike,
  schema.marks.code,
];

/**
 * 0=insertText, 1=delete, 2=toggle strong/em/strike/code (di-snap ke batas kata),
 * 3=paragraph↔heading(1-3), 4=no-op.
 */
function applyRandomOp(tr: Transform, [kind, a, b, text]: Op): void {
  const blocks = editableBlocks(tr.doc);
  if (blocks.length === 0 || kind === 4) return;
  const block = blocks[a % blocks.length] as { node: Node; start: number };
  const size = block.node.content.size;
  const p1 = block.start + (b % (size + 1));
  const p2 = block.start + ((b + a) % (size + 1));
  const [from, to] = p1 <= p2 ? [p1, p2] : [p2, p1];
  switch (kind) {
    case 0:
      if (text !== '') insertText(tr, text, from);
      return;
    case 1:
      if (from < to) tr.delete(from, to);
      return;
    case 2: {
      if (from === to) return;
      const chars = blockText(tr.doc, block.start, block.node);
      const [f, t] = snapToWords(chars, from - block.start, to - block.start);
      const mark = MARKS[b % MARKS.length] as MarkType;
      const [mf, mt] = [block.start + f, block.start + t];
      if (tr.doc.rangeHasMark(mf, mt, mark)) tr.removeMark(mf, mt, mark);
      else tr.addMark(mf, mt, mark.create());
      return;
    }
    case 3: {
      const name = block.node.type.name;
      const pos = block.start - 1;
      if (name === 'paragraph') {
        tr.setNodeMarkup(pos, schema.nodes.heading, { level: 1 + (b % 3) });
      } else if (name === 'heading') {
        tr.setNodeMarkup(pos, schema.nodes.paragraph);
      }
      return;
    }
  }
}

describe('representable', () => {
  const em = schema.marks.em.create();
  const para = (...content: Node[]) =>
    schema.node('doc', null, [schema.node('paragraph', null, content)]);
  it('rejects style boundaries between punctuation and a letter', () => {
    expect(
      representable(para(schema.text('exa'), schema.text('mple.', [em]), schema.text('com'))),
    ).toBe(false);
  });
  it('rejects code marks on non-text inline nodes', () => {
    const code = schema.marks.code.create();
    expect(
      representable(
        para(
          schema.text('a', [code]),
          schema.node('raw_inline', { source: '<b>' }, undefined, [code]),
        ),
      ),
    ).toBe(false);
  });
  it('accepts boundaries next to whitespace or between letters', () => {
    expect(representable(para(schema.text('a '), schema.text('b.', [em]), schema.text(' c')))).toBe(
      true,
    );
    expect(
      representable(para(schema.text('foo'), schema.text('bar', [em]), schema.text('baz'))),
    ).toBe(true);
  });
});

describe('property: random edits keep the round-trip guard green', () => {
  it('holds for insert/delete/mark/blockType edits', () => {
    fc.assert(
      fc.property(
        fc.nat(corpus.length - 1),
        fc.array(
          fc.tuple(fc.nat(4), fc.nat(), fc.nat(), fc.string({ unit: alphabet, maxLength: 6 })),
          { minLength: 1, maxLength: 8 },
        ),
        (ci, ops) => {
          const parsed = parseMarkdown(corpus[ci] as string);
          const tr = new Transform(parsed.doc);
          for (const op of ops) {
            // Operasi yang melanggar schema (mis. heading sebagai anak pertama list_item)
            // ditolak seperti di editor, lalu dilewati.
            try {
              applyRandomOp(tr, op as Op);
            } catch (error) {
              if (!(error instanceof Error && error.name === 'TransformError')) throw error;
            }
          }
          fc.pre(representable(tr.doc));
          const out = serializeMarkdown(parsed, tr.doc);
          const r = verifyRoundTrip(out, tr.doc);
          if (!r.ok) throw new Error(`${JSON.stringify(r.error)}\n--- output ---\n${out}`);
        },
      ),
      { numRuns: 300, seed: 20261028 },
    );
  });
});
