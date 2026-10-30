// SPDX-License-Identifier: MIT
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'editor',
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
