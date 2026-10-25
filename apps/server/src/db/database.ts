import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.js';

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (row.user_version < 1) {
    db.exec(SCHEMA_SQL);
    db.exec('PRAGMA user_version = 1;');
  }
}
