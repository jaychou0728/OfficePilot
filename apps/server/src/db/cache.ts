import type { DatabaseSync } from 'node:sqlite';

export function getCachedEmbedding(db: DatabaseSync, hash: string, model: string, dim: number): Float32Array | null {
  const row = db.prepare('SELECT vector FROM embedding_cache WHERE hash=? AND model=? AND dim=?')
    .get(hash, model, dim) as { vector: Uint8Array } | undefined;
  if (!row) return null;
  return new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4);
}

export function putCachedEmbedding(db: DatabaseSync, hash: string, model: string, dim: number, vector: number[]): void {
  if (dim <= 0 || vector.length !== dim || vector.some((value) => !Number.isFinite(value))) {
    throw new Error('invalid embedding vector');
  }
  const buffer = Buffer.from(new Float32Array(vector).buffer);
  db.prepare('INSERT OR REPLACE INTO embedding_cache(hash,model,dim,vector,created_at) VALUES (?,?,?,?,?)')
    .run(hash, model, dim, buffer, new Date().toISOString());
}
