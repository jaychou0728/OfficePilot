import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { runQa } from '../src/graph/qa.js';
import type { ChatProvider } from '../src/gateway/types.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

async function seed(text: string) {
  const doc = createDocument(db, { name: '差旅制度.md', type: 'MD', category: '制度', size: text.length, sha256: `h-${text}`, filePath: 'x' });
  updateDocumentStatus(db, doc.id, { status: 'ready', progress: 100, chunkCount: 1 });
  const provider = createMockProvider();
  const [vector] = await provider.embed([text]);
  insertChunks(db, doc.id, [{ ordinal: 0, text, page: 1 }], [vector]);
  db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('embedding_dim','256')").run();
  return doc;
}

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} } as never);

describe('qa flow', () => {
  it('retrieves and answers with citations', async () => {
    const doc = await seed('一线城市住宿 650 元');
    const provider = createMockProvider({ answer: '住宿标准是 650 元[1]' });
    const result = await runQa({
      db, provider, embedder: provider, question: '住宿标准', docIds: [doc.id], threshold: 0.1, emitter: emitter(),
    });
    expect(result.type).toBe('qa');
    if (result.type !== 'qa') throw new Error('unreachable');
    expect(result.sources).toHaveLength(1);
    expect(result.answer).toContain('650');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.boundary).toBeUndefined();
  });

  it('returns a boundary result when retrieval is empty', async () => {
    const result = await runQa({
      db,
      provider: createMockProvider(),
      embedder: createMockProvider(),
      question: '海外差旅',
      docIds: [],
      threshold: 0.55,
      emitter: emitter(),
    });
    expect(result.type).toBe('qa');
    if (result.type !== 'qa') throw new Error('unreachable');
    expect(result.boundary?.reason).toBeTruthy();
    expect(result.sources).toEqual([]);
  });

  it('retries after a citation failure', async () => {
    const doc = await seed('一线城市住宿 650 元');
    let calls = 0;
    const provider: ChatProvider = {
      name: 'retry',
      async *stream() {
        calls++;
        const answer = calls === 1 ? '住宿标准是 900 元[1]' : '住宿标准是 650 元[1]';
        for (const char of answer) yield char;
      },
      async complete() { return ''; },
    };
    const result = await runQa({
      db, provider, embedder: createMockProvider(), question: '住宿标准', docIds: [doc.id], threshold: 0.1, emitter: emitter(),
    });
    expect(calls).toBe(2);
    expect(result.type).toBe('qa');
    if (result.type !== 'qa') throw new Error('unreachable');
    expect(result.answer).toContain('650');
  });
});
