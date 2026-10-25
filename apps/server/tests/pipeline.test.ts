import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, getDocument } from '../src/db/documents.js';
import { getChunks } from '../src/db/chunks.js';
import { ingestDocument } from '../src/ingest/pipeline.js';
import { createMockProvider } from '../src/gateway/mock.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('ingestion pipeline', () => {
  it('parses, chunks, embeds and marks ready', async () => {
    const doc = createDocument(db, { name: 'a.md', type: 'MD', category: '制度', size: 20, sha256: 'h1', filePath: 'x' });
    await ingestDocument({
      db,
      provider: createMockProvider(),
      fileLoader: async () => Buffer.from('# 制度\n\n一线城市住宿 650 元。'),
    }, doc.id);

    const updated = getDocument(db, doc.id)!;
    expect(updated.status).toBe('ready');
    expect(updated.chunkCount).toBeGreaterThan(0);

    const chunks = getChunks(db, doc.id);
    expect(chunks).toHaveLength(updated.chunkCount);
    expect(chunks[0].embedding).toBeInstanceOf(Float32Array);

    const dim = db.prepare("SELECT value FROM app_meta WHERE key='embedding_dim'").get() as { value: string };
    expect(dim.value).toBe('256');
  });

  it('marks failed and preserves the error code when parsing fails', async () => {
    const doc = createDocument(db, { name: 'bad.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h2', filePath: 'x' });
    await expect(ingestDocument({
      db,
      provider: createMockProvider(),
      fileLoader: async () => Buffer.from('not a pdf'),
    }, doc.id)).rejects.toMatchObject({ code: 'DOC_PARSE_FAILED' });

    const failed = getDocument(db, doc.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('DOC_PARSE_FAILED');
    expect(failed.errorMessage).toBeTruthy();
  });
});
