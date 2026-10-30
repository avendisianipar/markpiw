// SPDX-License-Identifier: MIT
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['tooling', 'vendor/prosemirror', 'packages/*', 'apps/*'],
  },
});
