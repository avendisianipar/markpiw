// SPDX-License-Identifier: MIT
// Pemilih ukuran tabel: grid baris × kolom (baris pertama = header). Panah menggeser pilihan,
// Enter/klik menyisipkan.
import { type KeyboardEvent, type RefObject, useRef, useState } from 'react';
import { Dialog, Popover } from 'react-aria-components';
import { t } from './strings/id';

const MAX = 8;

export function TableSizePicker(props: {
  triggerRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (rows: number, cols: number) => void;
}) {
  const [size, setSize] = useState({ rows: 3, cols: 3 });
  const grid = useRef<HTMLDivElement>(null);

  const focusCell = (rows: number, cols: number) => {
    const r = Math.min(MAX, Math.max(2, rows));
    const c = Math.min(MAX, Math.max(1, cols));
    setSize({ rows: r, cols: c });
    grid.current?.querySelector<HTMLButtonElement>(`[data-rows="${r}"][data-cols="${c}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusCell(size.rows + move[0], size.cols + move[1]);
  };

  const pick = (rows: number, cols: number) => {
    props.onOpenChange(false);
    props.onPick(rows, cols);
  };

  return (
    <Popover
      className="mp-popover"
      placement="bottom start"
      triggerRef={props.triggerRef}
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
    >
      <Dialog className="mp-grid-picker" aria-label={t('toolbar.tableSize')}>
        <div className="mp-grid" ref={grid} onKeyDown={onKeyDown} role="grid">
          {Array.from({ length: MAX }, (_, r) => (
            <div key={r} role="row" className="mp-grid-row">
              {Array.from({ length: MAX }, (_, c) => {
                // Baris pertama selalu header; tabel minimal header + satu baris isi.
                const rows = Math.max(2, r + 1);
                const cols = c + 1;
                const on = r + 1 <= size.rows && cols <= size.cols;
                return (
                  <button
                    key={c}
                    type="button"
                    role="gridcell"
                    className="mp-grid-cell"
                    data-rows={r + 1}
                    data-cols={cols}
                    data-on={on ? '' : undefined}
                    data-header={r === 0 ? '' : undefined}
                    aria-label={`${rows} × ${cols}`}
                    tabIndex={r + 1 === size.rows && cols === size.cols ? 0 : -1}
                    autoFocus={r + 1 === 3 && cols === 3}
                    onMouseEnter={() => setSize({ rows, cols })}
                    onFocus={() => setSize({ rows, cols })}
                    onClick={() => pick(rows, cols)}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mp-grid-label" aria-live="polite">
          {size.rows} × {size.cols}
        </div>
      </Dialog>
    </Popover>
  );
}
