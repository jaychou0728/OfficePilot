# OfficePilot · AI Coding / XBuddy 过程记录

- 项目：腾讯 AI Coding 课程作业 · 方向二 AI 应用创新 · 场景 4 智能办公
- 分支：`feat/officepilot`
- 时间：2026-10-25
- 说明：本文记录**实际发生的开发过程**。所有结论以 git 提交、测试输出、构建输出与接口探测为依据；未执行的验证会明确标注。

---

## 1. AI 是如何被使用的

本会话以 **XBuddy** 角色驱动：

1. **拆解与计划**：先读课程要求与设计稿，把「智能办公助手」拆成共享契约、数据层、模型网关、文档入库、检索与校验、LangGraph、API、前端工作台、演示与交付九个阶段，写成 50+ 个可独立验收的任务（见 `docs/superpowers/plans/2026-10-25-officepilot-implementation.md`）。
2. **子代理实现 + 审查**：按任务派发实现型子代理，每个任务遵循「先写失败测试 → 最小实现 → 测试通过 → 提交」；主会话负责审查接口契约、跨任务一致性与边界条件，再合并提交。
3. **测试驱动**：单元 / 集成测试先行；每个阶段结束跑 `npm test` / `npm run typecheck`；交付前跑 RAG 评测、Playwright E2E、生产启动探测。
4. **不盲信 AI 输出**：AI 生成的实现多次被测试、类型检查、代码审查和真实启动证伪，见第 4 节。修复以小步提交记录在 git 历史中。

证据入口：

- git 历史：`git log --oneline --reverse`（本文件第 3 节列出全部提交）
- 测试结果：[docs/TEST-REPORT.md](TEST-REPORT.md)
- 评测结果：[docs/RAG-EVAL.md](RAG-EVAL.md)
- 设计依据：[docs/superpowers/specs/2026-10-25-officepilot-design.md](superpowers/specs/2026-10-25-officepilot-design.md)

---

## 2. 开发原则

- **契约先行**：`packages/shared` 的 zod schema、SSE 事件、错误码先定，前后端共用；避免「前端以为有 `result` 包装、后端直接发 RunResult」这类跨层漂移。
- **真实失败优先**：不为了让测试变绿而放宽断言；发现设计假设不成立时，记录并降级为边界 / 限制，而不是伪造通过。
- **可复现**：演示数据、评测集、阈值、provider 全部固定；mock 模式不依赖网络。
- **最小修复**：每个缺陷只改必要的配置或代码，并补一条能防止回归的测试 / 探测。
- **诚实交付**：本机没有 Docker，就不声称构建成功；没有真实 Key，就明确评测基于 demo provider。

---

## 3. 阶段时间线与提交

全部 76 个提交（`git log --oneline --reverse`，时间 2026-10-25 18:57–22:40）：

### Phase 0 · 基础设施与共享契约（18:57–19:55）

```
7d88ee1 chore: initialize workspace and track design artifacts
4e1660d docs(plan): correct toolchain versions and cross-task risks
4f04b28 chore: harden toolchain and upgrade vitest for node:sqlite
a667869 docs(plan): sync task 1 snippets with implementation
c79a5d3 docs(plan): add zod dependency and test count for shared contracts
1bc42d1 feat(shared): add zod contracts, error codes and SSE events
bfd8e8e fix(shared): align SSE payloads and strengthen contract tests
0f59f2c docs(plan): sync SSE protocol and cross-task fixes
f94246c fix(shared): make SSE parser wire-aware
7df89df docs: align SSE replay and source examples with shared contracts
63a7f1b feat(server): bootstrap fastify app with health route
8e247d1 fix(server): repair build config and make health stubs explicit
b2fb258 docs(plan): record server build and health scaffold fixes
a26c7f6 test(server): make config tests portable and harden startup logging
72c40c5 docs(plan): sync fastify static version
3b2a57a feat(web): bootstrap react workbench shell and design tokens
b294341 fix(web): unify on vite 7 and polish shell accessibility
8b2a1cc docs(plan): sync web scaffold to vite 7
67a9593 chore: add cross-workspace smoke test and README
cc9840a chore: typecheck root tests and clarify readme
b90c96a docs(plan): record phase 0 completion and root typecheck
```

### Phase 1 · 数据层（19:56–20:18）

```
3bd47a4 feat(db): add sqlite schema and migration
9ba2bad fix(db): cascade FTS cleanup and transactional migration
9ea0a52 docs: sync sqlite schema with fts cascade trigger
7ff76d5 feat(rag): add chinese bigram tokenizer
173ca09 fix(rag): split mixed script runs in tokenizer
9646cf3 docs(plan): record tokenizer mixed-script fix
6039d5d feat(db): add documents repository
eaec52c test(db): cover document status transitions
f222c28 docs(plan): record documents repo hardening
8c452ab feat(db): add chunks and FTS repository
203487a fix(db): validate embedding dimensions and rollback
37e3709 feat(db): add embedding cache repository
1cf57c5 fix(db): validate cached embedding blobs
ab955b1 feat(db): add runs and event repository with replay
a44c35a fix(db): harden run events and timeline replay
781a4b4 docs(plan): record phase 1 completion
```

### Phase 2 · 模型网关（20:32–20:44）

```
b77a1db feat(gateway): add openai-compatible chat and embedding client
88df0c0 fix(gateway): harden streaming timeouts and errors
822b079 feat(gateway): add deterministic mock provider
f1e9d92 feat(gateway): add retries, fallback and demo providers
884bbce fix(gateway): classify retries and honor aborts
f5d2327 docs(plan): record phase 2 completion
```

### Phase 3 · 文档入库（20:45–21:07）

```
22264ce feat(ingest): add upload validation and safe path handling
6c40d74 fix(ingest): harden filename and type validation
40c0d4e test(ingest): keep filename test as utf8 text
04d2229 feat(ingest): add document parsers for six formats
e3d4a0a fix(ingest): reject empty xlsx and preserve cell values
406d345 feat(ingest): add chunker with page and sheet metadata
3b4ddbb fix(ingest): align chunk offsets with trimmed text
3b8de45 feat(ingest): add ingestion pipeline with embedding cache
ad0a82b fix(ingest): make ingestion idempotent
2e456e7 feat(ingest): add serial queue and document service
1c1cd4d fix(ingest): make document retries recoverable
2841ab9 docs(plan): record phase 3 completion
```

### Phase 4 · 检索与校验（21:08–21:20）

```
0df1082 feat(rag): add cosine and top-k vector search
19cdf94 feat(rag): add hybrid vector and FTS ranking
b2d3a68 feat(validation): add citation grounding and confidence
232bf9a fix(validation): match whole numeric tokens
7f6d352 feat(rag): add map-reduce summary helper
b8e5156 fix(rag): harden grounding and normalization
2162ace docs(plan): record phase 4 completion and phase 5 integration notes
```

### Phase 5 · LangGraph 与运行（21:52–22:06）

```
9bb0a14 feat(graph): add state, emitter and router
7d92b73 feat(graph): add retrieval and streaming answer nodes
3001d1f feat(graph): add qa flow with validation and retry
28f8b9d fix(graph): use shared retry decision in qa flow
dfe351c feat(extract): add templates and structured extraction node
5d093fd feat(graph): add extract, weekly, summary flows and state graph
86ac850 feat(runs): add run manager and SSE replay
3bc38c9 feat(api): add document routes and service wiring
9252a0e feat(api): add error envelope, openapi and static serving
```

### Phase 7 · 前端工作台（22:20）

```
baefafa feat(web): build full office workbench
```

### Phase 8 · 演示、评测与 E2E（22:29–22:40）

```
3a080c6 feat(demo): add scripted provider and seeded demo corpus
eace7d3 test(rag): add demo evaluation and tune retrieval
f8d2fe7 fix(demo): cite available sources in qa answers
5da8a3b test(e2e): add workbench end-to-end flows
```

### 交付阶段（本次新增）

交付文档、Dockerfile、PPT 与上述两处生产构建修复完成后统一提交：

```
docs: add delivery documentation, ppt and docker packaging
```

（提交 SHA 见最终交付说明。）

---

## 4. AI 生成缺陷：被发现、被修复 / 被限定

以下不是「AI 一次写对」的宣传，而是**测试与审查把 AI 的错误抓出来**的记录。

### 4.1 tsup 打包：workspace 包被外部化 & `node:` 前缀被剥离

- **现象 A**：`@officepilot/shared` 是导出 `.ts` 的 workspace 包，tsup 默认把它当外部依赖，产物运行时报找不到该包。
- **修复 A**：`noExternal: ['@officepilot/shared']`，把共享契约打进 server bundle。
- **现象 B（交付验证发现）**：`npm start` 直接崩溃：
  `ERR_MODULE_NOT_FOUND: Cannot find package 'sqlite' imported from dist/index.js`。
- **根因 B**：tsup 默认 `removeNodeProtocol: true`，把 `node:sqlite` 改写成 `sqlite`；`sqlite` 不是合法裸内置模块名。
- **修复 B**：`removeNodeProtocol: false`，保留所有 `node:` 前缀。
- **证据**：`apps/server/tsup.config.ts`；`dist/index.js` 中出现 `import { DatabaseSync } from "node:sqlite"`；生产启动从崩溃变为 2 秒内 ready。
- **教训**：构建通过 ≠ 产物可运行；必须真实 `npm start` 探测。

### 4.2 生产静态托管路径漂移

- **现象**：生产模式 `GET /` 返回 `404 {"message":"Route GET:/ not found"}`，而 `apps/web/dist` 明明存在。
- **根因**：`routes/openapi.ts` 用 `new URL('../../../../', import.meta.url)` 推算仓库根；源码位置是 `apps/server/src/routes/openapi.ts`（四层到根），打包后代码在 `apps/server/dist/index.js`（四层到仓库上一级），静态目录检查失败，静态插件与 SPA fallback 都未注册。
- **修复**：`config.ts` 暴露已正确计算的 `repoRoot`；`openapi.ts` 用 `app.config.repoRoot` 定位 `apps/web/dist`。不再依赖源码 / 产物目录层级。
- **证据**：修复后 `GET /` → `200 text/html`，`/some/route` → 200 SPA fallback，`/docs` → 200。
- **教训**：`import.meta.url` 相对路径在「源码运行」和「打包运行」下深度可能不同；构建产物路径应从配置或显式基址推导。

### 4.3 Vite 6 / 7 类型漂移

- **现象**：web 脚手架与依赖在 Vite 6 / 7 之间不一致，类型检查报插件类型不匹配。
- **修复**：统一到 Vite 7（`b294341`），同步计划文档（`8b2a1cc`），保留可访问性修正。
- **证据**：`npm run typecheck` 四个项目全绿。

### 4.4 FTS 孤儿行

- **现象**：删除 / 重建文档块时，`chunks` 行被删但 `chunks_fts` 仍残留 chunk_id，造成检索命中不存在的块。
- **修复**：`chunks_after_delete_fts` 触发器在 `chunks` 删除后清理 FTS（`9ba2bad`）；`deleteChunksByDoc` 只需删 chunks；迁移放在事务中。
- **证据**：`db.test.ts`、`chunks.repo.test.ts` 覆盖删除 → FTS 不残留。

### 4.5 中文分词：`650元` 被当成一个整体

- **现象**：`tokenizeForFts('650元')` 只产生一个非 CJK token，`元` 没有进入 bigram，FTS 查询与文本匹配不稳定。
- **修复**：按脚本切分连续串（`173ca09`）：CJK 串做 bigram，非 CJK 串整体小写；`650元` → `650` + `元`。
- **证据**：`tokenize.test.ts` 覆盖混排、单字 CJK、空串（空查询不进入 FTS MATCH）。

### 4.6 空 XLSX / 公式 / 超链接 / CSV

- **现象**：
  - 全空 XLSX 被当成合法文档，产生 0 块；
  - 公式单元格只读到缓存值或空；
  - 超链接 / 富文本单元格丢文本；
  - CSV 的 BOM、引号内逗号 / 换行、`""` 转义处理不完整。
- **修复**（`e3d4a0a`）：XLSX 无内容时 `DOC_PARSE_FAILED`；`excelCellText` 处理 Date、公式 `result`、超链接 `text`、`richText`；CSV 使用逐字符状态机处理引号 / 转义 / BOM。
- **证据**：`parsers.test.ts` 覆盖空表、公式、超链接、带引号 CSV。

### 4.7 重索引「先写 hash 后入库」死路

- **现象**：若重索引在入库前就更新 `sha256`，入库失败后再次重试会因 hash 相同被跳过，文档永远停在 `failed`。
- **修复**（`1c1cd4d`）：重索引只在 `ingestDocument` 成功后 `updateDocumentHash`；失败保留旧 hash，状态置 `failed`，可再次 `POST /reindex`。
- **证据**：`documents.service.test.ts`「retries a failed document after the file is fixed」；测试日志中会出现一次预期的 `[ingest] AppError: 文档为空`。

### 4.8 网关：调用方取消被超时绕过、流式中途错误处理

- **现象 A**：provider 用 `AbortSignal.timeout` 覆盖了调用方传入的 `signal`，调用方取消后请求仍继续。
- **现象 B**：流式响应中途返回 `{"error": ...}` 或尾部残留 `data:` 行时，没有被识别；重试 / 兜底还可能在已输出 token 后切换 provider，导致答案重复。
- **修复**（`88df0c0`、`884bbce`）：
  - `AbortSignal.any([caller, timeout])` 合并信号；
  - 解析流中的 `error` 字段与尾部 buffer；
  - 网关用 `started` 标记：一旦输出过 token，中途失败直接 `LLM_UNAVAILABLE`，不再切 provider；
  - 只对 429 / 5xx / 超时 / 网络错误重试，abort 不重试。
- **证据**：`gateway.openai.test.ts`、`gateway.fallback.test.ts` 覆盖超时、429、5xx、abort、中途失败。

### 4.9 引用校验：`[1]` 被当数字、`650` 匹配 `6500`

- **现象**：
  - 扫描答案中的数字时把引用标记 `[1]` 也当作数字 1，导致「数字未在片段中找到」的误报；
  - 使用子串匹配时，`650` 会错误匹配片段中的 `6500`。
- **修复**（`232bf9a`、`b8e5156`）：
  - 先用 `REF_RE` 剥离 `[n]`，再扫日期 / 数字；
  - 日期做年/月/日规范化（`2026年1月1日` ↔ `2026-01-01`）；
  - 数字使用整词正则（含千分位）并 `normalizeNumber`，`650` 不再匹配 `6500`；
  - 逗号列表同时保留整体与分项，避免把「650，900」粘成一个数。
- **证据**：`citations.test.ts` 12 条用例，覆盖引用缺失、编号不存在、日期 / 数字不在片段、逗号列表、NFKC。

### 4.10 混合检索的 FTS-only 限制（被审查发现，限定而非修复）

- **现象**：设计叙述「向量 + FTS 混合检索」，容易让人以为关键词命中可以弥补向量漏召回。
- **实际**：`hybridRank` 只对 `vectorHits` 做候选集，FTS 命中必须已经在向量候选里才参与重排；若向量完全没召回，FTS 独中不会进入结果。
- **处理**：保留该实现（阈值与回答边界都基于向量相似度），在 [ARCHITECTURE.md](ARCHITECTURE.md) 与 README「已知限制」中明确写出；不把 FTS 宣传成能独立救回漏召回。
- **证据**：`search.test.ts` 覆盖阈值、FTS 重排、候选外 FTS 不进入结果。

### 4.11 其他被测试抓住的细节

- SSE 事件 payload 的 `type` 字段在序列化 / 回放时需要区分（`f94246c`、`bfd8e8e`）：wire 上 node/citation/token 等 data 不含 `type`，`result` 直接是 RunResult；前端与回放解析都补了测试。
- 文档状态流转：失败后重试、`error_code` 清除、`indexed_at` 只在 ready 时写（`eaec52c`、`a44c35a`）。
- 上传文件名：UTF-8 文本、保留设备名、路径穿越、绝对路径（`6c40d74`、`40c0d4e`）。
- 切块偏移：trim 后 `startOffset` / `endOffset` 与原文对齐（`3b4ddbb`）。
- demo provider 引用：差旅模板固定 `[1][2]`，只有 1 条来源时引用 `[2]` 不存在，触发重试后降级；修复为按可用来源引用（`f8d2fe7`），评测中第 2、3 题因此不再降级。

---

## 5. 验证证据

| 验证 | 命令 | 结果 | 记录 |
|---|---|---|---|
| 单元 / 集成 | `npm test` | 41 文件 / 162 测试通过 | [TEST-REPORT.md §2](TEST-REPORT.md#2-单元与集成测试) |
| 类型 | `npm run typecheck` | 4 个项目 0 错误 | TEST-REPORT §3 |
| 构建 | `npm run build` | server + web 成功 | TEST-REPORT §4 |
| 生产启动 | `npm start` + curl | 健康 / `/` HTML / `/docs` / OpenAPI 通过 | TEST-REPORT §7 |
| E2E | `npx playwright test` | 6/6，15.7 s | TEST-REPORT §6 |
| RAG 评测 | `npm run eval` | hit@3 9/9，拒答 PASS，P95 233 ms | [RAG-EVAL.md](RAG-EVAL.md) |
| SSE 回放 | `curl -N -H "Last-Event-ID: 0"` | 收到 1..7 事件，done 后关闭 | TEST-REPORT §7.2 |
| 摘要 | Node UTF-8 客户端调用 `/api/runs` | `loadDoc → summarize`，3 条要点 | TEST-REPORT §7.1 |

---

## 6. 边界、兜底与诚实说明

- **mock / demo provider**：256 维 hash embedding + 脚本化回答，只用于无 Key 演示与可复现测试。它覆盖演示问题；库外问题进入边界或 `LLM_UNAVAILABLE`，不伪造。
- **离线模式**：`npm run demo:offline` 设置 `DEMO_MODE=true`；真实 provider 失败时回落到 demo provider，UI 顶栏显示「演示模式」。
- **阈值**：mock / demo 服务端强制 `0.1`，真实 provider 默认 `0.55`；两者差异在 README、架构文档、评测报告中均明示。
- **错误处理**：统一错误码 + 可重试标记；SSE `error` 后仍发 `done`；前端区分服务端错误与传输断线，后者用 `GET /api/runs/:id` 对账。
- **Docker**：本机没有 Docker，**没有构建或运行过镜像**；只交付 Dockerfile / .dockerignore / DEPLOY 命令，不写「构建成功」。
- **未完成项**：真实模型联调、录屏、现场彩排、CSV / Markdown 下载文件内容的自动化比对。见 TEST-REPORT §10。
- **AI 输出不是结论**：上述缺陷都由测试、类型检查、代码审查或真实启动探测发现；每次修复都有对应提交或验证记录。AI 负责生成与加速，验收标准仍是可执行证据。
