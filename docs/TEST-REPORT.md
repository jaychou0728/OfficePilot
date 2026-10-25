# OfficePilot 测试与验证报告

- 测试日期：2026-10-25
- 分支：`feat/officepilot`
- 环境：Windows 11 Home 10.0.22631 · Node.js v24.18.0 · npm 11.16.0 · Git Bash
- 模型：无 Key，`LLM_PROVIDER=mock`（demo provider）
- Docker：本机未安装，**未执行** `docker build` / `docker run`

本报告只记录实际执行过的命令与结果，不包含推测。

---

## 1. 结果总览

| 检查项 | 命令 | 结果 |
|---|---|---|
| 演示数据 | `rm -rf data && npm run demo:seed` | ✅ 7 份文档，全部 `ready` |
| 单元 / 集成测试 | `npm test` | ✅ **41 个测试文件 / 162 个测试全部通过** |
| 类型检查 | `npm run typecheck` | ✅ 4 个 TS 项目，0 错误 |
| 构建 | `npm run build` | ✅ tsup server + vite web 均成功 |
| RAG 评测 | `npm run eval` | ✅ **hit@3 9/9 · 边界题拒答 PASS · P95 233 ms** |
| E2E | `npx playwright test` | ✅ **6/6 passed**（15.7 s） |
| 生产启动 | `npm start` + `curl` | ✅ `/api/health` 正常、`/` 返回 HTML、`/docs` 与 OpenAPI 可访问、无残留进程 |

---

## 2. 单元与集成测试

```bash
npm test
```

实际输出摘要：

```
Test Files  41 passed (41)
     Tests  162 passed (162)
  Duration  9.01s
```

覆盖范围（按文件）：

- **共享契约**（`packages/shared/tests`）：zod schema、SSE 事件序列化 / 解析、错误码。
- **数据层**（`apps/server/tests/*.repo.test.ts`、`db.test.ts`）：schema 迁移、文档状态流转、chunks + FTS、embedding 缓存、run_events 回放。
- **网关**（`gateway.*.test.ts`）：OpenAI 兼容流式 / 非流式、mock、demo、重试 / 兜底 / abort。
- **入库**（`files/parsers/chunker/pipeline/ingest.queue/documents.service`）：文件校验、6 种格式解析、800/120 切块、幂等、失败恢复、串行队列。
- **RAG / 校验**（`tokenize/vector/search/citations/summarize`）：bigram 分词、余弦、混合排序、引用 / 数字 / 日期 grounding、置信度。
- **LangGraph**（`router/retrieve/answer/validate/extract/qa/summary/weekly/office-graph`）：路由、边界、重试、四段式周报、状态图组装。
- **API**（`health/documents.routes/runs.sse/api.errors/openapi/config`）：路由、SSE 回放、错误信封、OpenAPI。
- **根目录**（`tests/smoke.test.ts`、`tests/integration/dev-smoke.test.ts`）：跨 workspace 冒烟与开发链路。

---

## 3. 类型检查

```bash
npm run typecheck
```

```
tsc -p packages/shared/tsconfig.json --noEmit
tsc -p apps/server/tsconfig.json --noEmit
tsc -p apps/web/tsconfig.json --noEmit
tsc -p tsconfig.json --noEmit
```

四个项目全部通过，无输出、退出码 0。

---

## 4. 构建

```bash
npm run build
```

- server（tsup）：`dist/index.js 83.87 KB`，sourcemap 160.19 KB，Build success。
- web（vite 7.3.7）：83 modules transformed；
  - `dist/index.html 0.71 kB`
  - `dist/assets/index-*.css 27.69 kB`（gzip 5.98 kB）
  - `dist/assets/index-*.js 303.27 kB`（gzip 94.41 kB）

### 4.1 构建阶段发现并修复的真实阻塞缺陷

首次执行 `npm start` 时进程立即崩溃：

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'sqlite'
imported from .../apps/server/dist/index.js
```

根因：**tsup 默认 `removeNodeProtocol: true`**，把 `import { DatabaseSync } from 'node:sqlite'` 改写成了 `from "sqlite"`。`fs` / `path` 等去掉前缀后仍是合法内置模块，但 `sqlite` 不是，只有 `node:sqlite` 是。

最小修复（`apps/server/tsup.config.ts`）：

```ts
removeNodeProtocol: false,
```

修复后产物中为 `import { DatabaseSync } from "node:sqlite";`。

第二次启动又发现 `/` 返回 404：`routes/openapi.ts` 用固定 `../../../../` 推算仓库根，在源码位置（`apps/server/src/routes/`）正确，但打包后代码位于 `apps/server/dist/index.js`，多退了一层，找不到 `apps/web/dist`，静态托管未注册。

最小修复：

- `config.ts` 在配置对象中返回已正确计算的 `repoRoot`；
- `openapi.ts` 改用 `app.config.repoRoot` 定位 `apps/web/dist`，不再依赖源码目录层级。

修复后生产模式 `/` 返回 HTML，SPA fallback、`/docs`、OpenAPI 均正常。这两处是本次验证中仅有的应用代码修改，均有明确失败证据。

---

## 5. RAG 离线评测

```bash
npm run eval
```

实际结果：

```
hit@3: 9/9
refusal (边界题): PASS
P95 latency: 233 ms (平均 117 ms)
```

- 前 9 条事实题均返回包含期望文档的来源。
- 第 10 题「海外出差怎么报销？」返回边界结果。demo 回答不含引用，引用校验重试后降级为边界；检索本身命中了弱相关片段。这是**引用校验降级边界**，不是阈值直接拒答，报告中有说明。
- 完整逐题明细见 [RAG-EVAL.md](RAG-EVAL.md)（由评测脚本自动写回）。

阈值说明：demo / mock 的 256 维 hash embedding 相似度整体偏低，评测与离线演示使用 `0.1`；真实 provider 默认 `MATCH_THRESHOLD=0.55`。

---

## 6. Playwright E2E

```bash
npx playwright test
```

实际输出：

```
Running 6 tests using 1 worker

✓ answers a policy question with citations and evidence (1.3s)
✓ refuses questions outside the knowledge base with a handoff card (1.0s)
✓ extracts structured rows from a mentioned document (1.3s)
✓ generates a weekly report draft (1.1s)
✓ uploads a markdown document and indexes it (798ms)
✓ mobile layout does not overflow and the document drawer opens (1.4s)

6 passed (15.7s)
```

覆盖：

1. 快捷问题 → 650 回答 → 引用按钮 → 「证据」面板。
2. 库外问题 → 「建议转人工 / 补充资料」卡片。
3. 输入 `@Q3` → 选择会议纪要 → 「文档抽取」→ 5 行结构化数据 → 「结果」表格。
4. 周报生成 → 「本周完成」「下周计划」可见。
5. 上传 Markdown → 文档出现在列表 → 状态变为「已入库」。
6. 390×844 视口无横向溢出；文档库抽屉可打开 / 关闭。

> E2E 的 `webServer` 会自动执行 `npm run demo:seed` 并启动 server + web。测试 5 会上传一份 `e2e-upload-*.md`，因此 E2E 结束后数据库为 8 份文档（7 份演示 + 1 份测试上传）。这属于预期行为。

---

## 7. 生产模式与真实接口检查

```bash
npm start
```

实际探测（修复后）：

```text
READY after 2s
GET /api/health  → 200
{"status":"ok","db":"ok","embeddingDim":256,"demoMode":false,
 "providers":[{"name":"mock","ok":true,"latencyMs":null}]}

GET /                → 200 text/html; charset=utf-8   (707 bytes)
GET /some/route      → 200 text/html; charset=utf-8   (SPA fallback)
GET /docs            → 200 text/html; charset=utf-8
GET /api/openapi.json→ 200 (1431 bytes)
openapi 3.0.3 · 8 paths

GET /api/documents   → total 8（7 份演示 + E2E 上传）
```

OpenAPI 收录的路径：

```
/api/health
/api/runs
/api/runs/{id}
/api/runs/{id}/events
/api/documents
/api/documents/{id}
/api/documents/{id}/chunks
/api/documents/{id}/reindex
```

### 7.1 文档摘要实测

通过 UTF-8 Node 客户端调用（避免 Windows 控制台编码影响中文 JSON）：

```json
{
  "skill": "qa",
  "input": "总结这份文档",
  "docIds": ["<员工差旅费用管理办法对应的 docId>"]
}
```

结果：

```
status succeeded
resultType qa
answer "- 要点一\n- 要点二\n- 要点三"
sources 1
timeline router:done -> loadDoc:done -> summarize:done
```

说明 demo provider 的摘要分支返回 3 条要点，map-reduce 流程与 `loadDoc → summarize` 节点事件正常。

### 7.2 SSE 回放实测

对已完成的运行执行：

```bash
curl -N -H "Last-Event-ID: 0" http://127.0.0.1:3000/api/runs/<runId>/events
```

实际收到 `id: 1..7` 的 `node → node → retrieve → boundary → result → done` 事件，`done` 后连接关闭；事件 `id` 递增，可作为续传游标。

### 7.3 清理

执行 `taskkill` 结束 3000 端口进程后确认：

```
port 3000 free / no leftover process
```

---

## 8. 已知噪声与不稳定因素

以下现象不是失败：

1. **`.env not found. Continuing without it.`**：`--env-file-if-exists` 的预期提示；无 Key 时使用 mock provider。
2. **测试 stderr 中的 `[ingest] AppError: 文档为空`**：`documents.service.test.ts` 故意构造失败文档以验证失败恢复，串行队列的 `onError` 会打印该错误；测试本身通过。
3. **Windows 控制台编码**：直接用 `curl -d '{"input":"总结这份文档"}'` 时，中文可能被控制台按 GBK 传给服务端，导致路由结果异常；这不是应用缺陷。验证中文 JSON 请使用 UTF-8 客户端（Node `fetch` / 写入 `.mjs` 文件）或先 `chcp 65001`。
4. **E2E 复用已有服务**：`reuseExistingServer: true`，如果 3000 / 5173 上残留旧进程，可能测到旧代码。运行前建议确认端口空闲。
5. **E2E 串行执行**：`workers: 1` + `mode: 'serial'`，避免共享 demo 数据库竞争；耗时会高于并行。
6. **node:sqlite 实验 API**：Node 24 内置，当前测试无警告；未来 Node 版本 API 可能变化。
7. **演示阈值文案**：右侧「执行链路」脚注和证据弱相关提示固定显示 0.55，而 mock / demo 实际阈值为 0.1；这是展示文案差异，不影响检索结果。
8. **Docker 未验证**：本机无 Docker，只交付文件与命令，不声称构建成功。

---

## 9. 复现步骤

```bash
# 0. 环境
node --version   # 应为 v24.x
npm --version

# 1. 干净数据 + 7 份演示文档
rm -rf data
npm run demo:seed

# 2. 测试与类型
npm test
npm run typecheck

# 3. 构建
npm run build

# 4. RAG 评测（写回 docs/RAG-EVAL.md）
npm run eval

# 5. E2E（自动 seed + 启动 server/web）
npx playwright test

# 6. 生产检查
npm start
curl http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/
# 结束后停止进程（Windows）
netstat -ano | grep 127.0.0.1:3000
```

预期：162 个测试通过、0 类型错误、构建成功、hit@3 9/9、E2E 6/6、`/` 返回 `text/html`、健康检查 `status: ok`。

---

## 10. 未覆盖项

- Docker 镜像构建与容器运行（本机无 Docker）。
- 真实模型 provider 的在线联调、限流与长文档 P95（无 Key）。
- 浏览器断线后自动重连的手工演练（SSE 回放已有单测与 curl 验证，E2E 未模拟网络中断）。
- CSV / Markdown 下载文件内容的自动化比对（代码已做 UTF-8 BOM、CSV 公式转义；E2E 验证了表格渲染与下载入口）。
- 演示录屏（可选）；人工答辩彩排（E2E 6/6 与生产启动检查已覆盖主流程）。
