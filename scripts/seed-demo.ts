import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AppError, type DocumentCategory } from '@officepilot/shared';
import { loadConfig } from '../apps/server/src/config.js';
import { openDatabase } from '../apps/server/src/db/database.js';
import { getDocument } from '../apps/server/src/db/documents.js';
import { createDemoProvider } from '../apps/server/src/gateway/demo.js';
import { createOpenAiProvider } from '../apps/server/src/gateway/openai.js';
import { createDocumentService } from '../apps/server/src/ingest/service.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixturesDir = path.join(repoRoot, 'fixtures', 'demo');

const FIXTURES: Array<{ name: string; category: DocumentCategory }> = [
  { name: '员工差旅费用管理办法 v3.2.pdf', category: '制度' },
  { name: '信息安全与数据保密规范.pdf', category: '制度' },
  { name: '请假与考勤制度.docx', category: '制度' },
  { name: 'Q3 产品评审会纪要.md', category: '会议' },
  { name: '供应商准入评分表.xlsx', category: '表格' },
  { name: '2026 年度培训与预算计划.docx', category: '制度' },
  { name: '采购合同模板.docx', category: '合同' },
];

async function main(): Promise<void> {
  const dataDir = path.resolve(process.env.DATA_DIR ?? 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(path.join(dataDir, 'officepilot.db'));
  const config = loadConfig(process.env);
  const provider = config.LLM_PROVIDER === 'mock'
    ? createDemoProvider()
    : createOpenAiProvider({
        baseUrl: config.EMBEDDING_BASE_URL || config.LLM_BASE_URL,
        apiKey: config.EMBEDDING_API_KEY || config.LLM_API_KEY,
        model: config.EMBEDDING_MODEL || config.LLM_MODEL,
        timeoutMs: config.EMBEDDING_TIMEOUT_MS,
      });
  console.log(`Embedding provider: ${provider.name} / ${provider.model}`);
  const fileLoader = async (docId: string) => {
    const doc = getDocument(db, docId);
    if (!doc?.filePath) throw new Error('missing');
    return fs.promises.readFile(doc.filePath);
  };
  const service = createDocumentService({ db, dataDir, ingest: { db, provider, fileLoader } });

  let seeded = 0;
  try {
    for (const fixture of FIXTURES) {
      const buffer = fs.readFileSync(path.join(fixturesDir, fixture.name));
      let docId: string;
      try {
        const doc = await service.upload({ name: fixture.name, buffer, category: fixture.category });
        docId = doc.id;
      } catch (error) {
        if (error instanceof AppError && error.code === 'DOC_DUPLICATE') {
          console.log(`skip duplicate: ${fixture.name}`);
          continue;
        }
        throw error;
      }
      await service.idle();
      const doc = getDocument(db, docId);
      if (doc?.status !== 'ready') {
        throw new Error(`seed failed: ${fixture.name} (${doc?.status ?? 'missing'}) ${doc?.errorMessage ?? ''}`.trim());
      }
      seeded += 1;
    }
    console.log(`Seeded ${seeded} documents`);
  } finally {
    db.close();
  }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
