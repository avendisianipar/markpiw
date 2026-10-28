// SPDX-License-Identifier: LicenseRef-Proprietary
import { defineProject } from 'vitest/config';

export default defineProject({
  test: { name: 'tooling', include: ['test/**/*.test.ts'] },
});
