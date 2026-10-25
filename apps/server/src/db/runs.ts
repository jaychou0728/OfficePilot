import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Skill, TemplateId } from '@officepilot/shared';

export type RunRow = {
  id: string; skill: Skill; input: string; docIds: string[]; templateId: TemplateId | null;
  status: string; result: unknown; errorCode: string | null; errorMessage: string | null;
  usage: unknown; timeline: unknown; createdAt: string; finishedAt: string | null;
};

export type RunEventRow = { seq: number; type: string; payload: unknown };

export function createRun(db: DatabaseSync, input: {
  skill: Skill; input: string; docIds: string[]; templateId?: TemplateId | null;
}): RunRow {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO runs(id,skill,input,doc_ids,template_id,status,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, input.skill, input.input, JSON.stringify(input.docIds), input.templateId ?? null, 'queued', now);
  return getRun(db, id)!;
}

/** Appends the next event for a run, allocating seq atomically; returns the assigned seq. */
export function appendRunEvent(db: DatabaseSync, runId: string, type: string, payload: unknown): number {
  const inTransaction = (db as DatabaseSync & { isTransaction?: boolean }).isTransaction === true;
  if (!inTransaction) db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS next FROM run_events WHERE run_id=?')
      .get(runId) as { next: number };
    db.prepare('INSERT INTO run_events(run_id,seq,type,payload,created_at) VALUES (?,?,?,?,?)')
      .run(runId, row.next, type, JSON.stringify(payload), new Date().toISOString());
    if (!inTransaction) db.exec('COMMIT');
    return row.next;
  } catch (error) {
    if (!inTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

/** Returns events with seq strictly greater than the given cursor, ordered ascending (SSE replay). */
export function getEventsAfter(db: DatabaseSync, runId: string, seq: number): RunEventRow[] {
  const rows = db.prepare('SELECT seq,type,payload FROM run_events WHERE run_id=? AND seq>? ORDER BY seq')
    .all(runId, seq) as Array<{ seq: number; type: string; payload: string }>;
  return rows.map((row) => ({ seq: row.seq, type: row.type, payload: JSON.parse(row.payload) }));
}

export function getRun(db: DatabaseSync, id: string): RunRow | null {
  const row = db.prepare('SELECT * FROM runs WHERE id=?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const nodeRows = db.prepare("SELECT payload FROM run_events WHERE run_id=? AND type='node' ORDER BY seq")
    .all(id) as Array<{ payload: string }>;
  const timeline = nodeRows.map((row) => JSON.parse(row.payload));
  return {
    id: String(row.id), skill: row.skill as Skill, input: String(row.input),
    docIds: JSON.parse(String(row.doc_ids ?? '[]')),
    templateId: (row.template_id as TemplateId | null) ?? null,
    status: String(row.status),
    result: row.result ? JSON.parse(String(row.result)) : null,
    errorCode: row.error_code ? String(row.error_code) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    usage: row.usage ? JSON.parse(String(row.usage)) : null,
    timeline,
    createdAt: String(row.created_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

export function markRunRunning(db: DatabaseSync, id: string): void {
  db.prepare("UPDATE runs SET status='running' WHERE id=?").run(id);
}

export function finishRun(
  db: DatabaseSync, id: string, status: 'succeeded' | 'failed', result: unknown, usage: unknown,
): void {
  db.prepare('UPDATE runs SET status=?, result=?, usage=?, error_code=NULL, error_message=NULL, finished_at=? WHERE id=?')
    .run(status, JSON.stringify(result ?? null), JSON.stringify(usage ?? null), new Date().toISOString(), id);
}

export function failRun(db: DatabaseSync, id: string, code: string, message: string): void {
  db.prepare('UPDATE runs SET status=?, error_code=?, error_message=?, finished_at=? WHERE id=?')
    .run('failed', code, message, new Date().toISOString(), id);
}
