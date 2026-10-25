import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { getCachedEmbedding, putCachedEmbedding } from '../src/db/cache.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('embedding cache', () => {
  it('round-trips a vector with float32 precision', () => {
    putCachedEmbedding(db, 'h1', 'model', 4, [0.1, 0.2, 0.3, 0.4]);
    const vec = getCachedEmbedding(db, 'h1', 'model', 4);
    expect(vec).not.toBeNull();
    expect(Array.from(vec!)).toEqual([0.1, 0.2, 0.3, 0.4].map((x) => Math.fround(x)));
  });

  it('returns null on a miss or dimension mismatch', () => {
    expect(getCachedEmbedding(db, 'missing', 'model', 4)).toBeNull();
    putCachedEmbedding(db, 'h2', 'model', 4, [1, 2, 3, 4]);
    expect(getCachedEmbedding(db, 'h2', 'model', 8)).toBeNull();
    expect(getCachedEmbedding(db, 'h2', 'other-model', 4)).toBeNull();
  });

  it('rejects invalid vectors', () => {
    expect(() => putCachedEmbedding(db, 'h3', 'model', 4, [1, 2])).toThrow();
    expect(() => putCachedEmbedding(db, 'h3', 'model', 4, [1, 2, 3, NaN])).toThrow();
  });

  it('rejects a corrupt cached blob', () => {
    db.prepare('INSERT INTO embedding_cache(hash,model,dim,vector,created_at) VALUES (?,?,?,?,?)')
      .run('h4', 'model', 4, Buffer.from([1, 2]), new Date().toISOString());
    expect(() => getCachedEmbedding(db, 'h4', 'model', 4)).toThrow(/corrupt/);
  });
});
