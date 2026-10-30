// SPDX-License-Identifier: MIT
// Toolbar (spesifikasi 5.2): React Aria Toolbar dengan roving focus; tombol toggle memakai
// aria-pressed; tooltip memuat shortcut.
import type { BlockTypeInfo, EditorSnapshot, ListKind, TableState } from '@markpiw/editor';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type Key, type ReactNode, useRef, useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
  ToggleButton,
  Toolbar as AriaToolbar,
} from 'react-aria-components';
import { useController, useEditorSnapshot } from './context';
import { TableSizePicker } from './TableSizePicker';
import { t } from './strings/id';

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const ALT = isMac ? '⌥' : 'Alt';

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

function tip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

function blockLabel(block: BlockTypeInfo): string {
  if (block.type === 'heading') return `${t('toolbar.heading')} ${block.level}`;
  if (block.type === 'code_block') return t('toolbar.codeBlock');
  return t('toolbar.paragraph');
}

const selectBlock = (s: EditorSnapshot) => s.blockType;
const selectList = (s: EditorSnapshot) => s.listKind;
const selectMarks = (s: EditorSnapshot) => s.activeMarks;
const selectQuote = (s: EditorSnapshot) => s.inQuote;
const selectTable = (s: EditorSnapshot) => s.table;
const selectUndo = (s: EditorSnapshot) => s.canUndo;
const selectRedo = (s: EditorSnapshot) => s.canRedo;
const selectZoom = (s: EditorSnapshot) => s.zoom;
const selectReadOnly = (s: EditorSnapshot) => s.readOnly !== null;

function ToolButton(props: {
  label: string;
  shortcut?: string;
  onPress: () => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      className="mp-tool"
      aria-label={props.label}
      onPress={props.onPress}
      isDisabled={props.isDisabled ?? false}
    >
      <span title={tip(props.label, props.shortcut)} className="mp-tool-inner">
        {props.children}
      </span>
    </Button>
  );
}

function ToolToggle(props: {
  label: string;
  shortcut?: string;
  isSelected: boolean;
  onChange: () => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <ToggleButton
      className="mp-tool"
      aria-label={props.label}
      isSelected={props.isSelected}
      onChange={props.onChange}
      isDisabled={props.isDisabled ?? false}
    >
      <span title={tip(props.label, props.shortcut)} className="mp-tool-inner">
        {props.children}
      </span>
    </ToggleButton>
  );
}

const CALLOUTS = ['note', 'tip', 'important', 'warning', 'caution'] as const;

/** Aksi tabel yang tidak berlaku di posisi kursor (di luar tabel: semua kecuali sisipkan). */
function tableDisabledKeys(table: TableState | null): string[] {
  if (!table)
    return [
      'rowBefore',
      'row',
      'colBefore',
      'col',
      'left',
      'center',
      'right',
      'rowDelete',
      'colDelete',
      'tableDelete',
    ];
  const keys: string[] = [];
  if (!table.canDeleteRow) keys.push('rowDelete');
  if (!table.canDeleteColumn) keys.push('colDelete');
  return keys;
}

export function Toolbar({ onPickImage }: { onPickImage: () => void }) {
  const controller = useController();
  const c = controller.commands;
  const block = useEditorSnapshot(selectBlock);
  const listKind = useEditorSnapshot(selectList);
  const marks = useEditorSnapshot(selectMarks);
  const inQuote = useEditorSnapshot(selectQuote);
  const table = useEditorSnapshot(selectTable);
  const inTable = table !== null;
  const canUndo = useEditorSnapshot(selectUndo);
  const canRedo = useEditorSnapshot(selectRedo);
  const zoom = useEditorSnapshot(selectZoom);
  const readOnly = useEditorSnapshot(selectReadOnly);
  const tableButton = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Sel tabel GFM hanya berisi teks satu baris: aksi blok tidak berlaku di dalamnya.
  const blockDisabled = readOnly || inTable;

  const list = (kind: ListKind) => () => c.wrapList(kind);
  const blockMenu = (key: Key) => {
    const value = String(key);
    if (value === 'paragraph') c.setBlock({ type: 'paragraph' });
    else if (value === 'code_block') c.setBlock({ type: 'code_block' });
    else c.setBlock({ type: 'heading', level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 });
  };
  const insertMenu = (key: Key) => {
    const value = String(key);
    if (value === 'mathInline') c.insertMathInline();
    else if (value === 'math') c.insertMathBlock();
    else if (value === 'mermaid') c.insertMermaid();
    else if ((CALLOUTS as readonly string[]).includes(value))
      c.insertCallout(value as (typeof CALLOUTS)[number]);
  };
  const tableMenu = (key: Key) => {
    switch (String(key)) {
      case 'insert':
        setPickerOpen(true);
        break;
      case 'rowBefore':
        c.tableAddRow('before');
        break;
      case 'row':
        c.tableAddRow('after');
        break;
      case 'colBefore':
        c.tableAddColumn('before');
        break;
      case 'col':
        c.tableAddColumn('after');
        break;
      case 'tableDelete':
        c.tableDelete();
        break;
      case 'rowDelete':
        c.tableDeleteRow();
        break;
      case 'colDelete':
        c.tableDeleteColumn();
        break;
      case 'left':
        c.tableSetAlign('left');
        break;
      case 'center':
        c.tableSetAlign('center');
        break;
      case 'right':
        c.tableSetAlign('right');
        break;
    }
  };

  return (
    <AriaToolbar aria-label={t('toolbar.label')} className="mp-toolbar">
      <div className="mp-tool-group">
        <ToolButton
          label={t('toolbar.undo')}
          shortcut={`${MOD}+Z`}
          onPress={() => c.undo()}
          isDisabled={!canUndo || readOnly}
        >
          <Undo2 {...ICON} />
        </ToolButton>
        <ToolButton
          label={t('toolbar.redo')}
          shortcut={`${MOD}+Shift+Z`}
          onPress={() => c.redo()}
          isDisabled={!canRedo || readOnly}
        >
          <Redo2 {...ICON} />
        </ToolButton>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <ToolButton label={t('toolbar.zoomOut')} onPress={() => c.setZoom(zoom - 10)}>
          <ZoomOut {...ICON} />
        </ToolButton>
        <Button
          className="mp-tool mp-zoom"
          aria-label={t('toolbar.zoomReset')}
          onPress={() => c.setZoom(100)}
        >
          {zoom}%
        </Button>
        <ToolButton label={t('toolbar.zoomIn')} onPress={() => c.setZoom(zoom + 10)}>
          <ZoomIn {...ICON} />
        </ToolButton>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <MenuTrigger>
        <Button
          className="mp-tool mp-tool-menu"
          aria-label={t('toolbar.block')}
          isDisabled={blockDisabled}
        >
          {blockLabel(block)} <ChevronDown {...ICON} size={14} />
        </Button>
        <Popover className="mp-popover" placement="bottom start">
          <Menu className="mp-menu" onAction={blockMenu} aria-label={t('toolbar.block')}>
            <MenuItem id="paragraph" className="mp-menu-item">
              {t('toolbar.paragraph')}
            </MenuItem>
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <MenuItem key={level} id={`h${level}`} className={`mp-menu-item mp-menu-h${level}`}>
                {t('toolbar.heading')} {level}
                <kbd>
                  {MOD}+{ALT}+{level}
                </kbd>
              </MenuItem>
            ))}
            <MenuItem id="code_block" className="mp-menu-item">
              {t('toolbar.codeBlock')}
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <ToolToggle
          label={t('toolbar.bullet')}
          shortcut={`${MOD}+Shift+8`}
          isSelected={listKind === 'bullet'}
          onChange={list('bullet')}
          isDisabled={blockDisabled}
        >
          <List {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.ordered')}
          shortcut={`${MOD}+Shift+7`}
          isSelected={listKind === 'ordered'}
          onChange={list('ordered')}
          isDisabled={blockDisabled}
        >
          <ListOrdered {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.task')}
          shortcut={`${MOD}+Shift+9`}
          isSelected={listKind === 'task'}
          onChange={list('task')}
          isDisabled={blockDisabled}
        >
          <ListChecks {...ICON} />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <ToolToggle
          label={t('toolbar.bold')}
          shortcut={`${MOD}+B`}
          isSelected={marks.has('strong')}
          onChange={() => c.toggleMark('strong')}
          isDisabled={readOnly}
        >
          <Bold {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.italic')}
          shortcut={`${MOD}+I`}
          isSelected={marks.has('em')}
          onChange={() => c.toggleMark('em')}
          isDisabled={readOnly}
        >
          <Italic {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.strike')}
          shortcut={`${MOD}+Shift+X`}
          isSelected={marks.has('strike')}
          onChange={() => c.toggleMark('strike')}
          isDisabled={readOnly}
        >
          <Strikethrough {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.code')}
          shortcut={`${MOD}+E`}
          isSelected={marks.has('code')}
          onChange={() => c.toggleMark('code')}
          isDisabled={readOnly}
        >
          <Code {...ICON} />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <ToolToggle
          label={t('toolbar.link')}
          shortcut={`${MOD}+K`}
          isSelected={marks.has('link')}
          onChange={() => controller.openLinkEditor()}
          isDisabled={readOnly}
        >
          <Link {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.quote')}
          isSelected={inQuote}
          onChange={() => c.toggleQuote()}
          isDisabled={blockDisabled}
        >
          <Quote {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.codeBlock')}
          isSelected={block.type === 'code_block'}
          onChange={() =>
            c.setBlock(block.type === 'code_block' ? { type: 'paragraph' } : { type: 'code_block' })
          }
          isDisabled={blockDisabled}
        >
          <SquareCode {...ICON} />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <MenuTrigger>
          <Button
            ref={tableButton}
            className="mp-tool"
            aria-label={t('toolbar.table')}
            isDisabled={readOnly}
          >
            <span title={t('toolbar.table')} className="mp-tool-inner">
              <Table {...ICON} />
              <ChevronDown {...ICON} size={12} />
            </span>
          </Button>
          <Popover className="mp-popover" placement="bottom start">
            <Menu
              className="mp-menu"
              onAction={tableMenu}
              aria-label={t('toolbar.table')}
              disabledKeys={tableDisabledKeys(table)}
            >
              <MenuItem id="insert" className="mp-menu-item">
                {t('toolbar.tableInsert')}
              </MenuItem>
              <Separator className="mp-menu-sep" />
              <MenuItem id="rowBefore" className="mp-menu-item">
                {t('toolbar.tableRowBefore')}
              </MenuItem>
              <MenuItem id="row" className="mp-menu-item">
                {t('toolbar.tableRowAfter')}
              </MenuItem>
              <MenuItem id="colBefore" className="mp-menu-item">
                {t('toolbar.tableColBefore')}
              </MenuItem>
              <MenuItem id="col" className="mp-menu-item">
                {t('toolbar.tableColAfter')}
              </MenuItem>
              <Separator className="mp-menu-sep" />
              {(
                [
                  ['left', AlignLeft, 'toolbar.alignLeft'],
                  ['center', AlignCenter, 'toolbar.alignCenter'],
                  ['right', AlignRight, 'toolbar.alignRight'],
                ] as const
              ).map(([id, Icon, label]) => (
                <MenuItem
                  key={id}
                  id={id}
                  className="mp-menu-item mp-menu-item-icon"
                  data-active={table?.align === id ? '' : undefined}
                >
                  <Icon {...ICON} /> {t(label)}
                </MenuItem>
              ))}
              <Separator className="mp-menu-sep" />
              <MenuItem id="rowDelete" className="mp-menu-item">
                {t('toolbar.tableRowDelete')}
              </MenuItem>
              <MenuItem id="colDelete" className="mp-menu-item">
                {t('toolbar.tableColDelete')}
              </MenuItem>
              <MenuItem id="tableDelete" className="mp-menu-item mp-menu-danger">
                {t('toolbar.tableDelete')}
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <TableSizePicker
          triggerRef={tableButton}
          isOpen={pickerOpen}
          onOpenChange={setPickerOpen}
          onPick={(rows, cols) => c.insertTable(rows, cols)}
        />
        <ToolButton label={t('toolbar.image')} onPress={onPickImage} isDisabled={readOnly}>
          <Image {...ICON} />
        </ToolButton>
        <ToolButton
          label={t('toolbar.hr')}
          onPress={() => c.insertHorizontalRule()}
          isDisabled={readOnly}
        >
          <Minus {...ICON} />
        </ToolButton>
        <MenuTrigger>
          <Button className="mp-tool" aria-label={t('toolbar.insert')} isDisabled={readOnly}>
            <span title={t('toolbar.insert')} className="mp-tool-inner">
              <Plus {...ICON} />
              <ChevronDown {...ICON} size={12} />
            </span>
          </Button>
          <Popover className="mp-popover" placement="bottom end">
            <Menu
              className="mp-menu"
              onAction={insertMenu}
              aria-label={t('toolbar.insert')}
              disabledKeys={inTable ? ['math', 'mermaid', ...CALLOUTS] : []}
            >
              <MenuItem id="mathInline" className="mp-menu-item">
                {t('toolbar.mathInline')}
              </MenuItem>
              <MenuItem id="math" className="mp-menu-item">
                {t('toolbar.mathBlock')}
              </MenuItem>
              <MenuItem id="mermaid" className="mp-menu-item">
                {t('toolbar.mermaid')}
              </MenuItem>
              <Separator className="mp-menu-sep" />
              {CALLOUTS.map((type) => (
                <MenuItem key={type} id={type} className="mp-menu-item">
                  {t(`toolbar.callout.${type}`)}
                </MenuItem>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </AriaToolbar>
  );
}
