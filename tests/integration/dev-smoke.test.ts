import { describe, it, expect } from 'vitest';
import { buildApp } from '../../apps/server/src/app.js';

describe('dev smoke', () => {
  it('serves health and 404s unknown API', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { DEMO_MODE: 'false' } as NodeJS.ProcessEnv });
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.statusCode).toBe(200);
    const missing = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
