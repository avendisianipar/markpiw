// SPDX-License-Identifier: LicenseRef-Proprietary
import { buildDoc } from './build';
import { toMdast } from './mdast';
import { detectProfile } from './profile';
import type { ParsedDoc } from './types';

/** Parse markdown GFM menjadi dokumen ProseMirror beserta indeks source dan profil gaya. */
export function parseMarkdown(text: string): ParsedDoc {
  const body = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const root = toMdast(body);
  const { doc, index } = buildDoc(body, root);
  return { doc, index, profile: detectProfile(text, root, index) };
}
