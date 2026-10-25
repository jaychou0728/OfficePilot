import fs from 'node:fs/promises';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { AppError, type DocumentCategory, type DocumentType } from '@officepilot/shared';
import {
  createDocument, findDocumentByHash, getDocument, deleteDocument,
  updateDocumentFilePath, updateDocumentHash, updateDocumentStatus,
} from '../db/documents.js';
import { deleteChunksByDoc } from '../db/chunks.js';
import { safeJoin, sha256, validateFilename, validateUpload } from './files.js';
import { ingestDocument, type IngestContext } from './pipeline.js';
import { createSerialQueue } from './queue.js';

export function createDocumentService(options: {
  db: DatabaseSync;
  dataDir: string;
  ingest: IngestContext;
}) {
  const queue = createSerialQueue((error) => console.error('[ingest]', error));

  return {
    async upload(input: { name: string; buffer: Buffer; category: DocumentCategory }) {
      validateFilename(input.name);
      const type: DocumentType = validateUpload(input.name, input.buffer.byteLength);
      const hash = sha256(input.buffer);
      const existing = findDocumentByHash(options.db, hash);
      if (existing) throw new AppError('DOC_DUPLICATE');

      const doc = createDocument(options.db, {
        name: input.name, type, category: input.category,
        size: input.buffer.byteLength, sha256: hash, filePath: '',
      });
      const dir = path.join(options.dataDir, 'uploads', doc.id);
      const filePath = safeJoin(dir, input.name);
      try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, input.buffer);
      } catch (error) {
        deleteDocument(options.db, doc.id);
        await fs.rm(dir, { recursive: true, force: true });
        throw error;
      }
      updateDocumentFilePath(options.db, doc.id, filePath);
      queue.enqueue(() => ingestDocument(options.ingest, doc.id));
      return getDocument(options.db, doc.id)!;
    },

    async reindex(id: string) {
      const doc = getDocument(options.db, id);
      if (!doc) throw new AppError('NOT_FOUND');
      if (!doc.filePath) throw new AppError('DOC_PARSE_FAILED', '缺少原文件路径');
      let buffer: Buffer;
      try {
        buffer = await fs.readFile(doc.filePath);
      } catch {
        throw new AppError('DOC_PARSE_FAILED', '原文件已丢失，请重新上传');
      }
      const hash = sha256(buffer);
      if (hash === doc.sha256 && doc.status === 'ready') return { skipped: true as const };
      updateDocumentStatus(options.db, id, { status: 'queued', stage: '排队中', progress: 0, chunkCount: 0 });
      queue.enqueue(async () => {
        await ingestDocument(options.ingest, id);
        updateDocumentHash(options.db, id, hash);
      });
      return { skipped: false as const };
    },

    async remove(id: string) {
      const doc = getDocument(options.db, id);
      if (!doc) throw new AppError('NOT_FOUND');
      deleteChunksByDoc(options.db, id);
      deleteDocument(options.db, id);
      await fs.rm(path.join(options.dataDir, 'uploads', id), { recursive: true, force: true });
    },

    idle: () => queue.idle(),
  };
}
