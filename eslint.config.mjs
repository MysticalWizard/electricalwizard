import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global Ignores
  {
    ignores: [
      '**/.*',
      '**/node_modules/**',
      '**/dist/**',
      '**/logs/**',
      '**/*.log',
      '**/pnpm-lock.yaml',
      '**/package-lock.json',
      '**/yarn.lock',
    ],
  },

  // Javascript Files
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Typescript Files
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,mts,cts}'],
    languageOptions: {
      globals: globals.node,
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
    },
  },

  // Prettier (must be last to override other formatting rules)
  prettierConfig,
];
