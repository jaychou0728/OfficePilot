import { describe, it, expect } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';

describe('dev smoke', () => {
  it('serves health and 404s unknown API', async () => {
    const app = buildApp({ env: { DEMO_MODE: 'false' } as NodeJS.ProcessEnv });
    try {
      const health = await app.inject({ method: 'GET', url: '/api/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toMatchObject({ status: 'ok', db: 'ok' });
      const missing = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(missing.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
