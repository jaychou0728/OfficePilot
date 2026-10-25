import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { runExtract } from '../src/graph/extract.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} } as never);

describe('extract graph', () => {
  it('returns rows from a document', async () => {
    const doc = createDocument(db, { name: 'm.md', type: 'MD', category: '会议', size: 1, sha256: 'h', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'ready', chunkCount: 1, progress: 100 });
    insertChunks(db, doc.id, [{ ordinal: 0, text: '林澈负责 11 月 3 日交付原型', page: 1 }], [[1, 0]]);

    const result = await runExtract({
      db,
      provider: createMockProvider({
        answer: JSON.stringify([{ task: '交付原型', owner: '林澈', dueDate: '2026-11-03', priority: 'P0', risk: '中' }]),
      }),
      docId: doc.id,
      templateId: 'meeting',
      emitter: emitter(),
    });

    expect(result.type).toBe('extract');
    if (result.type !== 'extract') throw new Error('unreachable');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].owner).toBe('林澈');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].docName).toBe('m.md');
  });
});
