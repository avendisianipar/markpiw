// SPDX-License-Identifier: MIT
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'vscode',
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
    setupFiles: ['../../packages/editor/test/setup.ts'],
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
