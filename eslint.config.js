// SPDX-License-Identifier: MIT
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
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
    // Suite test VS Code dijalankan extension host sebagai CommonJS.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.tsx'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['packages/ui/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: forbiddenPackages },
            {
              group: ['node:*', 'vscode', 'prosemirror-*'],
              message:
                'packages/ui hanya memakai @markpiw/editor (bukan ProseMirror/Node/VS Code langsung).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/editor/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: forbiddenPackages },
            {
              group: ['react', 'react-*', '@markpiw/ui', 'node:*', 'vscode'],
              message: 'packages/editor tidak boleh bergantung pada React, UI, Node, atau VS Code.',
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
