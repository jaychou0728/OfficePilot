import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { DocumentCategory, DocumentStatus, DocumentType } from '@officepilot/shared';

export type DocumentRow = {
  id: string; name: string; type: DocumentType; category: DocumentCategory;
  size: number; sha256: string; status: DocumentStatus; stage: string | null;
  progress: number; errorCode: string | null; errorMessage: string | null;
  pages: number | null; chunkCount: number; filePath: string;
  createdAt: string; updatedAt: string; indexedAt: string | null;
};

export function createDocument(db: DatabaseSync, input: {
  name: string; type: DocumentType; category: DocumentCategory; size: number; sha256: string; filePath: string;
}): DocumentRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO documents(id,name,type,category,file_path,size,sha256,status,stage,progress,chunk_count,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, input.name, input.type, input.category, input.filePath, input.size, input.sha256,
    'queued', '排队中', 0, 0, now, now,
  );
  return getDocument(db, id)!;
}

export function getDocument(db: DatabaseSync, id: string): DocumentRow | null {
  const row = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function listDocuments(db: DatabaseSync): DocumentRow[] {
  return (db.prepare('SELECT * FROM documents ORDER BY created_at DESC').all() as Record<string, unknown>[]).map(mapRow);
}

export function findDocumentByHash(db: DatabaseSync, sha256: string): DocumentRow | null {
  const row = db.prepare('SELECT * FROM documents WHERE sha256 = ?').get(sha256) as Record<string, unknown> | undefined;
  return row ? mapRow(row) : null;
}

export function updateDocumentStatus(db: DatabaseSync, id: string, patch: {
  status: DocumentStatus; stage?: string; progress?: number; chunkCount?: number; errorCode?: string; errorMessage?: string;
}): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE documents SET status=?, stage=COALESCE(?,stage), progress=COALESCE(?,progress),
    chunk_count=COALESCE(?,chunk_count), error_code=?, error_message=?, updated_at=?,
    indexed_at=CASE WHEN ?='ready' THEN ? ELSE indexed_at END WHERE id=?`)
    .run(
      patch.status, patch.stage ?? null, patch.progress ?? null, patch.chunkCount ?? null,
      patch.errorCode ?? null, patch.errorMessage ?? null, now, patch.status, now, id,
    );
}

export function updateDocumentFilePath(db: DatabaseSync, id: string, filePath: string): void {
  db.prepare('UPDATE documents SET file_path=?, updated_at=? WHERE id=?').run(filePath, new Date().toISOString(), id);
}

export function updateDocumentHash(db: DatabaseSync, id: string, sha256: string): void {
  db.prepare('UPDATE documents SET sha256=?, updated_at=? WHERE id=?').run(sha256, new Date().toISOString(), id);
}

export function deleteDocument(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

function mapRow(row: Record<string, unknown>): DocumentRow {
  return {
    id: String(row.id), name: String(row.name), type: row.type as DocumentType,
    category: row.category as DocumentCategory, size: Number(row.size), sha256: String(row.sha256),
    status: row.status as DocumentStatus, stage: row.stage ? String(row.stage) : null,
    progress: Number(row.progress ?? 0), errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    pages: row.pages == null ? null : Number(row.pages), chunkCount: Number(row.chunk_count ?? 0),
    filePath: String(row.file_path ?? ''),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    indexedAt: row.indexed_at ? String(row.indexed_at) : null,
  };
}
