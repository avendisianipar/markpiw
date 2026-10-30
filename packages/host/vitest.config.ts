// SPDX-License-Identifier: MIT
import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'host',
    typecheck: { enabled: true, include: ['test/**/*.test.ts'] },
  },
});
