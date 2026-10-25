import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('openapi', () => {
  it('serves a valid openapi document with the main paths', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { LLM_PROVIDER: 'mock' } as NodeJS.ProcessEnv });
    const res = await app.inject({ method: 'GET', url: '/api/openapi.json' });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths['/api/health']).toBeTruthy();
    expect(spec.paths['/api/runs']).toBeTruthy();
    expect(spec.paths['/api/documents']).toBeTruthy();
    await app.close();
  });
});
