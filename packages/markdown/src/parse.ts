// SPDX-License-Identifier: LicenseRef-Proprietary
import { buildDoc } from './build';
import { toMdast } from './mdast';
import type { ParsedDoc, Profile, SourceIndex } from './types';

export const DEFAULT_PROFILE: Readonly<Profile> = {
  bulletMarker: '-',
  emDelim: '*',
  strongDelim: '**',
  fence: '```',
  headingStyle: 'atx',
  listIndent: 'marker+1',
  orderedNumbering: 'increment',
  tablePadding: 'compact',
  eol: '\n',
  finalNewline: true,
  bom: false,
};

const EMPTY_INDEX: SourceIndex = { get: () => undefined, leading: '', trailing: '', size: 0 };

/** Parse markdown GFM menjadi dokumen ProseMirror beserta indeks source dan profil gaya. */
export function parseMarkdown(text: string): ParsedDoc {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  const doc = buildDoc(body, toMdast(body));
  return { doc, index: EMPTY_INDEX, profile: { ...DEFAULT_PROFILE } };
}
