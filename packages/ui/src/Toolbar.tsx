// SPDX-License-Identifier: LicenseRef-Proprietary
// Toolbar (spesifikasi 5.2): React Aria Toolbar dengan roving focus; tombol toggle memakai
// aria-pressed; tooltip memuat shortcut.
import type { BlockTypeInfo, EditorSnapshot, ListKind } from '@markpiw/editor';
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
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Key, ReactNode } from 'react';
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
const selectTable = (s: EditorSnapshot) => s.inTable;
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

export function Toolbar({ onPickImage }: { onPickImage: () => void }) {
  const controller = useController();
  const c = controller.commands;
  const block = useEditorSnapshot(selectBlock);
  const listKind = useEditorSnapshot(selectList);
  const marks = useEditorSnapshot(selectMarks);
  const inQuote = useEditorSnapshot(selectQuote);
  const inTable = useEditorSnapshot(selectTable);
  const canUndo = useEditorSnapshot(selectUndo);
  const canRedo = useEditorSnapshot(selectRedo);
  const zoom = useEditorSnapshot(selectZoom);
  const readOnly = useEditorSnapshot(selectReadOnly);

  const list = (kind: ListKind) => () => c.wrapList(kind);
  const blockMenu = (key: Key) => {
    const value = String(key);
    if (value === 'paragraph') c.setBlock({ type: 'paragraph' });
    else if (value === 'code_block') c.setBlock({ type: 'code_block' });
    else c.setBlock({ type: 'heading', level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 });
  };
  const tableMenu = (key: Key) => {
    switch (String(key)) {
      case 'insert':
        c.insertTable(3, 3);
        break;
      case 'row':
        c.tableAddRow('after');
        break;
      case 'col':
        c.tableAddColumn('after');
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
          isDisabled={readOnly}
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
          isDisabled={readOnly}
        >
          <List {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.ordered')}
          shortcut={`${MOD}+Shift+7`}
          isSelected={listKind === 'ordered'}
          onChange={list('ordered')}
          isDisabled={readOnly}
        >
          <ListOrdered {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.task')}
          shortcut={`${MOD}+Shift+9`}
          isSelected={listKind === 'task'}
          onChange={list('task')}
          isDisabled={readOnly}
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
          isDisabled={readOnly}
        >
          <Quote {...ICON} />
        </ToolToggle>
        <ToolToggle
          label={t('toolbar.codeBlock')}
          isSelected={block.type === 'code_block'}
          onChange={() =>
            c.setBlock(block.type === 'code_block' ? { type: 'paragraph' } : { type: 'code_block' })
          }
          isDisabled={readOnly}
        >
          <SquareCode {...ICON} />
        </ToolToggle>
      </div>
      <Separator orientation="vertical" className="mp-tool-sep" />
      <div className="mp-tool-group">
        <MenuTrigger>
          <Button className="mp-tool" aria-label={t('toolbar.table')} isDisabled={readOnly}>
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
              disabledKeys={
                inTable ? [] : ['row', 'col', 'rowDelete', 'colDelete', 'left', 'center', 'right']
              }
            >
              <MenuItem id="insert" className="mp-menu-item">
                {t('toolbar.tableInsert')}
              </MenuItem>
              <MenuItem id="row" className="mp-menu-item">
                {t('toolbar.tableRowAfter')}
              </MenuItem>
              <MenuItem id="col" className="mp-menu-item">
                {t('toolbar.tableColAfter')}
              </MenuItem>
              <MenuItem id="rowDelete" className="mp-menu-item">
                {t('toolbar.tableRowDelete')}
              </MenuItem>
              <MenuItem id="colDelete" className="mp-menu-item">
                {t('toolbar.tableColDelete')}
              </MenuItem>
              <MenuItem id="left" className="mp-menu-item">
                <AlignLeft {...ICON} /> {t('toolbar.alignLeft')}
              </MenuItem>
              <MenuItem id="center" className="mp-menu-item">
                <AlignCenter {...ICON} /> {t('toolbar.alignCenter')}
              </MenuItem>
              <MenuItem id="right" className="mp-menu-item">
                <AlignRight {...ICON} /> {t('toolbar.alignRight')}
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
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
      </div>
    </AriaToolbar>
  );
}
