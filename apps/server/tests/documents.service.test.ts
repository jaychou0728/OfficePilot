import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../src/db/database.js';
import { getDocument, listDocuments } from '../src/db/documents.js';
import { getChunks } from '../src/db/chunks.js';
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

  it('rejects an invalid filename before creating a document', async () => {
    const service = makeService();
    const buffer = Buffer.from('valid content');
    await expect(service.upload({ name: '../evil.md', buffer, category: '制度' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(listDocuments(db)).toHaveLength(0);
    const doc = await service.upload({ name: 'ok.md', buffer, category: '制度' });
    await service.idle();
    expect(getDocument(db, doc.id)?.status).toBe('ready');
  });

  it('retries a failed document after the file is fixed', async () => {
    const service = makeService();
    const doc = await service.upload({ name: 'empty.md', buffer: Buffer.from('   '), category: '制度' });
    await service.idle();
    expect(getDocument(db, doc.id)?.status).toBe('failed');

    const target = getDocument(db, doc.id)!.filePath;
    fs.writeFileSync(target, '一线城市住宿 650 元。');
    expect(await service.reindex(doc.id)).toEqual({ skipped: false });
    await service.idle();
    expect(getDocument(db, doc.id)?.status).toBe('ready');
    expect(getChunks(db, doc.id).length).toBeGreaterThan(0);
  });

  it('reindexes changed content and replaces chunks', async () => {
    const service = makeService();
    const doc = await service.upload({ name: 'change.md', buffer: Buffer.from('一线城市住宿 650 元。'), category: '制度' });
    await service.idle();
    const target = getDocument(db, doc.id)!.filePath;
    fs.writeFileSync(target, '二线城市住宿 450 元。');

    expect(await service.reindex(doc.id)).toEqual({ skipped: false });
    await service.idle();

    const text = getChunks(db, doc.id).map((chunk) => chunk.text).join('');
    expect(text).toContain('450');
    expect(text).not.toContain('650');
  });

  it('maps a missing source file to DOC_PARSE_FAILED', async () => {
    const service = makeService();
    const doc = await service.upload({ name: 'lost.md', buffer: Buffer.from('x'), category: '制度' });
    await service.idle();
    const filePath = getDocument(db, doc.id)!.filePath;
    fs.rmSync(filePath);
    await expect(service.reindex(doc.id)).rejects.toMatchObject({ code: 'DOC_PARSE_FAILED' });
  });
});
