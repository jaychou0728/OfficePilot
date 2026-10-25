import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument } from '../src/db/documents.js';
import { insertChunks, searchFts, getChunks, deleteChunksByDoc } from '../src/db/chunks.js';

let db: ReturnType<typeof openDatabase>;
let docId: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  docId = createDocument(db, { name: 'a.md', type: 'MD', category: '制度', size: 10, sha256: 'h', filePath: 'x' }).id;
});
afterEach(() => { db.close(); });

describe('chunks repository', () => {
  it('inserts chunks, decodes vectors and searches with bigram FTS', () => {
    insertChunks(db, docId, [
      { ordinal: 0, text: '一线城市住宿标准为 650 元', page: 1 },
      { ordinal: 1, text: '二线城市住宿标准为 450 元', page: 2 },
    ], [[1, 0], [0, 1]]);

    const chunks = getChunks(db, docId);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].embedding).toBeInstanceOf(Float32Array);
    expect(Array.from(chunks[0].embedding!)).toEqual([1, 0]);

    const hits = searchFts(db, '一线住宿', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunkId).toBeTruthy();
    expect(hits[0].text).toContain('650');
  });

  it('deletes chunks by document and cleans FTS via the trigger', () => {
    insertChunks(db, docId, [{ ordinal: 0, text: '一线城市住宿 650 元', page: 1 }], [[1]]);
    deleteChunksByDoc(db, docId);
    expect(getChunks(db, docId)).toHaveLength(0);
    expect(searchFts(db, '一线住宿', 5)).toHaveLength(0);
  });

  it('rejects a vector/chunk count mismatch', () => {
    expect(() => insertChunks(db, docId, [{ ordinal: 0, text: 'x' }], [])).toThrow();
  });

  it('rejects mixed dimensions and non-finite values', () => {
    expect(() => insertChunks(db, docId, [{ ordinal: 0, text: 'a' }, { ordinal: 1, text: 'b' }], [[1, 0], [1]])).toThrow();
    expect(() => insertChunks(db, docId, [{ ordinal: 0, text: 'a' }], [[NaN]])).toThrow();
  });

  it('rolls back the batch on a duplicate ordinal', () => {
    expect(() => insertChunks(db, docId, [{ ordinal: 0, text: 'a' }, { ordinal: 0, text: 'b' }], [[1], [2]])).toThrow();
    expect(getChunks(db, docId)).toHaveLength(0);
    expect(searchFts(db, 'a', 5)).toHaveLength(0);
  });

  it('rejects a corrupt embedding blob', () => {
    insertChunks(db, docId, [{ ordinal: 0, text: 'a' }], [[1, 2]]);
    db.prepare('UPDATE chunks SET embedding=?, dim=? WHERE doc_id=?').run(Buffer.from([1, 2]), 1, docId);
    expect(() => getChunks(db, docId)).toThrow(/corrupt/);
  });
});
