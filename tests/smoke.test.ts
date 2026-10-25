import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs on Node 24 with node:sqlite', async () => {
    expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(24);
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE t(a INTEGER)');
    db.prepare('INSERT INTO t VALUES (1)').run();
    expect(db.prepare('SELECT COUNT(*) AS c FROM t').get()).toEqual({ c: 1 });
    db.close();
  });
});
