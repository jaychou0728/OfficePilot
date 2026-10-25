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
});
