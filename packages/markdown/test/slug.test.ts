// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { headingSlugs, slugBase } from '../src';

describe('heading slugs', () => {
  it('follows GitHub anchors', () => {
    expect(slugBase('T1 — Schema database: comments dan mentions')).toBe(
      't1--schema-database-comments-dan-mentions',
    );
    expect(slugBase('FR-1: Menulis Komentar')).toBe('fr-1-menulis-komentar');
    expect(slugBase('API Endpoints')).toBe('api-endpoints');
    expect(slugBase('Request / Response Shape')).toBe('request--response-shape');
    expect(slugBase('snake_case & Ünïcode')).toBe('snake_case--ünïcode');
  });

  it('numbers duplicates in order', () => {
    expect(headingSlugs(['Tasks', 'Tasks', 'Tasks-1', 'Tasks'])).toEqual([
      'tasks',
      'tasks-1',
      'tasks-1-1',
      'tasks-2',
    ]);
  });
});
