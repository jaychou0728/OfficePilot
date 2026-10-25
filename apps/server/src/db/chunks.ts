import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { tokenizeForFts, toFtsQuery } from '../rag/tokenize.js';

export type ChunkInput = {
  ordinal: number; text: string; page?: number; sheet?: string; section?: string;
  startOffset?: number; endOffset?: number;
};

export type ChunkRecord = ChunkInput & { id: string; docId: string; embedding?: Float32Array };

export type FtsHit = {
  chunkId: string; text: string; raw: number; docId: string; docName: string;
  ordinal: number; page: number | null; sheet: string | null; section: string | null;
};

export function insertChunks(db: DatabaseSync, docId: string, chunks: ChunkInput[], vectors: number[][]): void {
  if (vectors.length !== chunks.length) throw new Error('vectors length mismatch');
  const dim = vectors[0]?.length ?? 0;
  if (dim <= 0) throw new Error('embedding dimension must be positive');
  for (const vector of vectors) {
    if (vector.length !== dim || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('embedding vectors must have equal finite dimensions');
    }
  }
  const now = new Date().toISOString();
  const insertChunk = db.prepare(`INSERT INTO chunks(id,doc_id,ordinal,text,page,sheet,section,start_offset,end_offset,embedding,dim,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertFts = db.prepare('INSERT INTO chunks_fts(chunk_id,tokens) VALUES (?,?)');

  db.exec('BEGIN');
  try {
    chunks.forEach((chunk, index) => {
      const id = randomUUID();
      const vector = vectors[index] ?? [];
      const buffer = Buffer.from(new Float32Array(vector).buffer);
      insertChunk.run(
        id, docId, chunk.ordinal, chunk.text, chunk.page ?? null, chunk.sheet ?? null,
        chunk.section ?? null, chunk.startOffset ?? null, chunk.endOffset ?? null,
        buffer, dim, now,
      );
      insertFts.run(id, tokenizeForFts(chunk.text));
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getChunks(db: DatabaseSync, docId: string): ChunkRecord[] {
  const rows = db.prepare('SELECT * FROM chunks WHERE doc_id = ? ORDER BY ordinal').all(docId) as Record<string, unknown>[];
  return rows.map(mapChunk);
}

export function searchFts(db: DatabaseSync, query: string, limit: number): FtsHit[] {
  const q = toFtsQuery(query);
  if (!q) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return db.prepare(`SELECT c.id AS chunkId, c.text, c.doc_id AS docId, c.ordinal, c.page, c.sheet, c.section,
      d.name AS docName, bm25(chunks_fts) AS raw
    FROM chunks_fts
    JOIN chunks c ON c.id = chunks_fts.chunk_id
    JOIN documents d ON d.id = c.doc_id
    WHERE chunks_fts MATCH ?
    -- bm25() is negative; ASC means most relevant first
    ORDER BY raw ASC
    LIMIT ?`).all(q, safeLimit) as FtsHit[];
}

export function deleteChunksByDoc(db: DatabaseSync, docId: string): void {
  db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(docId);
}

function mapChunk(row: Record<string, unknown>): ChunkRecord {
  const buffer = row.embedding as Uint8Array | null;
  const dim = row.dim == null ? null : Number(row.dim);
  if (buffer && (buffer.byteLength % 4 !== 0 || (dim !== null && buffer.byteLength !== dim * 4))) {
    throw new Error('corrupt embedding blob');
  }
  return {
    id: String(row.id), docId: String(row.doc_id), ordinal: Number(row.ordinal), text: String(row.text),
    page: row.page == null ? undefined : Number(row.page),
    sheet: row.sheet ? String(row.sheet) : undefined,
    section: row.section ? String(row.section) : undefined,
    startOffset: row.start_offset == null ? undefined : Number(row.start_offset),
    endOffset: row.end_offset == null ? undefined : Number(row.end_offset),
    embedding: buffer ? new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4) : undefined,
  };
}
