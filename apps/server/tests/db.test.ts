import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/db/database.js';

describe('database', () => {
  it('creates all tables and FTS5', () => {
    const db = openDatabase(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);
    expect(names).toContain('documents');
    expect(names).toContain('chunks');
    expect(names).toContain('chunks_fts');
    expect(names).toContain('runs');
    expect(names).toContain('run_events');
    expect(names).toContain('embedding_cache');
    expect(names).toContain('app_meta');
    db.close();
  });

  it('enforces unique document hash', () => {
    const db = openDatabase(':memory:');
    db.prepare("INSERT INTO documents(id,name,type,category,size,sha256,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run('d1', 'a', 'PDF', '制度', 1, 'hash', 'ready', 'now', 'now');
    expect(() => db.prepare("INSERT INTO documents(id,name,type,category,size,sha256,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run('d2', 'b', 'PDF', '制度', 1, 'hash', 'ready', 'now', 'now')).toThrow();
    db.close();
  });

  it('cleans up FTS rows when a chunk or document is deleted', () => {
    const db = openDatabase(':memory:');
    db.prepare("INSERT INTO documents(id,name,type,category,size,sha256,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run('d1', 'a.pdf', 'PDF', '制度', 1, 'hash-fts', 'ready', 'now', 'now');
    db.prepare("INSERT INTO chunks(id,doc_id,ordinal,text,created_at) VALUES (?,?,?,?,?)")
      .run('c1', 'd1', 0, '一线城市住宿 650 元', 'now');
    db.prepare("INSERT INTO chunks_fts(chunk_id,tokens) VALUES (?,?)")
      .run('c1', '一线 一线城市 住宿');
    db.prepare('DELETE FROM documents WHERE id = ?').run('d1');
    const count = (db.prepare('SELECT COUNT(*) AS c FROM chunks_fts').get() as { c: number }).c;
    expect(count).toBe(0);
    db.close();
  });

  it('migrates a file database once and reopens idempotently', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'officepilot-db-'));
    const file = path.join(dir, 'test.db');
    try {
      const db = openDatabase(file);
      expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(1);
      db.close();

      const reopened = openDatabase(file);
      expect((reopened.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode).toBe('wal');
      expect((reopened.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(1);
      reopened.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
