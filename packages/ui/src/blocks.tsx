// SPDX-License-Identifier: MIT
// Katalog item blok bersama slash menu dan toolbar: label, ikon, kelompok, sintaks markdown, dan
// shortcut berasal dari satu tempat sehingga keduanya selalu identik.
import type { SlashGroupId, SlashItemId } from '@markpiw/editor';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  Info,
  Lightbulb,
  Link,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  MessageSquareWarning,
  Minus,
  OctagonAlert,
  Pilcrow,
  Radical,
  Sigma,
  SquareCode,
  Table,
  TextQuote,
  TriangleAlert,
  Workflow,
} from 'lucide-react';
import { editorStrings, t } from './strings/id';

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);
export const MOD = isMac ? '⌘' : 'Ctrl';
export const ALT = isMac ? '⌥' : 'Alt';

export const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

export const BLOCK_ICON: Readonly<Record<SlashItemId, LucideIcon>> = {
  text: Pilcrow,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  bullet: List,
  ordered: ListOrdered,
  task: ListChecks,
  quote: TextQuote,
  code: SquareCode,
  table: Table,
  image: Image,
  hr: Minus,
  link: Link,
  note: Info,
  tip: Lightbulb,
  important: MessageSquareWarning,
  warning: TriangleAlert,
  caution: OctagonAlert,
  math: Sigma,
  mathInline: Radical,
  mermaid: Workflow,
};

/** Sintaks markdown yang langsung diubah editor saat diketik (input rule). */
const BLOCK_SYNTAX: Partial<Record<SlashItemId, string>> = {
  h1: '#',
  h2: '##',
  h3: '###',
  h4: '####',
  h5: '#####',
  h6: '######',
  bullet: '-',
  ordered: '1.',
  task: '[ ]',
  quote: '>',
  mathInline: '$…$',
};

export const BLOCK_SHORTCUT: Partial<Record<SlashItemId, string>> = {
  text: `${MOD}+${ALT}+0`,
  h1: `${MOD}+${ALT}+1`,
  h2: `${MOD}+${ALT}+2`,
  h3: `${MOD}+${ALT}+3`,
  h4: `${MOD}+${ALT}+4`,
  h5: `${MOD}+${ALT}+5`,
  h6: `${MOD}+${ALT}+6`,
  bullet: `${MOD}+Shift+8`,
  ordered: `${MOD}+Shift+7`,
  task: `${MOD}+Shift+9`,
  link: `${MOD}+K`,
};

const CALLOUT_IDS: readonly SlashItemId[] = ['note', 'tip', 'important', 'warning', 'caution'];

export function blockLabel(id: SlashItemId): string {
  return editorStrings.slash[id].label;
}

export function groupLabel(id: SlashGroupId): string {
  return t(`block.group.${id}`);
}

export function tip(label: string, shortcut?: string): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

/** Ikon blok; callout diberi warna jenisnya seperti kotak callout di dokumen. */
export function BlockIcon({ id }: { id: SlashItemId }) {
  const Icon = BLOCK_ICON[id];
  const callout = CALLOUT_IDS.includes(id);
  return (
    <Icon {...ICON} className={callout ? `mp-block-icon mp-callout-${id}` : 'mp-block-icon'} />
  );
}

/** Isi baris menu: ikon, label, lalu sintaks markdown di kanan. */
export function BlockRow({ id }: { id: SlashItemId }) {
  const syntax = BLOCK_SYNTAX[id];
  return (
    <>
      <BlockIcon id={id} />
      <span className="mp-block-label">{blockLabel(id)}</span>
      {syntax && <kbd className="mp-block-syntax">{syntax}</kbd>}
    </>
  );
}
