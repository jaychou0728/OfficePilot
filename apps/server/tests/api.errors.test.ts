import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('api error envelope', () => {
  it('maps AppError to HTTP status and error code', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { LLM_PROVIDER: 'mock' } as NodeJS.ProcessEnv });
    const res = await app.inject({ method: 'DELETE', url: '/api/documents/missing' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expect(res.json().error.requestId).toBeTruthy();
    await app.close();
  });

  it('returns 400 for an invalid run request', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { LLM_PROVIDER: 'mock' } as NodeJS.ProcessEnv });
    const res = await app.inject({ method: 'POST', url: '/api/runs', payload: { skill: 'extract', input: 'x', docIds: [] } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('INVALID_REQUEST');
    await app.close();
  });
});
