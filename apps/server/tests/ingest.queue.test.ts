import { describe, it, expect } from 'vitest';
import { createSerialQueue } from '../src/ingest/queue.js';

describe('serial queue', () => {
  it('runs tasks one at a time in order', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    queue.enqueue(async () => { events.push('a-start'); await new Promise((r) => setTimeout(r, 10)); events.push('a-end'); });
    queue.enqueue(async () => { events.push('b-start'); events.push('b-end'); });
    await queue.idle();
    expect(events).toEqual(['a-start', 'a-end', 'b-start', 'b-end']);
  });

  it('continues after a failed task', async () => {
    const queue = createSerialQueue();
    const events: string[] = [];
    queue.enqueue(async () => { throw new Error('boom'); });
    queue.enqueue(async () => { events.push('ok'); });
    await queue.idle();
    expect(events).toEqual(['ok']);
  });
});
