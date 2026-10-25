import { describe, it, expect } from 'vitest';
import { cosine, topK } from '../src/rag/vector.js';

describe('vector search', () => {
  it('computes cosine with zero and float32 inputs', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([0, 0], [1, 0])).toBe(0);
    expect(cosine(new Float32Array([1, 0]), [1, 0])).toBeCloseTo(1);
  });

  it('returns the top-k in score order with stable ties', () => {
    const items = [
      { id: 'a', vector: [1, 0] },
      { id: 'b', vector: [0.9, 0.1] },
      { id: 'c', vector: [0, 1] },
      { id: 'd', vector: [0, 1] },
    ];
    expect(topK(items, [1, 0], 2).map((x) => x.id)).toEqual(['a', 'b']);
    expect(topK(items, [1, 0], 2)[1].score).toBeGreaterThan(0);
    expect(topK(items, [0, 1], 3).map((x) => x.id)).toEqual(['c', 'd', 'b']);
  });

  it('handles empty input and non-positive k', () => {
    expect(topK([], [1, 0], 3)).toEqual([]);
    expect(topK([{ id: 'a', vector: [1, 0] }], [1, 0], 0)).toEqual([]);
    expect(topK([{ id: 'a', vector: [1, 0] }], [1, 0], -2)).toEqual([]);
  });
});
