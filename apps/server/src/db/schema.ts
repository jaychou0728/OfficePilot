export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  file_path TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  stage TEXT,
  progress INTEGER DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  pages INTEGER,
  chunk_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  indexed_at TEXT
);

CREATE TABLE IF NOT EXISTS chunks(
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  page INTEGER,
  sheet TEXT,
  section TEXT,
  start_offset INTEGER,
  end_offset INTEGER,
  embedding BLOB,
  dim INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(doc_id, ordinal)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED,
  tokens,
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunks_after_delete_fts
AFTER DELETE ON chunks
BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
END;

CREATE TABLE IF NOT EXISTS runs(
  id TEXT PRIMARY KEY,
  skill TEXT NOT NULL,
  input TEXT NOT NULL,
  doc_ids TEXT,
  template_id TEXT,
  status TEXT NOT NULL,
  result TEXT,
  error_code TEXT,
  error_message TEXT,
  usage TEXT,
  timeline TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS run_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, seq)
);

CREATE TABLE IF NOT EXISTS embedding_cache(
  hash TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  dim INTEGER NOT NULL,
  vector BLOB NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
