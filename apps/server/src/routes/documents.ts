import type { FastifyInstance } from 'fastify';
import { DocumentCategorySchema } from '@officepilot/shared';
import { listDocuments, getDocument, type DocumentRow } from '../db/documents.js';
import { getChunks } from '../db/chunks.js';
import type { createDocumentService } from '../ingest/service.js';

type Deps = {
  db: import('node:sqlite').DatabaseSync;
  documents: ReturnType<typeof createDocumentService>;
};

export function toDocumentDto(row: DocumentRow) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    size: row.size,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    chunks: row.chunkCount,
    error: row.errorMessage,
    updatedAt: row.updatedAt,
  };
}

export function documentRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/api/documents', async () => {
    const items = listDocuments(deps.db).map(toDocumentDto);
    return { items, total: items.length };
  });

  app.get('/api/documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const doc = getDocument(deps.db, id);
    if (!doc) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: '资源不存在', retryable: false, requestId: request.id },
      });
    }
    return { document: toDocumentDto(doc) };
  });

  app.post('/api/documents', async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({
        error: { code: 'INVALID_REQUEST', message: '缺少文件', retryable: false, requestId: request.id },
      });
    }
    const buffer = await data.toBuffer();
    const category = DocumentCategorySchema.parse(
      (data.fields.category as { value?: string } | undefined)?.value ?? '制度',
    );
    const doc = await deps.documents.upload({ name: data.filename, buffer, category });
    return reply.code(202).send({ document: toDocumentDto(doc) });
  });

  app.delete('/api/documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await deps.documents.remove(id);
    return reply.code(204).send();
  });

  app.get('/api/documents/:id/chunks', async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { offset?: string; limit?: string };
    const chunks = getChunks(deps.db, id);
    const offset = Number(query.offset ?? 0);
    const limit = Math.min(100, Number(query.limit ?? 20));
    const items = chunks.slice(offset, offset + limit).map(({ embedding: _embedding, ...rest }) => rest);
    return { items, total: chunks.length };
  });

  app.post('/api/documents/:id/reindex', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await deps.documents.reindex(id);
    if (result.skipped) return reply.code(200).send({ skipped: true });
    const doc = getDocument(deps.db, id);
    return reply.code(202).send({ document: doc ? toDocumentDto(doc) : null });
  });
}
