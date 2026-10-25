import type { DatabaseSync } from 'node:sqlite';
import type { SseEvent } from '@officepilot/shared';
import { appendRunEvent } from '../db/runs.js';

export type RunEmitter = ReturnType<typeof createRunEmitter>;

export function createRunEmitter(
  db: DatabaseSync,
  runId: string,
  notify: (seq: number, event: SseEvent) => void,
) {
  let queue: Promise<void> = Promise.resolve();

  function emit(event: SseEvent) {
    queue = queue.then(() => {
      const seq = appendRunEvent(db, runId, event.type, event);
      notify(seq, event);
    });
  }

  return {
    emit,
    node(node: string, status: 'running' | 'done' | 'fail', ms?: number, detail?: string) {
      emit({ type: 'node', node, status, ms, detail });
    },
    token(text: string) {
      emit({ type: 'token', text });
    },
    flush() {
      return queue;
    },
  };
}
