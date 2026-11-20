import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Every source file counts, including ones no test loads, so the numbers are not flattered.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/db/create-test-db.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
