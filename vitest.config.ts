import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: ['apps/**/src/**/*.test.{ts,tsx}', 'packages/**/src/**/*.test.{ts,tsx}'],
    exclude: ['apps/**/*.integration.test.ts', '**/node_modules/**'],
    passWithNoTests: false,
    reporters: ['default'],
  },
});
