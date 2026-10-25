import type { DatabaseSync } from 'node:sqlite';
import { AppError, type Source } from '@officepilot/shared';
import type { EmbeddingProvider } from '../../gateway/types.js';
import { getChunks, searchFts } from '../../db/chunks.js';
import { getDocument } from '../../db/documents.js';
import { cosine } from '../../rag/vector.js';
import { hybridRank, type VectorHit } from '../../rag/search.js';

export async function retrieveChunks(input: {
  db: DatabaseSync;
  provider: EmbeddingProvider;
  query: string;
  docIds: string[];
  threshold: number;
}): Promise<{ sources: Source[]; filtered: number }> {
  const [queryVector] = await input.provider.embed([input.query]);
  if (!queryVector?.length) throw new AppError('EMBEDDING_FAILED');

  const storedDim = input.db.prepare("SELECT value FROM app_meta WHERE key='embedding_dim'").get() as { value: string } | undefined;
  if (storedDim && Number(storedDim.value) !== queryVector.length) {
    throw new AppError('EMBEDDING_DIM_MISMATCH');
  }

  const docIds = input.docIds.length
    ? input.docIds
    : (input.db.prepare("SELECT id FROM documents WHERE status='ready'").all() as Array<{ id: string }>)
        .map((row) => row.id);

  const vectorHits: VectorHit[] = [];
  for (const docId of docIds) {
    const doc = getDocument(input.db, docId);
    if (!doc || doc.status !== 'ready') continue;
    for (const chunk of getChunks(input.db, docId)) {
      if (!chunk.embedding) continue;
      if (chunk.embedding.length !== queryVector.length) throw new AppError('EMBEDDING_DIM_MISMATCH');
      vectorHits.push({
        chunkId: chunk.id,
        docId,
        docName: doc.name,
        ordinal: chunk.ordinal,
        text: chunk.text,
        page: chunk.page ?? null,
        sheet: chunk.sheet ?? null,
        section: chunk.section ?? null,
        vector: cosine(chunk.embedding, queryVector),
      });
    }
  }

  const scoped = new Set(docIds);
  const ftsHits = searchFts(input.db, input.query, 8).filter((hit) => scoped.has(hit.docId));
  const ranked = hybridRank({ vectorHits, ftsHits, threshold: input.threshold, limit: 5 });

  const sources = ranked.map((hit, index) => ({
    n: index + 1,
    docId: hit.docId,
    docName: hit.docName,
    chunkId: hit.chunkId,
    page: hit.page ?? null,
    sheet: hit.sheet ?? null,
    score: Math.round(hit.vector * 1000) / 1000,
    snippet: hit.text.slice(0, 240),
  }));

  return { sources, filtered: Math.max(0, vectorHits.length - ranked.length) };
}
