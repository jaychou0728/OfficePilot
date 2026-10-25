import { describe, it, expect } from 'vitest';
import { hybridRank } from '../src/rag/search.js';

function v(chunkId: string, docId: string, ordinal: number, vector: number) {
  return { chunkId, docId, docName: docId, ordinal, text: chunkId, vector };
}

describe('hybrid rank', () => {
  it('boosts FTS matches, filters below threshold and limits', () => {
    const result = hybridRank({
      vectorHits: [v('a', 'd1', 0, 0.9), v('b', 'd2', 0, 0.8), v('c', 'd3', 0, 0.4)],
      ftsHits: [{ chunkId: 'b', raw: -2 }, { chunkId: 'c', raw: -1 }],
      threshold: 0.55,
      limit: 2,
    });
    expect(result.map((r) => r.chunkId)).toEqual(['b', 'a']);
    expect(result[0].bm25).toBeGreaterThan(result[1].bm25);
    expect(result.every((r) => r.vector >= 0.55)).toBe(true);
  });

  it('dedupes adjacent chunks from the same document', () => {
    const result = hybridRank({
      vectorHits: [v('a', 'd1', 0, 0.9), v('b', 'd1', 1, 0.8)],
      ftsHits: [],
      threshold: 0.55,
      limit: 5,
    });
    expect(result.map((r) => r.chunkId)).toEqual(['a']);
  });

  it('returns empty for no hits or a non-positive limit', () => {
    expect(hybridRank({ vectorHits: [], ftsHits: [], threshold: 0.55, limit: 5 })).toEqual([]);
    expect(hybridRank({ vectorHits: [v('a', 'd1', 0, 0.9)], ftsHits: [], threshold: 0.55, limit: 0 })).toEqual([]);
  });

  it('does not boost when there are no FTS hits', () => {
    const result = hybridRank({
      vectorHits: [v('a', 'd1', 0, 0.8), v('b', 'd2', 0, 0.9)],
      ftsHits: [],
      threshold: 0.55,
      limit: 2,
    });
    expect(result.map((r) => r.chunkId)).toEqual(['b', 'a']);
  });
});
