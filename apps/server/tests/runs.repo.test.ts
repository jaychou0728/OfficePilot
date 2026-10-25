import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import {
  createRun, appendRunEvent, getRun, getEventsAfter, markRunRunning, finishRun, failRun,
} from '../src/db/runs.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('runs repository', () => {
  it('creates a run and appends events with increasing seq and replay', () => {
    const run = createRun(db, { skill: 'qa', input: 'q', docIds: ['d1', 'd2'], templateId: null });
    expect(run.status).toBe('queued');
    expect(run.docIds).toEqual(['d1', 'd2']);
    const a = appendRunEvent(db, run.id, 'node', { node: 'router' });
    const b = appendRunEvent(db, run.id, 'token', { text: 'x' });
    expect(a).toBe(1);
    expect(b).toBe(2);
    const replayed = getEventsAfter(db, run.id, 1);
    expect(replayed.map((e) => e.seq)).toEqual([2]);
    expect(replayed[0].payload).toEqual({ text: 'x' });
  });

  it('marks running and finishes with result/usage', () => {
    const run = createRun(db, { skill: 'qa', input: 'q', docIds: [], templateId: null });
    markRunRunning(db, run.id);
    expect(getRun(db, run.id)?.status).toBe('running');
    finishRun(db, run.id, 'succeeded', { type: 'qa', answer: 'ok' }, { promptTokens: 1, completionTokens: 2 });
    const finished = getRun(db, run.id)!;
    expect(finished.status).toBe('succeeded');
    expect(finished.result).toEqual({ type: 'qa', answer: 'ok' });
    expect(finished.usage).toEqual({ promptTokens: 1, completionTokens: 2 });
    expect(finished.finishedAt).toBeTruthy();
  });

  it('fails a run with an error code', () => {
    const run = createRun(db, { skill: 'extract', input: 'q', docIds: ['d1'], templateId: 'meeting' });
    failRun(db, run.id, 'LLM_TIMEOUT', 'timeout');
    const failed = getRun(db, run.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('LLM_TIMEOUT');
    expect(failed.errorMessage).toBe('timeout');
    expect(failed.finishedAt).toBeTruthy();
  });

  it('returns null for a missing run', () => {
    expect(getRun(db, 'missing')).toBeNull();
  });
});
