// SPDX-License-Identifier: MIT
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mathFromMarkdown } from 'mdast-util-math';
import { frontmatter } from 'micromark-extension-frontmatter';
import { gfm } from 'micromark-extension-gfm';
import { math } from 'micromark-extension-math';

/**
 * Parse teks (tanpa BOM) menjadi mdast dengan ekstensi GFM, frontmatter YAML, dan math
 * (`$…$`, `$$…$$`; sintaks yang juga dirender GitHub).
 */
export function toMdast(text: string): Root {
  return fromMarkdown(text, {
    extensions: [gfm(), frontmatter(['yaml']), math()],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(['yaml']), mathFromMarkdown()],
  });
}
