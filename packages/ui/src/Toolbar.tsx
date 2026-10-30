// SPDX-License-Identifier: MIT
// Toolbar (spesifikasi 5.2): React Aria Toolbar dengan roving focus; tombol toggle memakai
// aria-pressed; tooltip memuat shortcut. Urutan: riwayat, jenis blok, format inline, list, blok,
// sisipkan. Ikon dan label item blok sama dengan slash menu (lihat blocks.tsx).
import {
  type BlockTypeInfo,
  type EditorSnapshot,
  type ListKind,
  SLASH_GROUPS,
  type SlashItemId,
  type TableState,
} from '@markpiw/editor';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Italic,
  Plus,
  Redo2,
  Strikethrough,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { type Key, type ReactNode, useRef, useState } from 'react';
import {
  Button,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  ToggleButton,
  Toolbar as AriaToolbar,
} from 'react-aria-components';
import {
  BLOCK_SHORTCUT,
  BlockIcon,
  BlockRow,
  blockLabel,
  groupLabel,
  ICON,
  MOD,
  tip,
} from './blocks';
import { useController, useEditorSnapshot } from './context';
import { TableSizePicker } from './TableSizePicker';
import { t } from './strings/id';

/** Item blok yang mewakili jenis blok kursor saat ini (untuk label dropdown). */
function currentBlock(block: BlockTypeInfo): SlashItemId {
  if (block.type === 'heading') return `h${block.level}`;
  if (block.type === 'code_block') return 'code';
  return 'text';
}

const groupItems = (id: (typeof SLASH_GROUPS)[number]['id']) =>
  SLASH_GROUPS.find((group) => group.id === id)?.items ?? [];

/** Dropdown jenis blok: kelompok "Teks & heading" ditambah code block. */
const BLOCK_TYPES: readonly SlashItemId[] = [...groupItems('text'), 'code'];
/** Menu "Sisipkan lainnya": kelompok yang tidak punya tombol sendiri di toolbar. */
const MORE_GROUPS = SLASH_GROUPS.filter((g) => g.id === 'callout' || g.id === 'advanced');

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
  shortcut?: string | undefined;
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
  shortcut?: string | undefined;
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
  const readOnly = useEditorSnapshot(selectReadOnly);
  const tableButton = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Sel tabel GFM hanya berisi teks satu baris: aksi blok tidak berlaku di dalamnya.
  const blockDisabled = readOnly || inTable;
  const current = currentBlock(block);

  const list = (kind: ListKind) => () => c.wrapList(kind);
  // Item menu blok menjalankan aksi yang sama persis dengan slash menu.
  const runBlock = (key: Key) => controller.runSlashItem(String(key) as SlashItemId);
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
  const listToggle = (kind: ListKind) => (
    <ToolToggle
      label={blockLabel(kind)}
      shortcut={BLOCK_SHORTCUT[kind]}
      isSelected={listKind === kind}
      onChange={list(kind)}
      isDisabled={blockDisabled}
    >
      <BlockIcon id={kind} />
    </ToolToggle>
  );

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
      <MenuTrigger>
        <Button
          className="mp-tool mp-tool-menu"
          aria-label={t('toolbar.block')}
          isDisabled={blockDisabled}
        >
          <span title={t('toolbar.block')} className="mp-tool-inner mp-tool-menu-inner">
            <BlockIcon id={current} />
            <span className="mp-tool-menu-label">{blockLabel(current)}</span>
          </span>
          <ChevronDown {...ICON} size={14} />
        </Button>
        <Popover className="mp-popover" placement="bottom start">
          <Menu className="mp-menu" onAction={runBlock} aria-label={t('toolbar.block')}>
            {BLOCK_TYPES.map((id) => (
              <MenuItem
                key={id}
                id={id}
                textValue={blockLabel(id)}
                className="mp-menu-item mp-menu-block"
                data-active={id === current ? '' : undefined}
              >
                <span title={tip(blockLabel(id), BLOCK_SHORTCUT[id])} className="mp-block-row">
                  <BlockRow id={id} />
                </span>
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
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
        <ToolToggle
          label={blockLabel('link')}
          shortcut={BLOCK_SHORTCUT.link}
          isSelected={marks.has('link')}
          onChange={() => controller.openLinkEditor()}
          isDisabled={readOnly}
        >
          <BlockIcon id="link" />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        {listToggle('bullet')}
        {listToggle('ordered')}
        {listToggle('task')}
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <ToolToggle
          label={blockLabel('quote')}
          isSelected={inQuote}
          onChange={() => c.toggleQuote()}
          isDisabled={blockDisabled}
        >
          <BlockIcon id="quote" />
        </ToolToggle>
        <ToolToggle
          label={blockLabel('code')}
          isSelected={block.type === 'code_block'}
          onChange={() =>
            c.setBlock(block.type === 'code_block' ? { type: 'paragraph' } : { type: 'code_block' })
          }
          isDisabled={blockDisabled}
        >
          <BlockIcon id="code" />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <MenuTrigger>
          <Button
            ref={tableButton}
            className="mp-tool"
            aria-label={blockLabel('table')}
            isDisabled={readOnly}
          >
            <span title={blockLabel('table')} className="mp-tool-inner">
              <BlockIcon id="table" />
              <ChevronDown {...ICON} size={12} />
            </span>
          </Button>
          <Popover className="mp-popover" placement="bottom start">
            <Menu
              className="mp-menu"
              onAction={tableMenu}
              aria-label={blockLabel('table')}
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
        <ToolButton label={blockLabel('image')} onPress={onPickImage} isDisabled={readOnly}>
          <BlockIcon id="image" />
        </ToolButton>
        <ToolButton
          label={blockLabel('hr')}
          onPress={() => c.insertHorizontalRule()}
          isDisabled={readOnly}
        >
          <BlockIcon id="hr" />
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
              onAction={runBlock}
              aria-label={t('toolbar.insert')}
              disabledKeys={inTable ? ['math', 'mermaid', ...groupItems('callout')] : []}
            >
              {MORE_GROUPS.map((group) => (
                <MenuSection key={group.id} id={group.id} className="mp-menu-section">
                  <Header className="mp-menu-header">{groupLabel(group.id)}</Header>
                  {group.items.map((id) => (
                    <MenuItem
                      key={id}
                      id={id}
                      textValue={blockLabel(id)}
                      className="mp-menu-item mp-menu-block"
                    >
                      <BlockRow id={id} />
                    </MenuItem>
                  ))}
                </MenuSection>
              ))}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </AriaToolbar>
  );
}

/** Zoom adalah pengaturan tampilan, bukan format: ditempatkan di kanan topbar dekat toggle tema. */
export function ZoomControls() {
  const controller = useController();
  const zoom = useEditorSnapshot(selectZoom);
  const c = controller.commands;
  return (
    <div role="group" aria-label={t('toolbar.zoom')} className="mp-tool-group">
      <ToolButton label={t('toolbar.zoomOut')} onPress={() => c.setZoom(zoom - 10)}>
        <ZoomOut {...ICON} />
      </ToolButton>
      <Button
        className="mp-tool mp-zoom"
        aria-label={t('toolbar.zoomReset')}
        onPress={() => c.setZoom(100)}
      >
        <span title={t('toolbar.zoomReset')}>{zoom}%</span>
      </Button>
      <ToolButton label={t('toolbar.zoomIn')} onPress={() => c.setZoom(zoom + 10)}>
        <ZoomIn {...ICON} />
      </ToolButton>
    </div>
  );
}
