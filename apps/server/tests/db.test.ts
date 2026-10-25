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
});
