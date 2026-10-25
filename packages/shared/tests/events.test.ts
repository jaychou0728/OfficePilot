import { describe, it, expect } from 'vitest';
import { serializeSse } from '../src/index.js';

describe('serializeSse', () => {
  it('writes id, event and data', () => {
    const out = serializeSse(7, { type: 'token', text: '你好' });
    expect(out).toBe('id: 7\nevent: token\ndata: {"type":"token","text":"你好"}\n\n');
  });
});
