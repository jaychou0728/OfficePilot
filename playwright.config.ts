import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run demo:seed && npm -w apps/server run dev',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      // Vite 7 binds to ::1 by default on this host; force 127.0.0.1 so the
      // baseURL and the health probe below both resolve.
      command: 'npm -w apps/web run dev -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
