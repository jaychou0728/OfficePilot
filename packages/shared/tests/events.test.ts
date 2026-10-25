import { describe, it, expect } from 'vitest';
import { parseSseEvent, serializeSse } from '../src/index.js';

describe('serializeSse', () => {
  it('writes id, event and payload without the internal type', () => {
    const out = serializeSse(7, { type: 'token', text: '你好' });
    expect(out).toBe('id: 7\nevent: token\ndata: {"text":"你好"}\n\n');
  });

  it('unwraps the result payload', () => {
    const out = serializeSse(8, {
      type: 'result',
      result: { type: 'qa', answer: 'x', sources: [], confidence: 0.9 },
    });
    expect(out).toContain('event: result');
    expect(out).toContain('"type":"qa"');
    expect(out).not.toContain('"type":"result"');
  });

  it('escapes newlines inside token text', () => {
    const out = serializeSse(9, { type: 'token', text: 'a\nb' });
    const data = out.split('\n').find((line) => line.startsWith('data: '))!;
    expect(data).toBe('data: {"text":"a\\nb"}');
    expect(JSON.parse(data.slice(6))).toEqual({ text: 'a\nb' });
  });

  it('validates internal envelopes', () => {
    expect(parseSseEvent({ type: 'token', text: 'x' })).toEqual({ type: 'token', text: 'x' });
    expect(() => parseSseEvent({ type: 'unknown' })).toThrow();
  });

  it('parses a wire payload when the event type is supplied', () => {
    expect(parseSseEvent({ text: 'x' }, 'token')).toEqual({ type: 'token', text: 'x' });
    expect(() => parseSseEvent({ text: 'x' })).toThrow();
    expect(parseSseEvent({ ok: true, errors: [], attempt: 1 }, 'validation')).toEqual({
      type: 'validation', ok: true, errors: [], attempt: 1,
    });
  });

  it('serializes every event type with a matching event line', () => {
    const events = [
      { type: 'node', node: 'router', status: 'done' },
      { type: 'token', text: 'x' },
      { type: 'citation', sources: [] },
      { type: 'validation', ok: true, errors: [], attempt: 1 },
      { type: 'result', result: { type: 'qa', answer: 'x', sources: [], confidence: 0.9 } },
      { type: 'error', code: 'LLM_TIMEOUT', message: 'timeout', retryable: true },
      { type: 'done', runId: 'r1', usage: { promptTokens: 1, completionTokens: 1 } },
    ] as const;
    for (const event of events) {
      const out = serializeSse(1, event as never);
      expect(out).toContain(`event: ${event.type}`);
      const data = out.split('\n').find((line) => line.startsWith('data: '))!;
      expect(() => JSON.parse(data.slice(6))).not.toThrow();
    }
  });
});
