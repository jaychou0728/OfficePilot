import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import {
  createDocument, getDocument, listDocuments, updateDocumentStatus,
  findDocumentByHash, deleteDocument, updateDocumentFilePath, updateDocumentHash,
} from '../src/db/documents.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('documents repository', () => {
  it('creates and reads a document', () => {
    const doc = createDocument(db, { name: 'a.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h1', filePath: 'data/uploads/d1/a.pdf' });
    expect(getDocument(db, doc.id)?.name).toBe('a.pdf');
    expect(getDocument(db, doc.id)?.filePath).toBe('data/uploads/d1/a.pdf');
    expect(listDocuments(db)).toHaveLength(1);
    expect(findDocumentByHash(db, 'h1')?.id).toBe(doc.id);
  });

  it('updates status, path and hash', () => {
    const doc = createDocument(db, { name: 'a.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h2', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'ready', stage: '已入库', progress: 100, chunkCount: 3 });
    updateDocumentFilePath(db, doc.id, 'data/uploads/d1/a.pdf');
    updateDocumentHash(db, doc.id, 'h3');
    const updated = getDocument(db, doc.id)!;
    expect(updated.status).toBe('ready');
    expect(updated.chunkCount).toBe(3);
    expect(updated.filePath).toBe('data/uploads/d1/a.pdf');
    expect(updated.sha256).toBe('h3');
  });

  it('deletes a document', () => {
    const doc = createDocument(db, { name: 'a.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h4', filePath: 'x' });
    deleteDocument(db, doc.id);
    expect(getDocument(db, doc.id)).toBeNull();
  });

  it('treats error fields as a per-attempt snapshot and preserves COALESCE fields', () => {
    const doc = createDocument(db, { name: 'b.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h5', filePath: 'x' });
    updateDocumentStatus(db, doc.id, {
      status: 'failed', stage: '失败', progress: 0, chunkCount: 0,
      errorCode: 'DOC_PARSE_FAILED', errorMessage: 'bad pdf',
    });
    let row = getDocument(db, doc.id)!;
    expect(row.errorCode).toBe('DOC_PARSE_FAILED');
    expect(row.errorMessage).toBe('bad pdf');

    updateDocumentStatus(db, doc.id, { status: 'parsing', progress: 50 });
    row = getDocument(db, doc.id)!;
    expect(row.errorCode).toBeNull();
    expect(row.errorMessage).toBeNull();
    expect(row.stage).toBe('失败');
    expect(row.progress).toBe(50);
    expect(row.chunkCount).toBe(0);

    updateDocumentStatus(db, doc.id, { status: 'ready' });
    row = getDocument(db, doc.id)!;
    expect(row.indexedAt).not.toBeNull();
    const firstIndexedAt = row.indexedAt;

    updateDocumentStatus(db, doc.id, { status: 'parsing' });
    expect(getDocument(db, doc.id)!.indexedAt).toBe(firstIndexedAt);
  });

  it('writes zero progress and chunkCount as zero, not null', () => {
    const doc = createDocument(db, { name: 'c.pdf', type: 'PDF', category: '制度', size: 10, sha256: 'h6', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'embedding', progress: 0, chunkCount: 0 });
    const row = getDocument(db, doc.id)!;
    expect(row.progress).toBe(0);
    expect(row.chunkCount).toBe(0);
  });
});
