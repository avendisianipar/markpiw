// SPDX-License-Identifier: LicenseRef-Proprietary
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'web',
    environment: 'jsdom',
    setupFiles: ['../../packages/editor/test/setup.ts'],
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
