import { describe, it, expect } from 'vitest';
import { createMockProvider } from '../src/gateway/mock.js';
import { streamAnswer } from '../src/graph/nodes/answer.js';

describe('answer node', () => {
  it('emits tokens and returns the draft', async () => {
    const tokens: string[] = [];
    const draft = await streamAnswer({
      question: '住宿标准？',
      sources: [{ n: 1, docId: 'd', docName: 'doc', chunkId: 'c', score: 0.9, snippet: '650 元' }],
      provider: createMockProvider({ answer: '标准是 650 元[1]' }),
      emitter: { token: (text: string) => tokens.push(text) } as never,
    });
    expect(draft).toContain('650');
    expect(tokens.join('')).toContain('650');
  });
});
