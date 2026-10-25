import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@officepilot/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'apps/server/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
