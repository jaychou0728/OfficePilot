import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';

describe('runs SSE', () => {
  it('creates a run, completes it and replays events', async () => {
    const app = buildApp({ dbPath: ':memory:', env: { LLM_PROVIDER: 'mock', DEMO_MODE: 'false' } as NodeJS.ProcessEnv });
    const created = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { skill: 'qa', input: '住宿标准', docIds: [] },
    });
    expect(created.statusCode).toBe(202);
    const { runId } = created.json();

    let run: ReturnType<typeof created.json> | null = null;
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({ method: 'GET', url: `/api/runs/${runId}` });
      run = res.json().run;
      if (run && (run as { status: string }).status === 'succeeded') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect((run as { status: string }).status).toBe('succeeded');

    const events = await app.inject({ method: 'GET', url: `/api/runs/${runId}/events` });
    expect(events.headers['content-type']).toContain('text/event-stream');
    expect(events.body).toContain('event: node');
    expect(events.body).toContain('event: result');
    expect(events.body).toContain('event: done');

    const replay = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/events`,
      headers: { 'last-event-id': '1' },
    });
    expect(replay.body).not.toContain('id: 1\n');

    const bad = await app.inject({
      method: 'POST',
      url: '/api/runs',
      payload: { skill: 'extract', input: 'x', docIds: [], templateId: 'meeting' },
    });
    expect(bad.statusCode).toBe(400);

    await app.close();
  });
});
