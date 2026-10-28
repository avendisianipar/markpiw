// SPDX-License-Identifier: LicenseRef-Proprietary
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const forbiddenPackages = [
  '@tiptap/*',
  'tiptap*',
  'ckeditor*',
  '@ckeditor/*',
  '@blocknote/*',
  'lexical',
  '@lexical/*',
  'slate*',
  'quill*',
  '@milkdown/*',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.types/**',
      'vendor/prosemirror/prosemirror-*/**',
      'fixtures/**',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: forbiddenPackages }] }],
    },
  },
  {
    files: ['packages/host/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*'],
              message: '@markpiw/host hanya berisi tipe dan tidak mengimpor apa pun.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/markdown/src/**/*.ts'],
    languageOptions: {
      globals: {},
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex:
                '^(?!@markpiw/host$|prosemirror-model$|prosemirror-transform$|mdast|micromark|\\.{1,2}/).*',
              message:
                'packages/markdown/src hanya boleh mengimpor @markpiw/host, prosemirror-model, prosemirror-transform, mdast*, micromark*, dan modul relatif.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        'document',
        'window',
        'navigator',
        'localStorage',
        'DOMParser',
      ],
    },
  },
);
