// SPDX-License-Identifier: LicenseRef-Proprietary
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['tooling', 'vendor/prosemirror', 'packages/*', 'apps/*'],
  },
});
