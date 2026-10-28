// SPDX-License-Identifier: LicenseRef-Proprietary
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'ui',
    environment: 'jsdom',
    setupFiles: ['../editor/test/setup.ts', './test/setup.ts'],
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
