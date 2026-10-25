import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.js';

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA busy_timeout = 5000;');
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function migrate(db: DatabaseSync) {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  if (row.user_version >= 1) return;
  db.exec('BEGIN');
  try {
    db.exec(SCHEMA_SQL);
    db.exec('PRAGMA user_version = 1;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
