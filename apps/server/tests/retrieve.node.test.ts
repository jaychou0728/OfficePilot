import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { retrieveChunks } from '../src/graph/nodes/retrieve.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

async function seed(name: string, hash: string, text: string) {
  const doc = createDocument(db, { name, type: 'MD', category: '制度', size: text.length, sha256: hash, filePath: 'x' });
  updateDocumentStatus(db, doc.id, { status: 'ready', progress: 100, chunkCount: 1 });
  const provider = createMockProvider();
  const [vector] = await provider.embed([text]);
  insertChunks(db, doc.id, [{ ordinal: 0, text, page: 1 }], [vector]);
  return doc;
}

describe('retrieve node', () => {
  it('retrieves scoped chunks with doc names and citations', async () => {
    const doc = await seed('差旅制度.md', 'h1', '一线城市住宿标准 650 元');
    db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('embedding_dim','256')").run();

    const result = await retrieveChunks({
      db,
      provider: createMockProvider(),
      query: '一线城市住宿标准',
      docIds: [doc.id],
      threshold: 0.1,
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].docName).toBe('差旅制度.md');
    expect(result.sources[0].snippet).toContain('650');
    expect(result.sources[0].n).toBe(1);
  });

  it('filters out FTS hits from documents outside docIds', async () => {
    const first = await seed('a.md', 'h2', '一线城市住宿标准 650 元');
    await seed('b.md', 'h3', '一线城市住宿标准 650 元');

    const result = await retrieveChunks({
      db,
      provider: createMockProvider(),
      query: '一线城市住宿标准',
      docIds: [first.id],
      threshold: 0.1,
    });

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].docId).toBe(first.id);
  });

  it('rejects a query embedding dimension mismatch', async () => {
    await seed('a.md', 'h4', '一线城市住宿标准 650 元');
    db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('embedding_dim','128')").run();
    await expect(retrieveChunks({
      db,
      provider: createMockProvider(),
      query: '住宿',
      docIds: [],
      threshold: 0.1,
    })).rejects.toMatchObject({ code: 'EMBEDDING_DIM_MISMATCH' });
  });
});
