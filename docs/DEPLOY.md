# OfficePilot 部署与运行说明

- 适用版本：0.1.0（2026-10-25）
- 本机验证环境：Windows 11 · Node v24.18.0 · npm 11.16.0
- **Docker 状态：本机未安装 Docker，未执行 `docker build` / `docker run`。** 下文 Docker 部分为交付命令与说明，不构成构建成功记录。

---

## 1. 本地开发

### 1.1 前置条件

- Node.js >= 24（必须；项目使用内置 `node:sqlite` 与 FTS5）
- npm
- 可选：模型 API Key（不填则使用 mock / demo provider）

### 1.2 启动

```bash
npm install
cp .env.example .env          # Git Bash；PowerShell: Copy-Item .env.example .env

npm run demo                  # 幂等 seed 7 份文档 + 并行启动 server(3000) / web(5173)
```

打开 **http://127.0.0.1:5173**。

无 Key / 断网兜底：

```bash
npm run demo:offline          # DEMO_MODE=true，顶栏显示「演示模式」
```

只启动开发服务（不 seed）：

```bash
npm run dev
```

### 1.3 端口

| 服务 | 地址 |
|---|---|
| Web（Vite） | http://127.0.0.1:5173 |
| API（Fastify） | http://127.0.0.1:3000 |
| 健康检查 | http://127.0.0.1:3000/api/health |
| Swagger UI | http://127.0.0.1:3000/docs |
| OpenAPI JSON | http://127.0.0.1:3000/api/openapi.json |

Vite 将 `/api` 代理到 3000；生产模式不需要 Vite。

---

## 2. 生产模式（本机）

```bash
npm run build     # server: tsup → apps/server/dist；web: vite → apps/web/dist
npm start         # Fastify 在 3000 端口同时提供 API 与前端静态资源
```

打开 **http://127.0.0.1:3000**。

- `npm start` 等价于 `node --env-file-if-exists=../../.env apps/server/dist/index.js`（在 `apps/server` workspace 内执行）。
- 前端 `apps/web/dist` 由 `@fastify/static` 托管；非 `/api/` 的未知路径回退到 `index.html`。
- `/api/*` 的未知路径返回统一错误信封 `NOT_FOUND`。

### 2.1 健康检查

```bash
curl http://127.0.0.1:3000/api/health
```

期望：

```json
{
  "status": "ok",
  "db": "ok",
  "embeddingDim": 256,
  "demoMode": false,
  "providers": [{ "name": "mock", "ok": true, "latencyMs": null }]
}
```

### 2.2 数据目录

默认 `./data`（相对仓库根）：

```
data/
├─ officepilot.db      # SQLite（WAL）
└─ uploads/
   └─ <docId>/<原始文件名>
```

- 通过 `DATA_DIR` 覆盖；相对路径按仓库根解析，绝对路径原样使用。
- 备份：停止服务后复制整个 `data/`；或使用 SQLite 在线备份工具。
- 重置演示数据：`rm -rf data && npm run demo:seed`。
- 删除文档会删原文件与索引，但保留运行记录。

### 2.3 环境变量

见 `.env.example` 与 README。生产至少确认：

```env
PORT=3000
HOST=127.0.0.1        # 本地；容器/反向代理后可为 0.0.0.0
DATA_DIR=./data
LLM_PROVIDER=mock     # 真实模型改为 openai-compatible 供应商配置
DEMO_MODE=false
```

真实模型示例：

```env
LLM_PROVIDER=siliconflow
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=***
LLM_MODEL=***
EMBEDDING_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_API_KEY=***
EMBEDDING_MODEL=BAAI/bge-m3
FALLBACK_LLM_PROVIDER=zhipu
FALLBACK_LLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
FALLBACK_LLM_API_KEY=***
FALLBACK_LLM_MODEL=***
MATCH_THRESHOLD=0.55
```

> 切换 embedding 模型 / 维度后，旧索引会因维度不一致报 `EMBEDDING_DIM_MISMATCH`；需清空 `data/` 重新 seed / 上传。代理链路说明见 [ARCHITECTURE.md §6.2](ARCHITECTURE.md#62-双链路)。

---

## 3. Docker

### 3.1 交付内容

- `Dockerfile`：多阶段，`node:24-bookworm-slim`
  - build 阶段：`npm ci` → `npm run build`
  - runtime 阶段：复制 `node_modules`、`packages/shared`、`apps/server/dist`、`apps/server/src`（供 seed 的 TS 脚本）、`apps/web/dist`、`fixtures`、`scripts`、`tsconfig.base.json`
  - `ENV HOST=0.0.0.0`、`PORT=3000`、`DATA_DIR=/app/data`
  - `EXPOSE 3000`
  - `HEALTHCHECK` 使用 Node 内置 `fetch` 请求 `/api/health`（基础镜像不依赖 curl）
  - `CMD ["node", "apps/server/dist/index.js"]`
- `.dockerignore`：排除 `node_modules`、`dist`、`data`、`.env`、测试产物、根目录大文件等。

### 3.2 构建

```bash
docker build -t officepilot .
```

> 本机没有 Docker，以上命令**未执行**。

### 3.3 运行

```bash
# Windows Git Bash / macOS / Linux
docker run -d --name officepilot \
  -p 3000:3000 \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  officepilot
```

PowerShell：

```powershell
docker run -d --name officepilot `
  -p 3000:3000 `
  --env-file .env `
  -v "${PWD}/data:/app/data" `
  officepilot
```

打开 http://127.0.0.1:3000。

### 3.4 首次 seed（重要）

镜像启动后不会自动写入演示数据。两种做法：

**A. 启动前用一次性容器 seed（推荐）**

```bash
docker run --rm \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  officepilot npm run demo:seed
```

然后再执行 §3.3 的 `docker run`。

**B. 对已运行容器执行**

```bash
docker exec officepilot npm run demo:seed
```

> seed 是幂等的；重复执行会按 SHA-256 跳过已有文档。运行中的 server 会打开 SQLite WAL，建议优先用 A。

### 3.5 数据卷

- 必须挂载 `/app/data`，否则容器删除后索引与上传文件丢失。
- Windows 挂载目录的权限 / 大小写行为与 Linux 不同；生产建议在 Linux 主机或命名卷上运行：

```bash
docker volume create officepilot-data
docker run -d --name officepilot -p 3000:3000 --env-file .env \
  -v officepilot-data:/app/data officepilot
```

### 3.6 健康检查与日志

```bash
docker ps                     # STATUS 中的 healthy / unhealthy
docker inspect --format '{{json .State.Health}}' officepilot
docker logs -f officepilot

# 手动探测
curl http://127.0.0.1:3000/api/health
```

`HEALTHCHECK` 参数：间隔 30 s、超时 5 s、启动宽限 20 s、连续失败 3 次标记 unhealthy。

### 3.7 停止 / 清理

```bash
docker stop officepilot
docker rm officepilot
# 仅清理容器；数据卷保留。删除命名卷会丢数据：
# docker volume rm officepilot-data
```

---

## 4. 生产注意事项

- **无鉴权**：默认定位本地演示。暴露到公网 / 团队网络前，必须在前面加反向代理、认证与访问控制；不要直接把 3000 端口暴露到公网。
- **CORS**：当前 `origin: true` 反射请求 Origin；公网部署应改为白名单。
- **密钥**：只通过环境变量或 `--env-file` 注入；不要把 `.env` 打进镜像（`.dockerignore` 已排除）。
- **反向代理**：若放在 Nginx / Caddy 后，需要支持 SSE（关闭响应缓冲，例如 Nginx `proxy_buffering off;`），并保留 `Last-Event-ID` 请求头。
- **单实例**：入库与运行是进程内串行队列；多副本部署需要外部队列与共享数据库，当前未实现。
- **SQLite 备份**：复制 `data/` 前先停服务，或使用 SQLite backup API，避免 WAL 不一致。
- **Node 版本**：必须 24+；低版本没有 `node:sqlite`。

---

## 5. 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| `Cannot find package 'sqlite'` | 旧构建产物；本项目已通过 tsup `removeNodeProtocol: false` 修复。重新 `npm run build`。 |
| `GET /` 返回 404 JSON | `apps/web/dist` 不存在（未 build）或旧产物路径问题；执行 `npm run build`，确认 `apps/web/dist/index.html` 存在。 |
| 5173 打不开 | 只启动了 server；用 `npm run demo` / `npm run dev` 同时起 web。 |
| 3000 被占用 | `netstat -ano | grep 127.0.0.1:3000`，结束对应 PID 后重启。 |
| `.env not found. Continuing without it.` | `--env-file-if-exists` 的预期提示；无 Key 时使用 mock。 |
| 上传后一直 `queued` | 检查 server 日志中的 `[ingest]` 错误；确认嵌入 provider 可用（mock 模式应立即完成）。 |
| `EMBEDDING_DIM_MISMATCH` | 更换了 embedding 模型 / 维度；清空 `data/` 重新入库。 |
| 中文 curl JSON 变乱码 | Windows 控制台编码问题；用 UTF-8 客户端或 `chcp 65001`。 |

---

## 6. 部署验收命令

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run demo:seed
npm start
# 另开终端：
curl http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/docs
curl http://127.0.0.1:3000/api/openapi.json
```

本机实测结果见 [TEST-REPORT.md](TEST-REPORT.md)；Docker 构建与容器运行未执行，需在有 Docker 的环境补验。
