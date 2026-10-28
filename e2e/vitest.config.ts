// SPDX-License-Identifier: LicenseRef-Proprietary
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
