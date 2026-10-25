import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase } from '../src/db/database.js';
import { createDocument, updateDocumentStatus } from '../src/db/documents.js';
import { insertChunks } from '../src/db/chunks.js';
import { parseWeeklySections, runWeekly } from '../src/graph/weekly.js';
import type { ChatProvider } from '../src/gateway/types.js';

let db: ReturnType<typeof openDatabase>;
beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} } as never);

const WEEKLY_TEXT = [
  '本周完成',
  '- a',
  '进行中',
  '- b',
  '风险与阻塞',
  '- c',
  '下周计划',
  '- d',
].join('\n');

const weeklyProvider = (text: string): ChatProvider => ({
  name: 'weekly-stub',
  async *stream() {},
  async complete() { return text; },
});

describe('weekly graph', () => {
  it('parses the four weekly sections', () => {
    const sections = parseWeeklySections('本周完成\n- a\n进行中\n- b\n风险与阻塞\n- c\n下周计划\n- d');
    expect(sections).toHaveLength(4);
    expect(sections.map((section) => section.heading)).toEqual(['本周完成', '进行中', '风险与阻塞', '下周计划']);
    expect(sections.map((section) => section.items)).toEqual([['a'], ['b'], ['c'], ['d']]);
  });

  it('composes a weekly report with sources from each document', async () => {
    const doc = createDocument(db, { name: '周报.md', type: 'MD', category: '会议', size: 1, sha256: 'h', filePath: 'x' });
    updateDocumentStatus(db, doc.id, { status: 'ready', progress: 100, chunkCount: 1 });
    insertChunks(db, doc.id, [{ ordinal: 0, text: '本周完成差旅制度整理', page: 1 }], [[1, 0]]);

    const result = await runWeekly({
      db, provider: weeklyProvider(WEEKLY_TEXT), docIds: [doc.id], emitter: emitter(),
    });

    expect(result.type).toBe('weekly');
    if (result.type !== 'weekly') throw new Error('unreachable');
    expect(result.sections).toHaveLength(4);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].docName).toBe('周报.md');
  });
});
