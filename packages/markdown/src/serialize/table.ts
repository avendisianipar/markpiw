// SPDX-License-Identifier: LicenseRef-Proprietary
// Serialisasi tabel GFM: mode compact (dengan preservasi baris) dan aligned (re-padding).
import type { Node } from 'prosemirror-model';
import { schema } from '../schema';
import { type Ctx, entryOf } from './context';
import { escapeMinimal } from './escape';
import { inlineWithCandidates } from './inline';
import type { SerializerState } from './serialize';
import { prefixLines } from './blocks';

type Align = 'left' | 'center' | 'right' | null;

/** Parse ulang isi satu sel di dalam tabel minimal; kembalikan isinya sebagai paragraf. */
function reparseCell(md: string, s: SerializerState): Node | null {
  const table = s.reparse(`| ${md} |\n| --- |`);
  if (table?.type.name !== 'table' || table.firstChild?.childCount !== 1) return null;
  return schema.nodes.paragraph.create(null, table.firstChild.firstChild?.content);
}

function cellMarkdown(cell: Node, s: SerializerState): string {
  const inline = inlineWithCandidates(
    cell,
    s.profile,
    s.eol,
    { inTable: true, inAtxHeading: false },
    false,
  );
  const target = schema.nodes.paragraph.create(null, cell.content);
  return escapeMinimal(inline.text, inline.candidates, target, (md) => reparseCell(md, s));
}

function compactDelimiter(align: Align): string {
  return align === 'left'
    ? ':---'
    : align === 'center'
      ? ':---:'
      : align === 'right'
        ? '---:'
        : '---';
}

function alignedDelimiter(align: Align, width: number): string {
  if (align === 'left') return ':' + '-'.repeat(width - 1);
  if (align === 'center') return ':' + '-'.repeat(width - 2) + ':';
  if (align === 'right') return '-'.repeat(width - 1) + ':';
  return '-'.repeat(width);
}

const sameAlign = (a: readonly Align[], b: readonly Align[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

export function serializeTable(node: Node, ctx: Ctx, s: SerializerState): string {
  const e = entryOf(node, s.index);
  const align = node.attrs.align as Align[];
  const rows: string[][] = [];
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => cells.push(cellMarkdown(cell, s)));
    rows.push(cells);
  });
  // Baris delimiter harus selebar header; baris body boleh punya sel berlebih (diabaikan GFM).
  const columns = node.firstChild?.childCount ?? align.length;
  const widest = Math.max(columns, ...rows.map((r) => r.length));
  const aligned = e ? e.tableAligned : s.profile.tablePadding === 'aligned';

  const lines: string[] = [];
  if (aligned) {
    const widths = Array.from({ length: widest }, (_, c) =>
      Math.max(3, ...rows.map((r) => (r[c] ?? '').length)),
    );
    const render = (cells: string[]) =>
      '| ' +
      widths
        .slice(0, Math.max(columns, cells.length))
        .map((w, c) => (cells[c] ?? '').padEnd(w))
        .join(' | ') +
      ' |';
    rows.forEach((cells, r) => {
      lines.push(render(cells));
      if (r === 0) {
        lines.push(
          '| ' +
            widths
              .slice(0, columns)
              .map((w, c) => alignedDelimiter(align[c] ?? null, w))
              .join(' | ') +
            ' |',
        );
      }
    });
  } else {
    const old = e?.node;
    const oldLines = e?.tableLines ?? null;
    const preserve =
      old !== undefined &&
      oldLines !== null &&
      (old.firstChild?.childCount ?? -1) === (node.firstChild?.childCount ?? -2);
    const render = (cells: string[]) => '| ' + cells.join(' | ') + ' |';
    rows.forEach((cells, r) => {
      const oldLine = r === 0 ? oldLines?.[0] : oldLines?.[r + 1];
      const oldRow = old !== undefined && r < old.childCount ? old.child(r) : null;
      lines.push(
        preserve && oldLine !== undefined && oldRow?.eq(node.child(r)) ? oldLine : render(cells),
      );
      if (r === 0) {
        const oldAlign = (old?.attrs.align as Align[] | undefined) ?? [];
        const oldDelimiter = oldLines?.[1];
        lines.push(
          preserve && oldDelimiter !== undefined && sameAlign(oldAlign, align)
            ? oldDelimiter
            : '| ' +
                Array.from({ length: columns }, (_, c) => compactDelimiter(align[c] ?? null)).join(
                  ' | ',
                ) +
                ' |',
        );
      }
    });
  }
  return prefixLines(lines.join(s.eol), ctx, s.eol);
}
