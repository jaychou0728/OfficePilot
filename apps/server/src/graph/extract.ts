import type { DatabaseSync } from 'node:sqlite';
import type { RunResult, TemplateId } from '@officepilot/shared';
import type { ChatProvider } from '../gateway/types.js';
import type { RunEmitter } from './emitter.js';
import { getChunks } from '../db/chunks.js';
import { getDocument } from '../db/documents.js';
import { extractStructured } from './nodes/extract.js';

export async function runExtract(input: {
  db: DatabaseSync; provider: ChatProvider; docId: string; templateId: TemplateId; emitter: RunEmitter;
}): Promise<RunResult> {
  input.emitter.node('parseDoc', 'done', 50, '读取文档块');
  const chunks = getChunks(input.db, input.docId);
  const text = chunks.map((chunk) => chunk.text).join('\n\n');
  input.emitter.node('extract', 'running');
  const { rows, errors } = await extractStructured({
    provider: input.provider, templateId: input.templateId, documentText: text, emitter: input.emitter,
  });
  input.emitter.node('extract', errors.length ? 'fail' : 'done', 800, errors.join('; ') || `抽取 ${rows.length} 条`);
  const docName = getDocument(input.db, input.docId)?.name ?? input.docId;
  const sources = chunks.slice(0, 3).map((chunk, index) => ({
    n: index + 1, docId: input.docId, docName, chunkId: chunk.id,
    page: chunk.page ?? null, score: 0.8, snippet: chunk.text.slice(0, 240),
  }));
  return { type: 'extract', templateId: input.templateId, rows: rows as Array<Record<string, unknown>>, warnings: errors, sources };
}
