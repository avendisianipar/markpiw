// SPDX-License-Identifier: LicenseRef-Proprietary
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rewriteTypeReexports } from '../vite-prosemirror';

const vendor = `${resolve(import.meta.dirname, '../../vendor/prosemirror')}/`;

describe('rewriteTypeReexports', () => {
  it('moves type-only names out of value re-exports (prosemirror-model)', () => {
    const file = `${vendor}prosemirror-model/src/index.ts`;
    const out = rewriteTypeReexports(readFileSync(file, 'utf8'), file);
    expect(out).toMatch(/export type \{[^}]*\bAttrs\b[^}]*\} from "\.\/schema"/);
    expect(out).not.toMatch(/export \{[^}]*\bAttrs\b[^}]*\} from "\.\/schema"/);
    expect(out).toMatch(/export \{[^}]*\bSchema\b[^}]*\} from "\.\/schema"/);
  });

  it('handles prosemirror-state and prosemirror-view type re-exports', () => {
    for (const [pkg, typeName] of [
      ['prosemirror-state', 'Command'],
      ['prosemirror-view', 'NodeView'],
    ] as const) {
      const file = `${vendor}${pkg}/src/index.ts`;
      const out = rewriteTypeReexports(readFileSync(file, 'utf8'), file);
      expect(out).toMatch(new RegExp(`export type \\{[^}]*\\b${typeName}\\b`));
    }
  });

  it('leaves value-only re-exports untouched', () => {
    const code = 'export {Schema} from "./schema"';
    expect(rewriteTypeReexports(code, `${vendor}prosemirror-model/src/index.ts`)).toBe(code);
  });
});
