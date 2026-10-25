import { describe, it, expect } from 'vitest';
import { createMockProvider, hashEmbedding } from '../src/gateway/mock.js';

describe('mock provider', () => {
  it('streams a scripted answer containing 650', async () => {
    const provider = createMockProvider();
    const out: string[] = [];
    for await (const token of provider.stream([{ role: 'user', content: '一线城市住宿标准' }])) out.push(token);
    expect(out.join('')).toContain('650');
  });

  it('uses a custom answer for complete and stream', async () => {
    const provider = createMockProvider({ answer: '[{"task":"x"}]' });
    expect(await provider.complete([{ role: 'user', content: 'q' }])).toBe('[{"task":"x"}]');
    const out: string[] = [];
    for await (const token of provider.stream([{ role: 'user', content: 'q' }])) out.push(token);
    expect(out.join('')).toBe('[{"task":"x"}]');
  });

  it('produces deterministic normalized embeddings with the requested dimension', async () => {
    const a = hashEmbedding('差旅住宿标准', 64);
    const b = hashEmbedding('差旅住宿标准', 64);
    expect(a).toEqual(b);
    expect(a).toHaveLength(64);
    expect(Math.hypot(...a)).toBeCloseTo(1, 5);

    const [x, y] = await createMockProvider({ dim: 128 }).embed(['差旅', '差旅']);
    expect(x).toHaveLength(128);
    expect(x).toEqual(y);
  });

  it('preserves newlines in streamed answers', async () => {
    const provider = createMockProvider({ answer: 'a\nb' });
    const out: string[] = [];
    for await (const token of provider.stream([{ role: 'user', content: 'q' }])) out.push(token);
    expect(out.join('')).toBe('a\nb');
  });
});
