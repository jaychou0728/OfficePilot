import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pptxgen from 'pptxgenjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const outFile = path.join(repoRoot, 'docs', 'OfficePilot-作品介绍.pptx');

const C = {
  ink: '1B1A17',
  paper: 'F4F1EA',
  accent: 'B8421D',
  ink3: '7A7468',
  card: 'FFFDF8',
  line: 'D8D1C3',
  soft: 'ECE6D9',
  green: '2E6B4F',
  amber: '96631B',
};

const CN = 'Microsoft YaHei';
const EN = 'Georgia';

const pptx = new pptxgen();
pptx.defineLayout({ name: 'OP_16x9', width: 13.333, height: 7.5 });
pptx.layout = 'OP_16x9';
pptx.author = 'OfficePilot';
pptx.company = '腾讯 AI Coding 课程作业';
pptx.subject = '智能办公助手 · 作品介绍';
pptx.title = 'OfficePilot 作品介绍';

function addText(slide, text, options = {}) {
  slide.addText(text, {
    fontFace: CN,
    color: C.ink,
    fontSize: 14,
    margin: 0,
    valign: 'mid',
    ...options,
  });
}

function addRich(slide, runs, options = {}) {
  slide.addText(
    runs.map(([text, opts = {}]) => ({ text, options: { fontFace: CN, color: C.ink, ...opts } })),
    { margin: 0, valign: 'mid', ...options },
  );
}

function addBox(slide, { x, y, w, h, fill = C.card, line = C.line, lineWidth = 1, radius = 0.04 }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: radius,
    fill: { color: fill },
    line: { color: line, width: lineWidth },
  });
}

function addLabelBox(slide, { x, y, w, h, title, sub, fill = C.card, titleColor = C.ink, accent = false }) {
  addBox(slide, { x, y, w, h, fill });
  if (accent) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w, h: 0.06, fill: { color: C.accent }, line: { color: C.accent, width: 0 },
    });
  }
  addText(slide, title, {
    x: x + 0.16, y: y + 0.14, w: w - 0.32, h: 0.32,
    fontSize: 13, bold: true, color: titleColor,
  });
  if (sub) {
    addText(slide, sub, {
      x: x + 0.16, y: y + 0.5, w: w - 0.32, h: h - 0.6,
      fontSize: 10, color: C.ink3, breakLine: false, valign: 'top',
    });
  }
}

function arrowRight(slide, { x, y, w = 0.36, color = C.accent }) {
  slide.addShape(pptx.ShapeType.rightArrow, {
    x, y, w, h: 0.16, fill: { color }, line: { color, width: 0 },
  });
}

function arrowDown(slide, { x, y, h = 0.32, color = C.ink3 }) {
  slide.addShape(pptx.ShapeType.downArrow, {
    x, y, w: 0.16, h, fill: { color }, line: { color, width: 0 },
  });
}

function addFooter(slide, page, label = 'OfficePilot · 2026-10-25') {
  addText(slide, label, {
    x: 0.7, y: 7.12, w: 6, h: 0.2, fontSize: 8, color: C.ink3,
  });
  addText(slide, String(page).padStart(2, '0'), {
    x: 12.3, y: 7.12, w: 0.35, h: 0.2,
    fontFace: EN, fontSize: 8, color: C.ink3, align: 'right',
  });
}

function addTitle(slide, kicker, title) {
  addText(slide, kicker, {
    x: 0.7, y: 0.34, w: 8, h: 0.24,
    fontSize: 9, color: C.accent, bold: true, charSpacing: 1.2,
  });
  addText(slide, title, {
    x: 0.7, y: 0.62, w: 11.9, h: 0.62,
    fontSize: 27, bold: true, color: C.ink,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.72, y: 1.24, w: 1.35, h: 0.05, fill: { color: C.accent }, line: { color: C.accent, width: 0 },
  });
}

function newSlide(bg = C.paper) {
  const slide = pptx.addSlide();
  slide.background = { color: bg };
  return slide;
}

// ---------------------------------------------------------------- 1 cover
{
  const slide = newSlide();
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.16, h: 7.5, fill: { color: C.ink }, line: { color: C.ink, width: 0 },
  });
  addText(slide, '腾讯 AI CODING 课程作业 · 方向二 AI 应用创新 · 场景 4 智能办公', {
    x: 0.9, y: 0.72, w: 10.8, h: 0.3, fontSize: 10, color: C.ink3, charSpacing: 0.6,
  });
  addText(slide, 'OfficePilot', {
    x: 0.86, y: 1.9, w: 9.4, h: 1.35, fontFace: EN, fontSize: 56, bold: true, color: C.ink,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.92, y: 3.38, w: 2.2, h: 0.06, fill: { color: C.accent }, line: { color: C.accent, width: 0 },
  });
  addText(slide, '本地优先的智能办公文档工作台', {
    x: 0.9, y: 3.62, w: 9.2, h: 0.6, fontSize: 24, bold: true, color: C.ink,
  });
  addText(slide, '把制度、会议纪要、表格和合同，变成可引用、可校验、可导出的办公结果。', {
    x: 0.9, y: 4.35, w: 8.4, h: 0.55, fontSize: 13, color: C.ink3,
  });

  addBox(slide, { x: 10.45, y: 1.9, w: 2.05, h: 2.05, fill: C.paper, line: C.ink, lineWidth: 1.2, radius: 0 });
  addText(slide, 'OP', {
    x: 10.45, y: 1.9, w: 2.05, h: 2.05, fontFace: EN, fontSize: 44, color: C.ink, align: 'center', valign: 'mid',
  });

  const chips = ['本地优先', '可引用', '可校验', '可导出'];
  chips.forEach((chip, index) => {
    const x = 0.9 + index * 1.55;
    addBox(slide, { x, y: 5.35, w: 1.4, h: 0.42, fill: index === 0 ? C.ink : C.card, line: index === 0 ? C.ink : C.line });
    addText(slide, chip, {
      x, y: 5.35, w: 1.4, h: 0.42, fontSize: 11,
      color: index === 0 ? C.paper : C.ink, align: 'center', bold: true,
    });
  });

  addText(slide, '2026-10-25 · feat/officepilot · Node 24 / Fastify 5 / React 19 / LangGraph', {
    x: 0.9, y: 6.62, w: 10.5, h: 0.26, fontSize: 9, color: C.ink3,
  });
  addFooter(slide, 1, '');
}

// ---------------------------------------------------------------- 2 scenario
{
  const slide = newSlide();
  addTitle(slide, '01 / WHY', '场景与痛点：文档很多，结果很少');

  addBox(slide, { x: 0.7, y: 1.55, w: 5.55, h: 4.95, fill: C.card });
  addText(slide, '星海科技 · 行政 / 项目团队', {
    x: 0.95, y: 1.8, w: 5.0, h: 0.35, fontSize: 16, bold: true,
  });
  addText(slide, '7 份制度、会议、表格与合同，散落在不同格式里。', {
    x: 0.95, y: 2.2, w: 4.9, h: 0.5, fontSize: 10.5, color: C.ink3,
  });

  const pains = [
    ['01', '找不到', '制度散落在 PDF / DOCX / 表格里，关键词搜不全，页码记不住。'],
    ['02', '不放心', '通用聊天模型答得很像，但给不出原文依据，错了也看不出来。'],
    ['03', '交不出', '会议行动项、周报、抽取结果还要手工整理，格式不统一。'],
  ];
  pains.forEach(([num, title, body], index) => {
    const y = 2.95 + index * 1.13;
    addText(slide, num, {
      x: 0.98, y, w: 0.55, h: 0.4, fontFace: EN, fontSize: 18, bold: true, color: C.accent,
    });
    addText(slide, title, {
      x: 1.55, y: y - 0.02, w: 1.2, h: 0.35, fontSize: 13, bold: true,
    });
    addText(slide, body, {
      x: 2.72, y: y - 0.02, w: 3.25, h: 0.72, fontSize: 10, color: C.ink3, valign: 'top',
    });
  });

  arrowRight(slide, { x: 6.38, y: 3.65, w: 0.5 });

  addBox(slide, { x: 7.0, y: 1.55, w: 5.6, h: 1.42, fill: C.card, accent: true });
  addText(slide, '找得到', { x: 7.2, y: 1.75, w: 2.0, h: 0.34, fontSize: 15, bold: true });
  addText(slide, '向量 + FTS5 混合检索，命中原文片段，附页码与相似度。', {
    x: 7.2, y: 2.12, w: 5.1, h: 0.55, fontSize: 10.5, color: C.ink3,
  });

  addBox(slide, { x: 7.0, y: 3.15, w: 5.6, h: 1.42, fill: C.card, accent: true });
  addText(slide, '说得准', { x: 7.2, y: 3.35, w: 2.0, h: 0.34, fontSize: 15, bold: true });
  addText(slide, '阈值过滤 + 引用校验 + 无依据拒答；回答中的 [n] 可回到原文。', {
    x: 7.2, y: 3.72, w: 5.1, h: 0.55, fontSize: 10.5, color: C.ink3,
  });

  addBox(slide, { x: 7.0, y: 4.75, w: 5.6, h: 1.42, fill: C.card, accent: true });
  addText(slide, '交得出', { x: 7.2, y: 4.95, w: 2.0, h: 0.34, fontSize: 15, bold: true });
  addText(slide, '结构化抽取 5 行表格 + 四段式周报，CSV / Markdown 直接导出。', {
    x: 7.2, y: 5.32, w: 5.1, h: 0.55, fontSize: 10.5, color: C.ink3,
  });

  addText(slide, '不是再做一个聊天框，而是把文档变成可验收的办公结果。', {
    x: 0.7, y: 6.62, w: 11.8, h: 0.34, fontSize: 12, italic: true, color: C.accent,
  });
  addFooter(slide, 2);
}

// ---------------------------------------------------------------- 3 product
{
  const slide = newSlide();
  addTitle(slide, '02 / PRODUCT', '一个工作台，三个技能');

  const cards = [
    {
      title: '制度问答 / 摘要',
      lines: [
        ['输入', '自然语言问题 + @ 文档'],
        ['处理', '混合检索 → 阈值 → 带引用生成'],
        ['输出', '流式回答 + [n] + 证据面板'],
        ['边界', '无依据拒答 / 转人工建议'],
      ],
    },
    {
      title: '文档抽取',
      lines: [
        ['输入', '@ 指定 1 份文档 + 字段模板'],
        ['处理', 'JSON 输出 → zod 逐行校验'],
        ['输出', '4 套模板 / 5 行会议行动项'],
        ['失败', '回灌错误重试 1 次'],
      ],
    },
    {
      title: '周报生成',
      lines: [
        ['输入', '最近 7 天或手动勾选文档'],
        ['处理', '逐份摘要 → 四段式组装'],
        ['输出', '本周完成 / 进行中 / 风险 / 下周'],
        ['导出', 'Markdown，保留来源与缺口'],
      ],
    },
  ];

  cards.forEach((card, index) => {
    const x = 0.7 + index * 4.12;
    addBox(slide, { x, y: 1.55, w: 3.82, h: 3.95, fill: C.card });
    slide.addShape(pptx.ShapeType.rect, {
      x, y: 1.55, w: 3.82, h: 0.07, fill: { color: C.accent }, line: { color: C.accent, width: 0 },
    });
    addText(slide, card.title, {
      x: x + 0.22, y: 1.78, w: 3.35, h: 0.4, fontSize: 16, bold: true,
    });
    card.lines.forEach(([label, body], lineIndex) => {
      const y = 2.38 + lineIndex * 0.72;
      addText(slide, label, {
        x: x + 0.22, y, w: 0.62, h: 0.24, fontSize: 9, bold: true, color: C.accent,
      });
      addText(slide, body, {
        x: x + 0.9, y: y - 0.03, w: 2.7, h: 0.5, fontSize: 10, color: C.ink3, valign: 'top',
      });
    });
  });

  const stats = [
    ['7', '演示文档'],
    ['6', '支持格式'],
    ['4', '抽取字段模板'],
    ['SSE', '事件可回放'],
  ];
  stats.forEach(([num, label], index) => {
    const x = 0.7 + index * 3.08;
    addBox(slide, { x, y: 5.82, w: 2.85, h: 0.82, fill: index === 3 ? C.ink : C.soft, line: index === 3 ? C.ink : C.line });
    addText(slide, num, {
      x: x + 0.18, y: 5.9, w: 0.9, h: 0.6,
      fontFace: EN, fontSize: 20, bold: true, color: index === 3 ? C.paper : C.accent,
    });
    addText(slide, label, {
      x: x + 1.05, y: 5.98, w: 1.6, h: 0.45, fontSize: 10,
      color: index === 3 ? C.paper : C.ink3,
    });
  });

  addFooter(slide, 3);
}

// ---------------------------------------------------------------- 4 architecture
{
  const slide = newSlide();
  addTitle(slide, '03 / ARCHITECTURE', '三层架构：工作台 / API / 模型与存储');

  addLabelBox(slide, {
    x: 0.7, y: 1.65, w: 3.3, h: 1.55,
    title: 'React 工作台',
    sub: '文档库 · 对话 · @ 引用\n证据 / 结果 / 执行链路\nREST + EventSource',
    fill: C.card, accent: true,
  });
  arrowRight(slide, { x: 4.08, y: 2.34, w: 0.42 });
  addText(slide, 'REST + SSE', {
    x: 4.0, y: 1.98, w: 0.9, h: 0.22, fontSize: 8, color: C.ink3, align: 'center',
  });

  addLabelBox(slide, {
    x: 4.68, y: 1.65, w: 3.55, h: 1.55,
    title: 'Fastify API',
    sub: 'documents / runs / health / openapi\n入库串行队列 · 运行管理\nSSE 事件回放',
    fill: C.card, accent: true,
  });
  arrowRight(slide, { x: 8.32, y: 2.34, w: 0.42 });

  addLabelBox(slide, {
    x: 8.92, y: 1.65, w: 3.7, h: 1.55,
    title: 'LangGraph + RAG',
    sub: 'router → qa / summary / extract / weekly\n混合检索 · 引用校验 · 阈值边界',
    fill: C.card, accent: true,
  });

  arrowDown(slide, { x: 6.37, y: 3.25, h: 0.5 });
  addLabelBox(slide, {
    x: 4.68, y: 3.8, w: 3.55, h: 1.15,
    title: '模型网关',
    sub: 'OpenAI 兼容直连 / 代理\n兜底 provider / demo provider',
    fill: C.soft,
  });

  arrowDown(slide, { x: 10.68, y: 3.25, h: 0.5 });
  addLabelBox(slide, {
    x: 8.92, y: 3.8, w: 3.7, h: 1.15,
    title: 'SQLite · node:sqlite',
    sub: 'documents / chunks / FTS5 / 向量\nruns / run_events / embedding_cache',
    fill: C.soft,
  });

  addBox(slide, { x: 0.7, y: 5.35, w: 11.92, h: 1.12, fill: C.ink, line: C.ink });
  addText(slide, '关键取舍', {
    x: 0.95, y: 5.5, w: 1.2, h: 0.28, fontSize: 10, bold: true, color: C.paper,
  });
  addText(slide, 'TS 全栈共享 zod 契约 · node:sqlite 零原生依赖 · 运行 + 事件表 + SSE 可恢复 · 串行队列避免本地写竞争', {
    x: 2.05, y: 5.48, w: 10.2, h: 0.5, fontSize: 11, color: C.paper,
  });
  addText(slide, '默认只监听 127.0.0.1；无鉴权，定位本地演示。', {
    x: 2.05, y: 5.92, w: 10.2, h: 0.3, fontSize: 9, color: 'C9C2B4',
  });

  addFooter(slide, 4);
}

// ---------------------------------------------------------------- 5 RAG
{
  const slide = newSlide();
  addTitle(slide, '04 / RAG', 'RAG 管线：先检索，再回答，最后校验');

  const row1 = [
    ['解析', 'unpdf / mammoth / exceljs'],
    ['切块', '800 字 / 120 重叠'],
    ['Embedding', '真实模型或 256 维 demo'],
    ['FTS5', '中文 bigram 索引'],
  ];
  const row2 = [
    ['混合检索', '0.75 vector + 0.25 BM25'],
    ['阈值过滤', 'demo 0.1 / real 0.55'],
    ['带引用生成', '每段结论附 [n]'],
    ['引用校验', '编号 / 日期 / 数字'],
  ];

  const drawRow = (items, y, startAccent = false) => {
    items.forEach(([title, sub], index) => {
      const w = 2.72;
      const x = 0.7 + index * 3.1;
      addBox(slide, { x, y, w, h: 0.95, fill: index === items.length - 1 && startAccent ? C.ink : C.card });
      addText(slide, `${String(index + 1).padStart(2, '0')} ${title}`, {
        x: x + 0.16, y: y + 0.13, w: w - 0.32, h: 0.3, fontSize: 12, bold: true,
        color: index === items.length - 1 && startAccent ? C.paper : C.ink,
      });
      addText(slide, sub, {
        x: x + 0.16, y: y + 0.48, w: w - 0.32, h: 0.3, fontSize: 9,
        color: index === items.length - 1 && startAccent ? 'C9C2B4' : C.ink3,
      });
      if (index < items.length - 1) {
        arrowRight(slide, { x: x + w + 0.08, y: y + 0.4, w: 0.18, color: C.ink3 });
      }
    });
  };

  drawRow(row1, 1.55, false);
  // wrap arrow from row 1 end to row 2 start
  slide.addShape(pptx.ShapeType.downArrow, {
    x: 12.0, y: 2.62, w: 0.16, h: 0.36, fill: { color: C.ink3 }, line: { color: C.ink3, width: 0 },
  });
  drawRow(row2, 3.12, true);

  addBox(slide, { x: 0.7, y: 4.45, w: 8.5, h: 0.7, fill: C.soft, line: C.line });
  addText(slide, '校验失败 → 回灌错误重试 ≤ 2 次 → 仍失败降级为「无法确认」；没有来源则不调用生成。', {
    x: 0.92, y: 4.56, w: 8.1, h: 0.46, fontSize: 10.5, color: C.ink3,
  });

  const metrics = [
    ['9/9', 'hit@3（9 条事实题）'],
    ['PASS', '第 10 题边界拒答'],
    ['233 ms', 'P95（demo provider）'],
    ['≤ 5', '返回来源条数'],
  ];
  metrics.forEach(([num, label], index) => {
    const x = 9.45;
    const y = 4.28 + index * 0.58;
    addText(slide, num, {
      x, y, w: 0.95, h: 0.35, fontFace: EN, fontSize: 15, bold: true, color: C.accent, align: 'right',
    });
    addText(slide, label, {
      x: x + 1.05, y, w: 2.1, h: 0.35, fontSize: 9, color: C.ink3,
    });
  });

  addText(slide, '“引用必须能回到原文；没有依据就拒答。”', {
    x: 0.7, y: 6.45, w: 11.8, h: 0.36, fontSize: 14, italic: true, color: C.accent,
  });

  addFooter(slide, 5);
}

// ---------------------------------------------------------------- 6 graph
{
  const slide = newSlide();
  addTitle(slide, '05 / LANGGRAPH', '显式状态图 + 可恢复的运行事件');

  // START -> router
  addBox(slide, { x: 0.7, y: 3.12, w: 0.95, h: 0.6, fill: C.ink, line: C.ink });
  addText(slide, 'START', {
    x: 0.7, y: 3.12, w: 0.95, h: 0.6, fontFace: EN, fontSize: 11, bold: true, color: C.paper, align: 'center',
  });
  arrowRight(slide, { x: 1.7, y: 3.34, w: 0.28 });
  addLabelBox(slide, {
    x: 2.06, y: 3.02, w: 1.45, h: 0.8, title: 'router', sub: '规则 + 技能', fill: C.card, accent: true,
  });

  // branch bus
  slide.addShape(pptx.ShapeType.line, {
    x: 3.72, y: 3.42, w: 0.36, h: 0, line: { color: C.ink3, width: 1.2, endArrowType: 'triangle' },
  });
  slide.addShape(pptx.ShapeType.line, {
    x: 4.08, y: 1.78, w: 0, h: 3.3, line: { color: C.line, width: 1.2 },
  });

  const branches = [
    ['qa', 'retrieve → answer\nvalidate → retry', 1.5, C.accent],
    ['summary', 'loadDoc → map-reduce', 2.75, C.ink3],
    ['extract', 'JSON → zod → retry', 4.0, C.ink3],
    ['weekly', 'collect → compose', 5.25, C.ink3],
  ];
  branches.forEach(([name, sub, y, color]) => {
    slide.addShape(pptx.ShapeType.line, {
      x: 4.08, y: y + 0.33, w: 0.38, h: 0, line: { color: C.ink3, width: 1, endArrowType: 'triangle' },
    });
    addLabelBox(slide, {
      x: 4.55, y, w: 2.5, h: 0.72, title: name, sub, fill: C.card,
    });
    // highlight qa
    if (name === 'qa') {
      slide.addShape(pptx.ShapeType.rect, {
        x: 4.55, y, w: 0.05, h: 0.72, fill: { color }, line: { color, width: 0 },
      });
    }
  });

  // QA retry loop annotation
  addBox(slide, { x: 4.55, y: 6.15, w: 5.2, h: 0.62, fill: C.soft, line: C.line });
  addText(slide, 'qa 内部：检索无来源 → boundary；校验失败 → 重试 ≤ 2 → 降级', {
    x: 4.72, y: 6.24, w: 4.9, h: 0.44, fontSize: 9, color: C.ink3,
  });

  // right engineering bullets
  addText(slide, '工程化不是附属品', {
    x: 7.75, y: 1.55, w: 4.8, h: 0.34, fontSize: 11, bold: true, color: C.accent,
  });
  const bullets = [
    ['run_events(seq)', '每条 node / token / citation 落库；SSE 的 id 就是 seq。'],
    ['Last-Event-ID', '断线从 seq > lastId 补发；页面刷新用 GET /api/runs/:id 对账。'],
    ['embedding_cache', '按 model + dim + 文本 hash 复用；维度不一致直接拒绝。'],
    ['串行队列', '入库与运行并发 1，避免 SQLite 写竞争与限流。'],
    ['zod + 重试', '抽取 JSON 失败回灌错误；仍失败返回告警，不填假值。'],
  ];
  bullets.forEach(([title, body], index) => {
    const y = 2.0 + index * 0.9;
    addText(slide, title, {
      x: 7.78, y, w: 4.7, h: 0.28, fontSize: 11, bold: true,
    });
    addText(slide, body, {
      x: 7.78, y: y + 0.3, w: 4.7, h: 0.46, fontSize: 9, color: C.ink3, valign: 'top',
    });
  });

  addText(slide, '图不是画给 PPT 看的：router 条件边、qa 校验循环、extract schema 重试，都在代码里有对应实现。', {
    x: 0.7, y: 6.55, w: 11.8, h: 0.3, fontSize: 10, italic: true, color: C.ink3,
  });

  addFooter(slide, 6);
}

// ---------------------------------------------------------------- 7 demo/results
{
  const slide = newSlide();
  addTitle(slide, '06 / DEMO & RESULTS', '6 分钟演示路径与实测结果');

  addText(slide, '现场路径', {
    x: 0.7, y: 1.5, w: 5.2, h: 0.3, fontSize: 11, bold: true, color: C.accent,
  });

  const steps = [
    ['01', '文档库', '7 份文档 / 分类 / 入库状态'],
    ['02', '制度问答', '问 650，流式回答 + [1]'],
    ['03', '引用定位', '点 [1]，右侧证据高亮'],
    ['04', '回答边界', '海外差旅 → 转人工卡'],
    ['05', '结构化抽取', '@Q3 → 5 行行动项 → CSV'],
    ['06', '周报生成', '四段式 → Markdown'],
  ];
  steps.forEach(([num, title, body], index) => {
    const y = 1.92 + index * 0.72;
    addText(slide, num, {
      x: 0.72, y, w: 0.45, h: 0.3, fontFace: EN, fontSize: 11, bold: true, color: C.accent,
    });
    addText(slide, title, {
      x: 1.25, y, w: 1.5, h: 0.3, fontSize: 11, bold: true,
    });
    addText(slide, body, {
      x: 2.8, y, w: 3.1, h: 0.3, fontSize: 9, color: C.ink3,
    });
  });
  addText(slide, '最后切「执行链路」：Router → Retrieve → Generate → Validate 的真实耗时与重试。', {
    x: 0.72, y: 6.3, w: 5.3, h: 0.34, fontSize: 9, color: C.ink3,
  });

  // metrics grid
  const metrics = [
    ['162', '单元 / 集成测试'],
    ['41', '测试文件'],
    ['0', 'typecheck 错误'],
    ['6/6', 'Playwright E2E'],
    ['9/9', 'RAG hit@3'],
    ['PASS', '边界拒答'],
  ];
  metrics.forEach(([num, label], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 7.45 + col * 1.86;
    const y = 1.7 + row * 1.55;
    addBox(slide, { x, y, w: 1.7, h: 1.32, fill: C.card, line: C.line });
    addText(slide, num, {
      x: x + 0.1, y: y + 0.2, w: 1.5, h: 0.52,
      fontFace: EN, fontSize: 23, bold: true, color: C.accent, align: 'center',
    });
    addText(slide, label, {
      x: x + 0.08, y: y + 0.82, w: 1.54, h: 0.28, fontSize: 8.5, color: C.ink3, align: 'center',
    });
  });

  addBox(slide, { x: 7.45, y: 4.9, w: 5.4, h: 1.15, fill: C.ink, line: C.ink });
  addText(slide, '构建 / 启动', {
    x: 7.65, y: 5.02, w: 1.2, h: 0.25, fontSize: 9, bold: true, color: C.paper,
  });
  addText(slide, 'npm run build  →  server 83.9 KB + web 303.3 KB\nnpm start  →  /api/health ok · / 返回 HTML · /docs 200', {
    x: 7.65, y: 5.3, w: 5.0, h: 0.62, fontSize: 8.5, color: 'C9C2B4', valign: 'top',
  });

  addText(slide, '数字来自 docs/TEST-REPORT.md；演示命令 npm run demo → http://127.0.0.1:5173', {
    x: 0.7, y: 6.78, w: 11.8, h: 0.24, fontSize: 8.5, color: C.ink3,
  });

  addFooter(slide, 7);
}

// ---------------------------------------------------------------- 8 delivery
{
  const slide = newSlide();
  addTitle(slide, '07 / DELIVERY', '交付清单与边界');

  addText(slide, '已交付', {
    x: 0.7, y: 1.55, w: 5.6, h: 0.3, fontSize: 11, bold: true, color: C.accent,
  });
  const deliverables = [
    'README · 产品说明与快速开始',
    'ARCHITECTURE · 组件 / 数据流 / 状态图',
    'API · 端点、SSE、错误码',
    'RAG-EVAL · 10 题评测明细',
    'TEST-REPORT · 162 测试 / E2E / 评测',
    'ACCEPTANCE · 12 项验收状态',
    'AI-CODING-LOG · 76 个提交与缺陷记录',
    'DEMO-SCRIPT · 6 分钟话术与兜底',
    'Dockerfile / .dockerignore / DEPLOY',
    '作品介绍 PPT（8 页）',
  ];
  deliverables.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.72 + col * 3.48;
    const y = 1.95 + row * 0.68;
    addText(slide, '·', {
      x, y, w: 0.18, h: 0.3, fontSize: 14, bold: true, color: C.accent,
    });
    addText(slide, item, {
      x: x + 0.2, y, w: 3.1, h: 0.42, fontSize: 9.5,
    });
  });

  addBox(slide, { x: 7.55, y: 1.52, w: 5.05, h: 3.65, fill: C.card, line: C.line });
  addText(slide, '边界与未验证', {
    x: 7.78, y: 1.7, w: 4.5, h: 0.3, fontSize: 11, bold: true, color: C.amber,
  });
  const limits = [
    '扫描件 PDF 不支持，需先 OCR',
    '无鉴权 / 单用户，默认只监听 127.0.0.1',
    'mock / demo provider 与真实模型质量不同',
    '演示阈值 0.1，真实默认 0.55',
    'Docker 本机未安装，未构建 / 未运行',
    '演示录屏与现场彩排未完成',
  ];
  limits.forEach((item, index) => {
    addText(slide, '—', {
      x: 7.78, y: 2.12 + index * 0.48, w: 0.24, h: 0.3, fontSize: 10, color: C.amber,
    });
    addText(slide, item, {
      x: 8.05, y: 2.12 + index * 0.48, w: 4.3, h: 0.34, fontSize: 9, color: C.ink3,
    });
  });

  addBox(slide, { x: 0.7, y: 4.72, w: 6.5, h: 1.3, fill: C.ink, line: C.ink });
  addText(slide, 'AI 输出不是结论', {
    x: 0.92, y: 4.9, w: 2.4, h: 0.3, fontSize: 11, bold: true, color: C.paper,
  });
  addText(slide, '测试、typecheck、构建、E2E、评测、真实启动共同验收；缺陷被抓到并记录。', {
    x: 0.92, y: 5.28, w: 6.0, h: 0.5, fontSize: 9.5, color: 'C9C2B4', valign: 'top',
  });

  addText(slide, '“让模型有依据地说；说错能发现；没依据就拒答。”', {
    x: 0.7, y: 6.35, w: 11.8, h: 0.4, fontSize: 16, italic: true, color: C.accent,
  });
  addText(slide, 'OfficePilot · 星海科技办公工作台 · 2026-10-25', {
    x: 0.7, y: 6.82, w: 8, h: 0.24, fontSize: 8.5, color: C.ink3,
  });

  addFooter(slide, 8, '');
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
await pptx.writeFile({ fileName: outFile });
console.log(`Wrote ${path.relative(repoRoot, outFile)}`);
