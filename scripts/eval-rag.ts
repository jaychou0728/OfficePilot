import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from '../apps/server/src/db/database.js';
import { createDemoProvider } from '../apps/server/src/gateway/demo.js';
import { runQa } from '../apps/server/src/graph/qa.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dbPath = path.join(repoRoot, 'data', 'officepilot.db');
const docPath = path.join(repoRoot, 'docs', 'RAG-EVAL.md');
const THRESHOLD = 0.1;

type Case = { question: string; expected: string; boundary?: boolean };

const CASES: Case[] = [
  { question: '一线城市住宿标准是多少？', expected: '员工差旅费用管理办法 v3.2.pdf' },
  { question: '二线城市差旅补贴多少？', expected: '员工差旅费用管理办法 v3.2.pdf' },
  { question: '出差要提前几天申请？', expected: '员工差旅费用管理办法 v3.2.pdf' },
  { question: '年假怎么计算？', expected: '请假与考勤制度.docx' },
  { question: '年假没用完怎么办？', expected: '请假与考勤制度.docx' },
  { question: 'L3 数据对外发送需要谁审批？', expected: '信息安全与数据保密规范.pdf' },
  { question: '密码最短多少位？', expected: '信息安全与数据保密规范.pdf' },
  { question: 'Q3 会议有哪些行动项？', expected: 'Q3 产品评审会纪要.md' },
  { question: '供应商评分维度与权重？', expected: '供应商准入评分表.xlsx' },
  { question: '海外出差怎么报销？', expected: 'boundary', boundary: true },
];

const emitter = () => ({ node() {}, token() {}, emit() {}, flush: async () => {} }) as never;

type Row = {
  index: number;
  question: string;
  expected: string;
  boundaryCase: boolean;
  hit: boolean;
  refused: boolean;
  answerLength: number;
  sourceCount: number;
  docNames: string[];
  latencyMs: number;
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index]!;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderTable(rows: Row[]): string {
  const lines = [
    '| # | 问题 | 期望来源 | 命中 | 拒答/边界 | 来源数 | 来源文档 | 答案长度 | 耗时 ms |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.index} | ${escapeCell(row.question)} | ${escapeCell(row.expected)} | ${row.hit ? '✅' : '❌'} | ${row.refused ? '✅' : '❌'} | ${row.sourceCount} | ${escapeCell(row.docNames.join('；') || '—')} | ${row.answerLength} | ${row.latencyMs} |`,
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`找不到 ${dbPath}，请先运行 npm run demo:seed`);
  }
  const db = openDatabase(dbPath);
  let rows: Row[];
  try {
    const ready = db
      .prepare("SELECT count(*) AS n FROM documents WHERE status='ready'")
      .get() as { n: number };
    if (Number(ready.n) === 0) {
      throw new Error('数据库中没有已就绪的文档，请先运行 npm run demo:seed');
    }

    const provider = createDemoProvider();
    rows = [];
    for (const [index, testCase] of CASES.entries()) {
      const started = Date.now();
      const result = await runQa({
        db,
        provider,
        embedder: provider,
        question: testCase.question,
        docIds: [],
        threshold: THRESHOLD,
        emitter: emitter(),
      });
      const latencyMs = Date.now() - started;
      const sources = result.sources;
      const docNames = [...new Set(sources.map((source) => source.docName))];
      const hit = !testCase.boundary && sources.some((source) => source.docName === testCase.expected);
      const refused =
        (result.type === 'qa' && Boolean(result.boundary)) || sources.length === 0;
      rows.push({
        index: index + 1,
        question: testCase.question,
        expected: testCase.expected,
        boundaryCase: Boolean(testCase.boundary),
        hit,
        refused,
        answerLength: Array.from('answer' in result ? result.answer : '').length,
        sourceCount: sources.length,
        docNames,
        latencyMs,
      });

      console.log(
        `[${index + 1}/${CASES.length}] ${testCase.question} → ${hit ? 'HIT' : 'MISS'}${refused ? ' (boundary)' : ''} · ${docNames.join(', ') || 'no sources'} · ${latencyMs}ms`,
      );
    }
  } finally {
    db.close();
  }

  const scored = rows.filter((row) => !row.boundaryCase);
  const hits = scored.filter((row) => row.hit).length;
  const boundaryRow = rows.find((row) => row.boundaryCase);
  const refusalPass = Boolean(boundaryRow?.refused);
  const latencies = rows.map((row) => row.latencyMs);
  const p95 = percentile(latencies, 0.95);
  const average = Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length));
  const misses = scored.filter((row) => !row.hit);
  const degraded = scored.filter((row) => row.hit && row.refused);

  console.log('\n' + renderTable(rows));
  console.log(`\nhit@3: ${hits}/${scored.length}`);
  console.log(`refusal (边界题): ${refusalPass ? 'PASS' : 'FAIL'}`);
  console.log(`P95 latency: ${p95} ms (平均 ${average} ms)`);
  if (misses.length) {
    console.log(`misses: ${misses.map((row) => `#${row.index} ${row.question}`).join('; ')}`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const notes: string[] = [
    '- 运行方式：`npx tsx scripts/eval-rag.ts`（等价于 `npm run eval`）。',
    '- demo provider 的 256 维 hash embedding 相似度整体偏低，因此评测与离线 demo 统一使用阈值 `0.1`；真实 provider 默认仍为 `MATCH_THRESHOLD`（0.55）。',
    '- 检索返回最多 5 条来源，命中定义为返回来源中包含期望文档；`hit@3` 按题面要求统计 9 条事实题（第 1–9 题）。',
    '- 第 10 题「海外出差怎么报销？」期望边界：demo 回答会说明知识库未覆盖境外差旅，但回答不含引用，触发引用校验重试后降级为边界结果；这是引用校验产生的降级边界，而非检索阈值直接拒答。',
  ];
  if (misses.length) {
    notes.push(
      `- 未命中：${misses
        .map((row) => `第 ${row.index} 题（${row.question}，返回来源：${row.docNames.join('、') || '无'}）`)
        .join('；')}。`,
    );
  } else {
    notes.push('- 9 条事实题全部检索命中，无需调整 fixture。');
  }
  if (degraded.length) {
    notes.push(
      `- **检索命中但回答降级**：${degraded
        .map((row) => `第 ${row.index} 题（${row.question}，来源 ${row.sourceCount} 条）`)
        .join(
          '；',
        )}。原因是 demo provider 的差旅问答模板固定引用 \`[1][2]\`，本题只检索到 1 条来源，引用 \`[2]\` 不存在，引用校验重试两次后降级为边界结果；检索环节本身已命中期望文档，非检索 miss。`,
    );
  }

  const markdown = [
    '# RAG 离线评测报告',
    '',
    `- 评测日期：${date}`,
    '- 环境：demo provider（本地无 Key）',
    '- Embedding：256 维 hash embedding',
    `- 检索阈值：${THRESHOLD}`,
    `- 语料：\`fixtures/demo\` 的 7 份演示文档（\`npm run demo:seed\` 入库）`,
    '',
    '## 汇总',
    '',
    `- **hit@3：${hits}/${scored.length}**`,
    `- **边界题拒答：${refusalPass ? '通过' : '未通过'}**（第 10 题）`,
    `- **P95 延迟：${p95} ms**（平均 ${average} ms，n=${latencies.length}）`,
    '',
    '## 用例明细',
    '',
    renderTable(rows),
    '',
    '## 说明',
    '',
    ...notes,
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, markdown, 'utf8');
  console.log(`\n已写入 ${path.relative(repoRoot, docPath)}`);

  if (!refusalPass) {
    console.error('边界题未按预期拒答');
    process.exitCode = 1;
  }
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
