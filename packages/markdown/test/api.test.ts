// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import * as api from '../src';

describe('public API', () => {
  it('exports exactly the documented runtime symbols', () => {
    expect(Object.keys(api).sort()).toEqual([
      'diffText',
      'parseMarkdown',
      'schema',
      'serializeMarkdown',
      'verifyRoundTrip',
    ]);
  });
});
