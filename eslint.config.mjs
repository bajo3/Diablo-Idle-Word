import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['.agents/**', '**/coverage/**', '**/dist/**', '**/node_modules/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/web/*.ts'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['apps/server/**/*.ts', 'apps/server/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['*.{js,mjs,ts}', 'packages/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
