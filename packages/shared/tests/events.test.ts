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

  it('round-trips through the runtime schema', () => {
    expect(parseSseEvent({ type: 'token', text: 'x' })).toEqual({ type: 'token', text: 'x' });
    expect(() => parseSseEvent({ type: 'unknown' })).toThrow();
  });
});
