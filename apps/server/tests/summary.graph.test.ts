import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { runSummary } from '../src/graph/summary.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} } as never);

describe('summary graph', () => {
  it('summarizes a document and returns qa-shaped result', async () => {
    const doc = createDocument(db, { name: '制度.md', type: 'MD', category: '制度', size: 1, sha256: 'h', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'ready', progress: 100, chunkCount: 1 });
    insertChunks(db, doc.id, [{ ordinal: 0, text: '一线城市住宿 650 元', page: 1 }], [[1, 0]]);

    const result = await runSummary({
      db, provider: createMockProvider({ answer: '要点一' }), docIds: [doc.id], emitter: emitter(),
    });

    expect(result.type).toBe('qa');
    if (result.type !== 'qa') throw new Error('unreachable');
    expect(result.answer).toContain('要点');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].docName).toBe('制度.md');
  });
});
