// SPDX-License-Identifier: LicenseRef-Proprietary
// Perintah tabel dasar (tanpa seleksi multi-sel) dan navigasi sel dengan Tab.
import { schema } from '@markpiw/markdown';
import type { Node } from 'prosemirror-model';
import { type Command, type EditorState, TextSelection } from 'prosemirror-state';

export type TableAlign = 'left' | 'center' | 'right' | null;

export interface CellInfo {
  readonly table: Node;
  readonly tablePos: number;
  readonly rowIndex: number;
  readonly colIndex: number;
}

export function findCell(state: EditorState): CellInfo | null {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type === schema.nodes.table_cell && d >= 2) {
      return {
        table: $from.node(d - 2),
        tablePos: $from.before(d - 2),
        rowIndex: $from.index(d - 2),
        colIndex: $from.index(d - 1),
      };
    }
  }
  return null;
}

/** Posisi awal konten sel (baris r, kolom c) di tabel pada `tablePos`. */
function cellContentPos(table: Node, tablePos: number, r: number, c: number): number {
  let pos = tablePos + 1;
  for (let i = 0; i < r; i++) pos += table.child(i).nodeSize;
  pos += 1;
  const row = table.child(r);
  for (let i = 0; i < c; i++) pos += row.child(i).nodeSize;
  return pos + 1;
}

function rebuild(
  info: CellInfo,
  rows: Node[][],
  align: TableAlign[],
  select: [number, number],
): Command {
  return (state, dispatch) => {
    const table = schema.nodes.table.create(
      { ...info.table.attrs, align },
      rows.map((cells, r) =>
        schema.nodes.table_row.create(
          null,
          cells.map((cell) => schema.nodes.table_cell.create({ header: r === 0 }, cell.content)),
        ),
      ),
    );
    if (dispatch) {
      const tr = state.tr.replaceWith(info.tablePos, info.tablePos + info.table.nodeSize, table);
      const [r, c] = select;
      const pos = cellContentPos(
        table,
        info.tablePos,
        Math.min(r, rows.length - 1),
        Math.min(c, (rows[0]?.length ?? 1) - 1),
      );
      tr.setSelection(TextSelection.create(tr.doc, pos));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function cells(table: Node): Node[][] {
  const out: Node[][] = [];
  table.forEach((row) => {
    const r: Node[] = [];
    row.forEach((cell) => r.push(cell));
    out.push(r);
  });
  return out;
}

const emptyCell = () => schema.nodes.table_cell.create({ header: false });

export const tableCommands = {
  addRow(side: 'before' | 'after'): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info) return false;
      const rows = cells(info.table);
      const width = rows[0]?.length ?? 1;
      // Baris baru tidak boleh menggantikan header: sebelum header berarti setelahnya.
      const at = side === 'before' && info.rowIndex > 0 ? info.rowIndex : info.rowIndex + 1;
      rows.splice(at, 0, Array.from({ length: width }, emptyCell));
      return rebuild(info, rows, info.table.attrs.align as TableAlign[], [at, info.colIndex])(
        state,
        dispatch,
      );
    };
  },
  addColumn(side: 'before' | 'after'): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info) return false;
      const at = side === 'before' ? info.colIndex : info.colIndex + 1;
      const rows = cells(info.table).map((r) => {
        const copy = [...r];
        copy.splice(at, 0, emptyCell());
        return copy;
      });
      const align = [...(info.table.attrs.align as TableAlign[])];
      align.splice(at, 0, null);
      return rebuild(info, rows, align, [info.rowIndex, at])(state, dispatch);
    };
  },
  deleteRow(): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info || info.table.childCount <= 2 || info.rowIndex === 0) return false;
      const rows = cells(info.table);
      rows.splice(info.rowIndex, 1);
      return rebuild(info, rows, info.table.attrs.align as TableAlign[], [
        info.rowIndex - 1,
        info.colIndex,
      ])(state, dispatch);
    };
  },
  deleteColumn(): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info || (info.table.firstChild?.childCount ?? 0) <= 1) return false;
      const rows = cells(info.table).map((r) => r.filter((_, c) => c !== info.colIndex));
      const align = (info.table.attrs.align as TableAlign[]).filter((_, c) => c !== info.colIndex);
      return rebuild(info, rows, align, [info.rowIndex, Math.max(0, info.colIndex - 1)])(
        state,
        dispatch,
      );
    };
  },
  setAlign(value: TableAlign): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info) return false;
      const width = info.table.firstChild?.childCount ?? 0;
      const align = Array.from(
        { length: width },
        (_, c) => (info.table.attrs.align as TableAlign[])[c] ?? null,
      );
      align[info.colIndex] = value;
      if (dispatch)
        dispatch(state.tr.setNodeMarkup(info.tablePos, null, { ...info.table.attrs, align }));
      return true;
    };
  },
  /** Pindah ke sel berikutnya/sebelumnya; di sel terakhir, Tab menambah baris baru. */
  goToCell(direction: 1 | -1): Command {
    return (state, dispatch) => {
      const info = findCell(state);
      if (!info) return false;
      const width = info.table.firstChild?.childCount ?? 1;
      let r = info.rowIndex;
      let c = info.colIndex + direction;
      if (c >= width) {
        r++;
        c = 0;
      } else if (c < 0) {
        r--;
        c = width - 1;
      }
      if (r < 0) return true;
      if (r >= info.table.childCount) return tableCommands.addRow('after')(state, dispatch);
      if (dispatch) {
        const pos = cellContentPos(info.table, info.tablePos, r, c);
        const cell = state.doc.nodeAt(pos - 1);
        const end = pos + (cell?.content.size ?? 0);
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos, end)));
      }
      return true;
    };
  },
};
