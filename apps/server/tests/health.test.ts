import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns ok without model keys', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { DEMO_MODE: 'false' } as NodeJS.ProcessEnv });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.db).toBe('ok');
    expect(body.demoMode).toBe(false);
    expect(Array.isArray(body.providers)).toBe(true);
    await app.close();
  });
});
