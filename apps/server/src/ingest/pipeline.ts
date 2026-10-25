import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { AppError } from '@officepilot/shared';
import type { EmbeddingProvider } from '../gateway/types.js';
import { parseDocument } from './parsers.js';
import { chunkDocument } from './chunker.js';
import { updateDocumentStatus, getDocument } from '../db/documents.js';
import { insertChunks } from '../db/chunks.js';
import { getCachedEmbedding, putCachedEmbedding } from '../db/cache.js';

export type IngestContext = {
  db: DatabaseSync;
  provider: EmbeddingProvider;
  fileLoader: (docId: string) => Promise<Buffer>;
};

export async function ingestDocument(ctx: IngestContext, docId: string): Promise<void> {
  const doc = getDocument(ctx.db, docId);
  if (!doc) throw new AppError('NOT_FOUND');

  try {
    updateDocumentStatus(ctx.db, docId, { status: 'parsing', stage: '解析中', progress: 10 });
    const buffer = await ctx.fileLoader(docId);
    const parsed = await parseDocument(buffer, doc.type);

    updateDocumentStatus(ctx.db, docId, { status: 'chunking', stage: '切块中', progress: 35 });
    const chunks = chunkDocument(parsed);
    if (!chunks.length) throw new AppError('DOC_PARSE_FAILED', '未生成任何知识块');

    updateDocumentStatus(ctx.db, docId, { status: 'embedding', stage: '向量化', progress: 55 });
    const [probe] = await ctx.provider.embed(['probe']);
    const dim = probe?.length ?? 0;
    if (!dim) throw new AppError('EMBEDDING_FAILED', '向量维度为空');

    const stored = ctx.db.prepare("SELECT value FROM app_meta WHERE key='embedding_dim'").get() as { value: string } | undefined;
    if (stored && Number(stored.value) !== dim) throw new AppError('EMBEDDING_DIM_MISMATCH');
    ctx.db.prepare("INSERT OR REPLACE INTO app_meta(key,value) VALUES ('embedding_dim',?)").run(String(dim));

    const vectors: number[][] = [];
    for (let i = 0; i < chunks.length; i += 32) {
      const batch = chunks.slice(i, i + 32);
      const embedded = await Promise.all(batch.map(async (chunk) => {
        const hash = createHash('sha256').update(`${ctx.provider.model}:${chunk.text}`).digest('hex');
        const cached = getCachedEmbedding(ctx.db, hash, ctx.provider.model, dim);
        if (cached) return Array.from(cached);
        const [vector] = await ctx.provider.embed([chunk.text]);
        if (!vector || vector.length !== dim) throw new AppError('EMBEDDING_DIM_MISMATCH');
        putCachedEmbedding(ctx.db, hash, ctx.provider.model, dim, vector);
        return vector;
      }));
      vectors.push(...embedded);
    }

    updateDocumentStatus(ctx.db, docId, { status: 'embedding', stage: '写入索引', progress: 90 });
    insertChunks(ctx.db, docId, chunks, vectors);
    updateDocumentStatus(ctx.db, docId, { status: 'ready', stage: '已入库', progress: 100, chunkCount: chunks.length });
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'INTERNAL';
    updateDocumentStatus(ctx.db, docId, {
      status: 'failed',
      stage: '失败',
      progress: 0,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
