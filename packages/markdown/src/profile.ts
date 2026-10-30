// SPDX-License-Identifier: MIT
// Deteksi profil gaya file (spesifikasi 3.5): nilai terbanyak, default jika seri atau tanpa contoh.
import type { Nodes, Root } from 'mdast';
import type { MutableSourceIndex } from './source-index';
import type { Profile } from './types';

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

class Tally<T> {
  private readonly counts = new Map<T, number>();

  add(value: T): void {
    this.counts.set(value, (this.counts.get(value) ?? 0) + 1);
  }

  /** Nilai terbanyak yang lolos `accept`; `fallback` jika seri atau tidak ada contoh. */
  winner<U extends T>(accept: (value: T) => value is U, fallback: U): U {
    let best: U | null = null;
    let bestCount = 0;
    let tie = false;
    for (const [value, count] of this.counts) {
      if (!accept(value)) continue;
      if (count > bestCount) {
        best = value;
        bestCount = count;
        tie = false;
      } else if (count === bestCount) {
        tie = true;
      }
    }
    return best === null || tie ? fallback : best;
  }
}

const oneOf =
  <U extends string>(...values: U[]) =>
  (value: string): value is U =>
    (values as string[]).includes(value);

function walk(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node);
  if ('children' in node) for (const child of node.children) walk(child, visit);
}

function mostCommonIndent(indents: Tally<number>): Profile['listIndent'] {
  const width = indents.winner((n): n is number => Number.isInteger(n), -1);
  return width === -1 ? 'marker+1' : width;
}

export function detectProfile(text: string, root: Root, index: MutableSourceIndex): Profile {
  const bom = text.startsWith('\uFEFF');
  const body = bom ? text.slice(1) : text;
  const at = (node: Nodes, length = 1) => {
    const offset = node.position?.start.offset ?? 0;
    return body.slice(offset, offset + length);
  };

  const bullets = new Tally<string>();
  const ems = new Tally<string>();
  const strongs = new Tally<string>();
  const fences = new Tally<string>();
  let setext = 0;
  let atx = 0;
  let orderedLists = 0;
  let uniformOrdered = 0;

  walk(root, (node) => {
    switch (node.type) {
      case 'list':
        if (node.ordered) {
          if (node.children.length >= 2) {
            orderedLists++;
            const numbers = node.children.map((item) => /^\d+/.exec(at(item, 10))?.[0]);
            if (numbers.every((n) => n === numbers[0])) uniformOrdered++;
          }
        } else {
          for (const item of node.children) bullets.add(at(item));
        }
        break;
      case 'emphasis':
        ems.add(at(node));
        break;
      case 'strong':
        strongs.add(at(node, 2));
        break;
      case 'code': {
        const ch = at(node);
        if (ch === '`') fences.add('```');
        else if (ch === '~') fences.add('~~~');
        break;
      }
      case 'heading':
        if (at(node) === '#') atx++;
        else setext++;
        break;
    }
  });

  const indents = new Tally<number>();
  let markerPlusOne = 0;
  let items = 0;
  let tables = 0;
  let aligned = 0;
  for (const entry of index.entries()) {
    if (entry.node.type.name === 'list_item' && entry.contribution) {
      const marker = /^(\d+[.)]|[-*+])/.exec(entry.contribution.first)?.[0] ?? '';
      const width = entry.contribution.rest.length;
      items++;
      if (width === marker.length + 1) markerPlusOne++;
      indents.add(width);
    } else if (entry.node.type.name === 'table') {
      tables++;
      if (entry.tableAligned) aligned++;
    }
  }

  const crlf = body.split('\r\n').length - 1;
  const lf = body.split('\n').length - 1 - crlf;

  return {
    bulletMarker: bullets.winner(oneOf('-', '*', '+'), DEFAULT_PROFILE.bulletMarker),
    emDelim: ems.winner(oneOf('*', '_'), DEFAULT_PROFILE.emDelim),
    strongDelim: strongs.winner(oneOf('**', '__'), DEFAULT_PROFILE.strongDelim),
    fence: fences.winner(oneOf('```', '~~~'), DEFAULT_PROFILE.fence),
    headingStyle: setext > atx ? 'setext' : 'atx',
    listIndent: items === 0 || markerPlusOne * 2 > items ? 'marker+1' : mostCommonIndent(indents),
    orderedNumbering: orderedLists > 0 && uniformOrdered === orderedLists ? 'same' : 'increment',
    tablePadding: tables > 0 && aligned * 2 > tables ? 'aligned' : 'compact',
    eol: crlf > lf ? '\r\n' : '\n',
    finalNewline: text === '' || text.endsWith('\n'),
    bom,
  };
}
