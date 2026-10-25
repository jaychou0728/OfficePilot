import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { buildOfficeGraph } from '../src/graph/office-graph.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} } as never);

describe('office graph', () => {
  it('routes qa and returns a result', async () => {
    const text = '一线城市住宿 650 元';
    const doc = createDocument(db, { name: 'a.md', type: 'MD', category: '制度', size: 1, sha256: 'h', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'ready', progress: 100, chunkCount: 1 });
    const [vector] = await createMockProvider().embed([text]);
    insertChunks(db, doc.id, [{ ordinal: 0, text, page: 1 }], [vector]);
    db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('embedding_dim','256')").run();

    const graph = buildOfficeGraph({
      db,
      gateway: { chat: createMockProvider({ answer: '650[1]' }), embed: createMockProvider() },
      threshold: 0.1,
      emitter: emitter(),
    });

    const state = await graph.invoke({
      runId: 'r1', skill: 'qa', input: '住宿标准', docIds: [doc.id], templateId: null,
      operation: 'answer', candidates: [], sources: [], draft: '', result: null, attempts: 0,
      usage: { promptTokens: 0, completionTokens: 0 },
    });

    expect(state.result?.type).toBe('qa');
  });
});
