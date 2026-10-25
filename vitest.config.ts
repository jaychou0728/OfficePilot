import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@officepilot/shared': path.resolve('packages/shared/src/index.ts') },
  },
  test: {
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'apps/server/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 20000,
  },
});
