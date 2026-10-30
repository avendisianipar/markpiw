// SPDX-License-Identifier: MIT
import { describe, expectTypeOf, it } from 'vitest';
import type { FileHost, Result, TextChange, HostError } from '@markpiw/host';

describe('@markpiw/host types', () => {
  it('Result is a discriminated union', () => {
    const r = { ok: false, error: { code: 'io', message: 'x' } } as Result<string, HostError>;
    if (!r.ok) expectTypeOf(r.error.code).toEqualTypeOf<HostError['code']>();
  });
  it('TextChange has from/to/insert', () => {
    expectTypeOf<TextChange>().toEqualTypeOf<{ from: number; to: number; insert: string }>();
  });
  it('FileHost.historyMode is editor | host', () => {
    expectTypeOf<FileHost['historyMode']>().toEqualTypeOf<'editor' | 'host'>();
  });
});
