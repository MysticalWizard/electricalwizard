import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { importX } from 'eslint-plugin-import-x';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global Ignores
  {
    ignores: [
      '**/.*',
      '**/node_modules/**',
      '**/dist/**',
      // The dashboard has its own ESLint config and ESLint 9 install (Next's
      // plugins don't support ESLint 10 yet); `pnpm lint:all` lints it.
      'dashboard/**',
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
      'import-x': importX,
    },
    rules: {
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-duplicates': 'error',
    },
  },

  // Prettier (must be last to override other formatting rules)
  prettierConfig,
];
