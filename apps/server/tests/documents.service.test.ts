import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { getDocument } from '../src/db/documents.js';
import { createMockProvider } from '../src/gateway/mock.js';
import { createDocumentService } from '../src/ingest/service.js';

let db: ReturnType<typeof openDatabase>;
let dataDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'officepilot-service-'));
});
afterEach(() => {
  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function makeService() {
  const fileLoader = async (docId: string) => {
    const doc = getDocument(db, docId);
    if (!doc?.filePath) throw new Error('missing file');
    return fs.promises.readFile(doc.filePath);
  };
  return createDocumentService({
    db,
    dataDir,
    ingest: { db, provider: createMockProvider(), fileLoader },
  });
}

describe('document service', () => {
  it('uploads, indexes, skips unchanged reindex and removes', async () => {
    const service = makeService();
    const buffer = Buffer.from('一线城市住宿 650 元。');
    const doc = await service.upload({ name: 'a.md', buffer, category: '制度' });
    await service.idle();

    const ready = getDocument(db, doc.id)!;
    expect(ready.status).toBe('ready');
    expect(ready.filePath).toContain('a.md');
    expect(fs.existsSync(ready.filePath)).toBe(true);

    await expect(service.upload({ name: 'b.md', buffer, category: '制度' })).rejects.toMatchObject({ code: 'DOC_DUPLICATE' });
    expect(await service.reindex(doc.id)).toEqual({ skipped: true });

    await service.remove(doc.id);
    expect(getDocument(db, doc.id)).toBeNull();
    expect(fs.existsSync(path.dirname(ready.filePath))).toBe(false);
  });
});
