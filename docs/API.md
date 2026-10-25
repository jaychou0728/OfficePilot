# OfficePilot API

- Base URL（开发）：`http://127.0.0.1:3000`
- Base URL（生产）：`http://127.0.0.1:3000`（Fastify 同时托管前端）
- 内容类型：`application/json; charset=utf-8`；上传为 `multipart/form-data`
- 交互式文档：`GET /docs`（Swagger UI）
- OpenAPI JSON：`GET /api/openapi.json`

> 请求体校验由 `packages/shared` 的 zod schema 执行；SSE 事件类型与运行结果结构也在 shared 中定义。

---

## 1. 通用约定

### 1.1 成功响应

直接返回资源或列表：

```json
{ "items": [], "total": 0 }
```

### 1.2 错误响应

所有错误使用统一信封：

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "请求参数不合法",
    "retryable": false,
    "requestId": "req-1"
  }
}
```

- `requestId` 来自 Fastify `request.id`。
- zod 解析失败统一为 `INVALID_REQUEST`（HTTP 400）。
- 未知异常统一为 `INTERNAL`（HTTP 500），对外消息为「服务内部错误」。

### 1.3 错误码

| 错误码 | HTTP | 可重试 | 默认用户提示 |
|---|---:|---|---|
| `DOC_UNSUPPORTED` | 415 | 否 | 不支持该文件类型 |
| `DOC_TOO_LARGE` | 413 | 否 | 文件超过 20 MB |
| `DOC_PARSE_FAILED` | 422 | 是 | 文档解析失败；扫描件请先 OCR |
| `DOC_DUPLICATE` | 409 | 否 | 该文档已存在 |
| `KB_NOT_READY` | 409 | 是 | 知识库尚未就绪 |
| `RUN_NOT_FOUND` | 404 | 否 | 运行记录不存在 |
| `LLM_TIMEOUT` | 504 | 是 | 模型响应超时 |
| `LLM_RATE_LIMIT` | 429 | 是 | 模型限流，稍后重试 |
| `LLM_UNAVAILABLE` | 503 | 是 | 模型服务不可用 |
| `EMBEDDING_FAILED` | 502 | 是 | 向量化失败 |
| `EMBEDDING_DIM_MISMATCH` | 500 | 否 | 向量维度不一致，请重建索引 |
| `SCHEMA_INVALID` | 422 | 是 | 结构化输出校验失败 |
| `TEMPLATE_NOT_FOUND` | 400 | 否 | 抽取字段不存在 |
| `INVALID_REQUEST` | 400 | 否 | 请求参数不合法 |
| `NOT_FOUND` | 404 | 否 | 资源不存在 |
| `INTERNAL` | 500 | 是 | 服务内部错误 |

---

## 2. 健康检查

### `GET /api/health`

```json
{
  "status": "ok",
  "db": "ok",
  "embeddingDim": 256,
  "demoMode": false,
  "providers": [
    {
      "name": "mock",
      "ok": true,
      "latencyMs": null
    }
  ]
}
```

- `status`：DB 可用为 `ok`，否则 `degraded`。
- `embeddingDim`：`app_meta.embedding_dim`，尚未入库时为 `null`。
- `demoMode`：`DEMO_MODE` 配置值。
- `providers`：主 provider 与可选 fallback 的配置状态；`ok` 在 mock 或已配置 Key 时为 `true`，`latencyMs` 当前为 `null`（不做在线探活）。

---

## 3. 文档接口

### 3.1 上传文档

`POST /api/documents`

`multipart/form-data`：

- `file`：二进制文件，必填。支持 `.pdf`、`.docx`、`.xlsx`、`.md`、`.txt`、`.csv`，≤ 20 MB。
- `category`：`制度 | 会议 | 表格 | 合同`，缺省为 `制度`。

> 前端会先追加 `category` 再追加 `file`；这是为了配合 Fastify multipart 在读取文件后暴露其余字段的行为。

`202 Accepted`：

```json
{
  "document": {
    "id": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
    "name": "员工差旅费用管理办法 v3.2.pdf",
    "type": "PDF",
    "category": "制度",
    "size": 48213,
    "status": "queued",
    "stage": "排队中",
    "progress": 0,
    "chunks": 0,
    "error": null,
    "updatedAt": "2026-10-25T22:00:00.000Z"
  }
}
```

- 入库异步执行；前端轮询 `GET /api/documents/:id`。
- 相同 SHA-256 的文档返回 `409 DOC_DUPLICATE`。
- 不支持的类型 `415 DOC_UNSUPPORTED`；超限 `413 DOC_TOO_LARGE`；非法文件名 `400 INVALID_REQUEST`。

### 3.2 文档列表

`GET /api/documents`

```json
{
  "items": [
    {
      "id": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
      "name": "员工差旅费用管理办法 v3.2.pdf",
      "type": "PDF",
      "category": "制度",
      "size": 48213,
      "status": "ready",
      "stage": "已入库",
      "progress": 100,
      "chunks": 12,
      "error": null,
      "updatedAt": "2026-10-25T22:00:02.000Z"
    }
  ],
  "total": 7
}
```

### 3.3 文档详情

`GET /api/documents/:id`

```json
{
  "document": {
    "id": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
    "name": "员工差旅费用管理办法 v3.2.pdf",
    "type": "PDF",
    "category": "制度",
    "size": 48213,
    "status": "embedding",
    "stage": "向量化",
    "progress": 55,
    "chunks": 0,
    "error": null,
    "updatedAt": "2026-10-25T22:00:01.000Z"
  }
}
```

- 终态：`ready` 或 `failed`。非终态：`queued / parsing / chunking / embedding`。
- 不存在返回 `404 NOT_FOUND`。

### 3.4 删除文档

`DELETE /api/documents/:id`

- `204 No Content`。
- 同时删除原文件、chunks 与 FTS 行；运行记录保留。

### 3.5 重建索引

`POST /api/documents/:id/reindex`

内容 hash 未变且当前为 `ready`：

```json
{ "skipped": true }
```

否则：

```json
{
  "document": {
    "id": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
    "name": "员工差旅费用管理办法 v3.2.pdf",
    "type": "PDF",
    "category": "制度",
    "size": 48213,
    "status": "queued",
    "stage": "排队中",
    "progress": 0,
    "chunks": 0,
    "error": null,
    "updatedAt": "2026-10-25T22:10:00.000Z"
  }
}
```

- 跳过时 `200`；重新排队时 `202`。
- 原文件丢失返回 `422 DOC_PARSE_FAILED`。
- hash 只在入库成功后更新，失败后可以再次重建。

### 3.6 查看知识块

`GET /api/documents/:id/chunks?offset=0&limit=20`

- `limit` 最大 100，默认 20。

```json
{
  "items": [
    {
      "id": "a1b2c3d4-0000-4000-8000-000000000001",
      "docId": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
      "ordinal": 0,
      "text": "一线城市（北京、上海、广州、深圳）住宿费标准为每人每晚不超过 650 元……",
      "page": 1,
      "startOffset": 0,
      "endOffset": 412
    }
  ],
  "total": 12
}
```

- 返回体不包含 embedding 向量。

---

## 4. 运行接口

### 4.1 创建运行

`POST /api/runs`

```json
{
  "skill": "qa",
  "input": "一线城市住宿标准是多少？",
  "docIds": [],
  "templateId": null
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `skill` | `qa \| extract \| weekly` | 技能 |
| `input` | string，1–4000 | 问题或指令 |
| `docIds` | string[]，≤ 10 | `@` 引用的文档；qa 作为检索范围，extract 必须恰好 1 份，weekly 可多选 |
| `templateId` | `meeting \| supplier \| contract \| training \| null` | extract 必填 |

- 文档摘要不新增 skill：`skill=qa` 且 `input` 含「总结 / 摘要」时走 summary 分支；未指定 `docIds` 会在运行阶段返回 `INVALID_REQUEST`（HTTP 层仍是 `202`，错误通过 SSE `error` 事件与运行记录返回）。

`202 Accepted`：

```json
{ "runId": "run-8c9d7e6f-1234-4abc-9def-001122334455", "status": "queued" }
```

### 4.2 运行详情

`GET /api/runs/:id`

```json
{
  "run": {
    "id": "run-8c9d7e6f-1234-4abc-9def-001122334455",
    "skill": "qa",
    "input": "一线城市住宿标准是多少？",
    "docIds": [],
    "templateId": null,
    "status": "succeeded",
    "result": {
      "type": "qa",
      "answer": "根据《员工差旅费用管理办法 v3.2》，一线城市住宿上限为 650 元/晚，差旅补贴为 120 元/天，出差需提前 3 个工作日在 OA 申请。[1]",
      "sources": [
        {
          "n": 1,
          "docId": "3f7c2d0e-2b1a-4a7e-9f4d-0c1b2a3d4e5f",
          "docName": "员工差旅费用管理办法 v3.2.pdf",
          "chunkId": "a1b2c3d4-0000-4000-8000-000000000001",
          "page": 1,
          "sheet": null,
          "score": 0.412,
          "snippet": "一线城市（北京、上海、广州、深圳）住宿费标准为每人每晚不超过 650 元……"
        }
      ],
      "confidence": 0.68
    },
    "errorCode": null,
    "errorMessage": null,
    "usage": { "promptTokens": 0, "completionTokens": 0 },
    "timeline": [
      { "type": "node", "node": "router", "status": "done", "ms": 10, "detail": "answer" },
      { "type": "node", "node": "retrieve", "status": "done", "ms": 300, "detail": "命中 2 条 · 过滤 21 条" }
    ],
    "createdAt": "2026-10-25T22:12:00.000Z",
    "finishedAt": "2026-10-25T22:12:02.000Z"
  }
}
```

- `status`：`queued | running | succeeded | failed`。
- `timeline` 是该运行所有 `node` 事件的 payload，按 `seq` 排序。
- 不存在返回 `404 RUN_NOT_FOUND`。

### 4.3 SSE 事件流

`GET /api/runs/:id/events`

请求头可选：`Last-Event-ID: <seq>`。服务端先回放 `seq > lastId` 的历史事件，再推送新事件。

响应示例：

```
id: 1
event: node
data: {"node":"router","status":"done","ms":10,"detail":"answer"}

id: 2
event: node
data: {"node":"retrieve","status":"running"}

id: 3
event: node
data: {"node":"retrieve","status":"done","ms":300,"detail":"命中 2 条 · 过滤 21 条"}

id: 4
event: citation
data: {"sources":[{"n":1,"docId":"...","docName":"员工差旅费用管理办法 v3.2.pdf","chunkId":"...","page":1,"sheet":null,"score":0.412,"snippet":"一线城市……"}]}

id: 5
event: token
data: {"text":"根据《员工差旅"}

id: 9
event: node
data: {"node":"answer","status":"done","ms":12}

id: 10
event: node
data: {"node":"validate","status":"done","ms":40,"detail":"引用校验通过"}

id: 11
event: result
data: {"type":"qa","answer":"……","sources":[...],"confidence":0.68}

id: 12
event: done
data: {"runId":"run-8c9d...","usage":{"promptTokens":0,"completionTokens":0}}
```

> 线上格式：除 `result` 外，`serializeSse` 会把事件对象的 `type` 去掉后写入 `data`，事件名由 `event:` 行表达；**`result` 的 data 直接是 `RunResult` 对象（含它自己的 `type: "qa" / "extract" / "weekly"`）**，没有 `{result: ...}` 外层包装。

事件类型：

| 事件 | 说明 |
|---|---|
| `node` | 节点状态 `running / done / fail`，可带毫秒耗时与 detail |
| `token` | 模型流式增量 |
| `citation` | 本次检索的来源列表，先于生成 |
| `validation` | 校验失败：`{ok:false, errors:[{field,reason}], attempt}` |
| `result` | 最终结果（qa / extract / weekly） |
| `error` | 运行失败：`{code,message,retryable}` |
| `done` | 终止事件，随后连接关闭 |

错误路径示例：

```
id: 7
event: error
data: {"code":"LLM_UNAVAILABLE","message":"模型服务不可用","retryable":true}

id: 8
event: done
data: {"runId":"run-...","usage":{"promptTokens":0,"completionTokens":0}}
```

---

## 5. OpenAPI 与静态资源

### 5.1 OpenAPI

- `GET /api/openapi.json`：`@fastify/swagger` 生成的 OpenAPI 文档，覆盖已注册的 API 路径。
- `GET /docs`：Swagger UI。
- 业务请求 / 响应仍以 `packages/shared` 的 zod schema 为准；OpenAPI 用于浏览路径与调试，不替代运行时校验。

### 5.2 前端静态资源

- 当 `apps/web/dist` 存在时，Fastify 通过 `@fastify/static` 托管。
- `GET /` 返回 `index.html`。
- 非 `/api/` 的未知路径回退到 `index.html`（SPA 路由）。
- 未知 `/api/` 路径返回：

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "资源不存在",
    "retryable": false,
    "requestId": "req-1"
  }
}
```

### 5.3 CORS

开发与生产均启用 `@fastify/cors`，`origin: true`（反射请求 Origin）。这适合本地演示；公网部署应改为白名单。

---

## 6. 最小调用示例

```bash
# 健康检查
curl http://127.0.0.1:3000/api/health

# 文档列表
curl http://127.0.0.1:3000/api/documents

# 上传（category 先于 file）
curl -X POST http://127.0.0.1:3000/api/documents \
  -F "category=制度" \
  -F "file=@fixtures/demo/员工差旅费用管理办法 v3.2.pdf"

# 创建问答
RUN_ID=$(curl -s -X POST http://127.0.0.1:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{"skill":"qa","input":"一线城市住宿标准是多少？","docIds":[]}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).runId")

# 查看结果 / 事件流
curl http://127.0.0.1:3000/api/runs/$RUN_ID
curl -N http://127.0.0.1:3000/api/runs/$RUN_ID/events
```
