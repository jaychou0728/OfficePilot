# OfficePilot

**本地优先的智能办公文档工作台。** 把制度、会议纪要、表格和合同等零散资料，变成**可引用、可校验、可导出**的办公结果。

面向中小企业行政 / 项目团队的演示场景（虚构公司「星海科技」），一条命令即可在本地跑通「上传 → 解析 → 入库 → 检索 → 问答 / 摘要 / 抽取 / 周报」全链路。断网时可切换到脚本化 demo provider 完整演示。

> 腾讯 AI Coding 课程作业 · 方向二 AI 应用创新 · 场景 4 智能办公 / 自动化办公助手

---

## 能做什么

- **制度问答**：混合检索（向量 + SQLite FTS5）→ 阈值过滤 → 带引用流式生成 → 引用校验。回答中的 `[n]` 可点击定位到右侧「证据」中的原文片段、页码与相似度。
- **回答边界**：知识库覆盖不到的问题不硬答。低于阈值或引用校验重试失败时，返回边界说明、缺失资料清单和转人工建议。
- **文档摘要**：用 `@` 指定一份或多份文档，输入「总结这份文档」，走 map-reduce 分段摘要，输出 3–5 条覆盖全文的要点。
- **结构化抽取**：4 套字段模板（会议行动项 / 供应商评分 / 合同要素 / 培训记录），JSON 输出经 zod 校验；失败自动重试一次，仍失败则保留告警。结果可导出 CSV（UTF-8 BOM，Excel 中文不乱码）。
- **周报生成**：汇总最近 7 天或勾选的文档，生成「本周完成 / 进行中 / 风险与阻塞 / 下周计划」四段式草稿；缺失数据明确标注，不编造。可导出 Markdown。
- **可解释执行链路**：右侧「执行链路」展示 Router / Retrieve / Generate / Validate 等节点的耗时、检索条数、引用校验与重试记录。
- **断线恢复**：运行事件持久化到 SQLite，SSE 支持 `Last-Event-ID` 续传；页面重开后可调用 `GET /api/runs/:id` 对账恢复结果。
- **完整文档库**：支持 PDF / DOCX / XLSX / MD / TXT / CSV；上传后异步串行入库，状态与进度可见；重复上传按 SHA-256 去重；支持重新索引与删除。

---

## 快速开始

环境要求：**Node.js >= 24**（项目使用内置 `node:sqlite` 与 FTS5）。无需 Docker，无需模型 Key 即可演示。

```bash
npm install
cp .env.example .env          # Git Bash；PowerShell 用 Copy-Item .env.example .env
npm run demo                  # 幂等写入 7 份演示文档，再启动 server + web
```

打开 **http://127.0.0.1:5173**。

断网 / 无 Key 的答辩兜底：

```bash
npm run demo:offline          # 同上，但 DEMO_MODE=true，顶栏显示「演示模式」
```

生产模式（Fastify 直接托管前端构建产物）：

```bash
npm run build
npm start                     # http://127.0.0.1:3000
```

---

## 演示数据

`npm run demo:seed` 会把 `fixtures/demo/` 下的 **7 份文档**解析、切块、向量化并写入 `data/officepilot.db`：

| 文档 | 格式 | 分类 | 用途 |
|---|---|---|---|
| 员工差旅费用管理办法 v3.2 | PDF | 制度 | 住宿 / 补贴 / 审批问答；仅境内差旅的边界 |
| 信息安全与数据保密规范 | PDF | 制度 | L1–L4 数据分级、L3 外发双审批、密码长度 |
| 请假与考勤制度 | DOCX | 制度 | 年假分档与结转 |
| Q3 产品评审会纪要 | MD | 会议 | 5 条行动项抽取、周报素材 |
| 供应商准入评分表 | XLSX | 表格 | 5 个评分维度与权重 |
| 2026 年度培训与预算计划 | DOCX | 制度 | 培训记录抽取、周报素材 |
| 采购合同模板 | DOCX | 合同 | 甲乙方 / 金额 / 期限 / 违约条款抽取 |

RAG 评测集共 **10 条问题**：前 9 条事实题命中期望文档，第 10 条「海外出差怎么报销？」应触发边界拒答。评测结果见 [docs/RAG-EVAL.md](docs/RAG-EVAL.md)。

演示脚本（6 分钟逐句流程 + 断网兜底 + 问答话术）见 [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md)。

---

## 架构概览

```
┌──────────────────────────────────────────────────────────┐
│ 工作台 · React 19 + Vite + TypeScript                    │
│ 文档库 · 对话 / 技能切换 / @ 引用 · 证据 / 结果 / 链路    │
└───────────────────────┬──────────────────────────────────┘
                        │ REST + SSE
┌───────────────────────▼──────────────────────────────────┐
│ API · Fastify 5 + LangGraph                              │
│ 文档入库（parse → chunk → embed → FTS/向量）              │
│ 运行编排（router → qa / summary / extract / weekly）      │
│ 引用校验 · 阈值边界 · 运行事件回放                       │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│ 模型网关 · OpenAI 兼容直连 / 代理 / 兜底 / demo provider  │
│ 存储 · node:sqlite（文档、块、FTS5、向量、运行、事件）    │
└──────────────────────────────────────────────────────────┘
```

三层职责、数据流、LangGraph 状态图、RAG 管线、SSE 协议与安全设计详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## API 与文档

- 接口清单与请求 / 响应示例：[docs/API.md](docs/API.md)
- Swagger UI：`http://127.0.0.1:3000/docs`（开发模式下也可经 Vite 代理访问）
- OpenAPI JSON：`http://127.0.0.1:3000/api/openapi.json`
- 健康检查：`GET /api/health`

核心端点：

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/health` | 服务、数据库、向量维度、provider 状态 |
| `POST` | `/api/documents` | multipart 上传，`202` 后异步入库 |
| `GET` | `/api/documents` | 文档列表与入库状态 |
| `GET` / `DELETE` | `/api/documents/:id` | 文档详情 / 删除 |
| `POST` | `/api/documents/:id/reindex` | 重建索引（hash 未变则跳过） |
| `GET` | `/api/documents/:id/chunks` | 分页查看知识块 |
| `POST` | `/api/runs` | 创建问答 / 摘要 / 抽取 / 周报运行 |
| `GET` | `/api/runs/:id` | 运行结果与时间线（断线对账） |
| `GET` | `/api/runs/:id/events` | SSE 事件流，支持 `Last-Event-ID` 回放 |

---

## 常用命令

```bash
npm test          # Vitest：41 个文件 / 162 个单元与集成测试
npm run typecheck # shared + server + web + 根 tests/scripts 四个 TS 项目
npm run build     # server (tsup) + web (vite)
npm start         # 生产模式，Fastify 在 3000 端口托管 web/dist
npm run e2e       # Playwright E2E，6 条（会自动 seed 并启动开发服务）
npm run eval      # RAG 离线评测，写回 docs/RAG-EVAL.md
npm run ppt       # 生成 docs/OfficePilot-作品介绍.pptx
npm run demo:seed # 仅写入 7 份演示文档（幂等）
npm run demo      # seed + 开发模式，阈值 0.1
npm run demo:offline # seed + DEMO_MODE=true
```

交付与验证记录：

- [docs/TEST-REPORT.md](docs/TEST-REPORT.md) — 测试 / 构建 / E2E / 评测 / 生产启动的实测结果
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) — 设计文档 §12.2 验收清单逐项状态
- [docs/AI-CODING-LOG.md](docs/AI-CODING-LOG.md) — XBuddy / AI Coding 过程、决策、缺陷与修复证据
- [docs/DEPLOY.md](docs/DEPLOY.md) — 本地与生产启动、Docker 命令、数据卷与健康检查
- [docs/OfficePilot-作品介绍.pptx](docs/OfficePilot-作品介绍.pptx) — 8 页作品介绍 PPT

---

## 环境变量

复制 `.env.example` 后按需填写。**演示 / 测试不要求任何 Key。**

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` / `HOST` | `3000` / `127.0.0.1` | 服务监听地址；Docker 中使用 `0.0.0.0` |
| `DATA_DIR` | `./data` | SQLite 与上传文件目录 |
| `LLM_PROVIDER` | `mock` | `mock` 使用本地脚本化 provider；填其他值启用 OpenAI 兼容客户端 |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 空 | 对话模型直连配置 |
| `EMBEDDING_BASE_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` | 空 | 向量模型配置，未填时回落到 LLM 配置 |
| `FALLBACK_LLM_*` | 空 | 兜底供应商；对话失败自动降级 |
| `OPENAI_PROXY_BASE_URL` | 空 | 代理链路预留项（见架构文档说明） |
| `DEMO_MODE` | `false` | primary / fallback 均失败时启用 demo provider，并在 UI 标注「演示模式」 |
| `LLM_TIMEOUT_MS` / `EMBEDDING_TIMEOUT_MS` | `30000` / `20000` | 单次请求超时 |
| `MATCH_THRESHOLD` | `0.55` | 向量相似度阈值；mock / DEMO_MODE 下服务端强制 `0.1` |

> **mock / demo 与真实模型的差异**：mock/demo provider 使用 256 维 hash embedding 和脚本化回答，相似度整体偏低，因此演示阈值降到 0.1；真实 provider 默认 0.55。demo 回答只覆盖演示问题，未覆盖的问题返回边界或 `LLM_UNAVAILABLE`，不会伪造。

---

## 项目结构

```
officepilot/
├─ apps/
│  ├─ web/                 React 工作台（Vite）
│  │  └─ src/{components,hooks,api,styles}
│  └─ server/              Fastify + LangGraph
│     ├─ src/routes/       health / documents / runs / openapi
│     ├─ src/db/           schema、文档 / 块 / 缓存 / 运行仓储
│     ├─ src/ingest/       文件校验、解析、切块、入库、串行队列
│     ├─ src/rag/          bigram 分词、向量、混合排序、map-reduce
│     ├─ src/validation/   引用与数字 / 日期 grounding、置信度
│     ├─ src/gateway/      OpenAI 兼容 / mock / demo / 重试兜底
│     ├─ src/graph/        StateGraph、节点、运行事件发射器
│     └─ src/runs/         运行管理与 SSE 订阅
├─ packages/shared/        zod schema、SSE 事件、错误码
├─ fixtures/demo/          7 份演示文档
├─ scripts/                seed-demo / eval-rag / build-demo-docs / build-ppt
├─ tests/                  Playwright E2E、集成、smoke
├─ docs/                   架构、API、评测、测试、验收、AI Coding、演示、部署
├─ data/                   SQLite + uploads（gitignored）
├─ Dockerfile / .dockerignore
└─ .env.example
```

---

## 已知限制

- **扫描件 PDF 不支持**：仅解析有文本层的 PDF；无文本层返回 `DOC_PARSE_FAILED` 并提示先 OCR。
- **无鉴权 / 单用户**：默认只监听 `127.0.0.1`，定位为本地演示；不要直接暴露到公网。Docker 中改为 `0.0.0.0` 时应自行加反向代理与访问控制。
- **mock / demo 与真实模型的差异**：demo provider 是确定性的 hash embedding + 脚本化回答，只用于离线演示与可复现测试；真实语义检索质量取决于所配置的 embedding / chat 模型。
- **演示阈值 0.1**：`LLM_PROVIDER=mock` 或 `DEMO_MODE=true` 时服务端强制使用 0.1；真实 provider 使用 `MATCH_THRESHOLD`（默认 0.55）。右侧「执行链路」脚注与证据弱相关提示为静态 0.55 文案，实际阈值以服务端配置为准。
- **混合检索的边界**：FTS 只在向量候选集内参与重排，不能单独把「向量未命中但关键词命中」的块带进结果。阈值判断始终基于向量相似度。
- **Docker 未在本机构建**：本机未安装 Docker，仓库交付 Dockerfile / .dockerignore，但未执行 `docker build`；命令与注意事项见 [docs/DEPLOY.md](docs/DEPLOY.md)。
- **无取消 / 无历史会话管理**：运行记录用于审计与恢复，聊天记录不跨刷新保留；本期未实现运行取消与多用户权限。
- **单进程队列**：入库与运行均按串行队列处理，适合本地演示与小团队；高并发需要外部队列与多实例设计。

---

## 说明

- 模型 Key 只放在 `.env`，不要提交；仓库只包含 `.env.example`。
- `data/`、`test-results/`、`playwright-report/` 已在 `.gitignore` 中排除。
- 默认开发环境使用 npmmirror，仓库不强制该配置。
