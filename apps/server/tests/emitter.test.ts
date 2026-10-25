import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createRun, getEventsAfter } from '../src/db/runs.js';
import { createRunEmitter } from '../src/graph/emitter.js';

describe('run emitter', () => {
  it('persists events and notifies subscribers with seq', async () => {
    const db = openDatabase(':memory:');
    const run = createRun(db, { skill: 'qa', input: 'q', docIds: [], templateId: null });
    const seen: Array<{ seq: number; type: string }> = [];
    const emitter = createRunEmitter(db, run.id, (seq, event) => seen.push({ seq, type: event.type }));
    emitter.node('router', 'done', 10, 'qa');
    emitter.token('x');
    await emitter.flush();
    expect(seen).toEqual([{ seq: 1, type: 'node' }, { seq: 2, type: 'token' }]);
    expect(getEventsAfter(db, run.id, 0).map((event) => event.type)).toEqual(['node', 'token']);
    db.close();
  });
});
