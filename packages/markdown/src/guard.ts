// SPDX-License-Identifier: LicenseRef-Proprietary
// Guard round-trip (spesifikasi 3.6): output serializer harus di-parse kembali menjadi dokumen
// yang setara secara semantik dengan dokumen editor.
import type { Result } from '@markpiw/host';
import type { Node } from 'prosemirror-model';
import { normalizeForCompare } from './normalize';
import { parseMarkdown } from './parse';
import type { GuardFailure } from './types';

const LIMIT = 500;

interface Norm {
  content?: unknown[];
}

const show = (value: unknown) => (JSON.stringify(value) ?? 'undefined').slice(0, LIMIT);

/** Path (indeks anak dari root) ke perbedaan pertama, atau `null` jika setara. */
function firstDifference(expected: unknown, actual: unknown, path: number[]): GuardFailure | null {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return null;
  const e = expected as Norm | undefined;
  const a = actual as Norm | undefined;
  const { content: ec, ...eBase } = e ?? {};
  const { content: ac, ...aBase } = a ?? {};
  if (ec && ac && JSON.stringify(eBase) === JSON.stringify(aBase)) {
    const n = Math.max(ec.length, ac.length);
    for (let i = 0; i < n; i++) {
      const diff = firstDifference(ec[i], ac[i], [...path, i]);
      if (diff) return diff;
    }
  }
  return { path, expected: show(expected), actual: show(actual) };
}

/** Parse `output` lalu bandingkan semantiknya dengan `doc`. */
export function verifyRoundTrip(output: string, doc: Node): Result<void, GuardFailure> {
  const reparsed = parseMarkdown(output).doc;
  const failure = firstDifference(normalizeForCompare(doc), normalizeForCompare(reparsed), []);
  return failure ? { ok: false, error: failure } : { ok: true, value: undefined };
}
