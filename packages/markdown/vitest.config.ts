// SPDX-License-Identifier: MIT
import { defineProject } from 'vitest/config';
import { prosemirrorAliases } from '../../tooling/vendor-aliases.ts';

export default defineProject({
  resolve: { alias: prosemirrorAliases },
  test: {
    name: 'markdown',
    server: { deps: { inline: [/prosemirror-/] } },
  },
});
