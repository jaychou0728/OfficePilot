# OfficePilot 验收清单

- 验收日期：2026-10-25
- 验收依据：设计文档 §12.2（[docs/superpowers/specs/2026-10-25-officepilot-design.md](superpowers/specs/2026-10-25-officepilot-design.md)）
- 环境：Windows 11 · Node v24.18.0 · 无模型 Key（demo provider）· **无 Docker**
- 原则：只记录实际执行过的验证；未执行项明确标为未完成，不用「应该可以」代替结果。

状态图例：✅ 已验证通过 · ⚠️ 部分验证 / 有保留 · ❌ 未完成 · — 不适用

---

## 1. 设计文档 §12.2 逐项状态

| # | 验收项 | 状态 | 实际证据 / 说明 |
|---:|---|---|---|
| 1 | `npm install && npm run dev` 成功；`npm run demo` 成功 | ✅ | `npm install` 成功（含新增 `pptxgenjs`）；E2E 的 `webServer` 实际启动了 `npm run demo:seed` + server dev + web dev，6/6 通过。`npm run demo` 是同一 chain（seed + dev，`MATCH_THRESHOLD=0.1`）。`demo:offline` 命令存在但未单独做断网演练。 |
| 2 | 7 份演示文档入库；重启后仍在 | ✅ | `rm -rf data && npm run demo:seed` → `Seeded 7 documents`；随后多次重启 server（开发 / 生产）后 `GET /api/documents` 仍返回数据。E2E 上传测试后总数为 8（7 + 1 份测试上传），属于预期。 |
| 3 | 前 9 条评测问题 hit@3 ≥ 9；第 10 条拒答 1/1 | ✅ | `npm run eval`：`hit@3: 9/9`、`refusal (边界题): PASS`、P95 233 ms。详见 [RAG-EVAL.md](RAG-EVAL.md)。 |
| 4 | 所有引用可定位；无引用回答不允许出现 | ✅ | E2E「answers a policy question with citations and evidence」点击快捷问题 → 650 回答 → `.cite` 可见 → 证据面板出现。引用校验单测覆盖「回答没有引用」「引用编号不存在」「数字 / 日期不在片段」。边界 / 降级回答按设计不带引用，属于明确边界结果。 |
| 5 | `@` 长文档 + 「总结这份文档」返回 3–5 条覆盖全文的要点 | ⚠️ | 流程已实测：Node UTF-8 客户端调用 `/api/runs`（`skill=qa`、`input=总结这份文档`、`docIds=[差旅文档]`）→ `loadDoc → summarize`，返回 3 条要点、1 条来源。**保留**：demo provider 的摘要是脚本化占位（「要点一/二/三」），只证明链路与 3–5 条结构，不代表真实模型的摘要质量。 |
| 6 | 抽取 CSV 与周报 Markdown 可下载且中文正常 | ⚠️ | 抽取表格渲染已由 E2E 验证（5 行、任务列）；导出按钮与代码路径存在，CSV 加 UTF-8 BOM、公式注入转义，周报 Markdown 保留来源与数据缺口。**保留**：未对下载文件内容做自动化比对，也未在 Excel 中人工打开验证。 |
| 7 | SSE 重连恢复 | ⚠️ | 服务端已实测：对已完成运行执行 `curl -N -H "Last-Event-ID: 0" .../events`，按 seq 回放 `node → retrieve → boundary → result → done`；单测 `runs.sse.test.ts` 覆盖回放与不重复。**保留**：浏览器断网 / 关页再开的手工重连演练未做。 |
| 8 | OpenAPI 页面可访问 | ✅ | 生产模式 `GET /docs` → `200 text/html`；`GET /api/openapi.json` → `200`，`openapi 3.0.3`，8 条路径。 |
| 9 | 单元、接口、E2E 全绿 | ✅ | `npm test`：41 文件 / 162 测试通过；`npm run typecheck` 0 错误；`npx playwright test` 6/6；`npm run build` 成功。 |
| 10 | `docs/AI-CODING-LOG.md` 完整 | ✅ | 已创建，含阶段时间线、全部 76 个提交、缺陷与修复、验证证据、边界与诚实说明。 |
| 11 | 作品介绍 PPT 完成并彩排 | ⚠️ | `npm run ppt` 生成 8 页 `docs/OfficePilot-作品介绍.pptx`（封面、场景、技能、架构、RAG、LangGraph、演示结果、交付总结）。**彩排未进行**。 |
| 12 | 演示录屏与离线模式验证完成 | ❌ | 未录制演示视频；`npm run demo:offline` 未单独执行断网演练。脚本与兜底步骤见 [DEMO-SCRIPT.md](DEMO-SCRIPT.md)。 |

---

## 2. 最终命令与结果

| 命令 | 结果 |
|---|---|
| `rm -rf data && npm run demo:seed` | `Seeded 7 documents` |
| `npm test` | **41 test files / 162 tests passed**，9.01 s |
| `npm run typecheck` | 4 个 TS 项目，0 错误 |
| `npm run build` | server tsup 83.87 KB；web vite 83 modules，JS 303.27 kB / CSS 27.69 kB |
| `npm run eval` | **hit@3 9/9 · refusal PASS · P95 233 ms（平均 117 ms）** |
| `npx playwright test` | **6 passed（15.7 s）** |
| `npm start` + `curl /api/health` | `200`，`status: ok`、`db: ok`、`embeddingDim: 256`、`demoMode: false` |
| `curl /` | `200 text/html; charset=utf-8`（707 bytes） |
| `curl /some/route` | `200 text/html`（SPA fallback） |
| `curl /docs` | `200 text/html` |
| `curl /api/openapi.json` | `200`，OpenAPI 3.0.3，8 paths |
| 停止进程后检查 3000 | 无监听 / 无残留进程 |

> 以上结果来自 [TEST-REPORT.md](TEST-REPORT.md)；若后续代码变化，以重新执行的输出为准。

---

## 3. 本次验收中发现并修复的阻塞问题

验收不是走过场：真实 `npm start` 暴露了两个构建 / 路径缺陷，均已最小修复并重新验证。

| 问题 | 现象 | 修复 | 复验 |
|---|---|---|---|
| tsup 去掉 `node:` 前缀 | `npm start` 报 `Cannot find package 'sqlite'` | `tsup.config.ts`：`removeNodeProtocol: false` | 产物为 `node:sqlite`，生产启动 2 秒 ready |
| 打包后静态目录路径多退一层 | `GET /` 返回 404 JSON | `config.repoRoot` + `openapi.ts` 使用 `app.config.repoRoot` | `/` → 200 HTML，SPA fallback 200 |

两处修改均不改变业务行为；详细记录见 [TEST-REPORT.md §4.1](TEST-REPORT.md) 与 [AI-CODING-LOG.md §4.1–4.2](AI-CODING-LOG.md)。

---

## 4. 未验证 / 未完成事项（如实列出）

1. **Docker**：本机未安装 Docker，未执行 `docker build` / `docker run`。Dockerfile、`.dockerignore`、DEPLOY 命令已交付，但不声称构建成功。
2. **真实模型 provider**：无 API Key，未做在线联调、限流、真实 embedding 维度与 P95 测试；所有评测基于 demo provider。
3. **浏览器断线重连演练**：服务端 SSE 回放已验证，但未在浏览器中模拟断网 / 关页再开的完整流程。
4. **CSV / Markdown 下载文件内容比对**：未自动化校验下载文件字节内容。
5. **演示录屏**：未录制。
6. **现场彩排**：未进行。
7. **扫描件 OCR、鉴权、多租户、运行取消**：设计中的非目标，未实现。

---

## 5. 验收结论

- 核心链路（入库、检索、带引用问答、边界、抽取、周报、SSE 回放、OpenAPI、生产启动）**可运行且已验证**。
- 代码质量门槛（162 测试、typecheck、构建、E2E 6/6、RAG 9/9 + 拒答）**达到**。
- 交付文档与 PPT **已生成**。
- 与「答辩就绪」的差距主要在**演示彩排、录屏、真实模型联调、Docker 构建**，这些均已明确标注，不用推测代替结果。
