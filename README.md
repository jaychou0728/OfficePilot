# OfficePilot

本地优先的智能办公助手。当前阶段：工作台骨架 + 服务端 health 接口。

## 环境

- Node.js >= 24
- npm（已配置 npmmirror）

## 启动

```bash
npm install
cp .env.example .env
npm run dev
```

- Web: http://127.0.0.1:5173
- API: http://127.0.0.1:3000/api/health

## 常用命令

```bash
npm test          # Vitest（shared + server + integration）
npm run typecheck # 三个 workspace 的类型检查
npm run build     # server (tsup) + web (vite)
npm run e2e       # Playwright（后续任务启用）
```

## 说明

- 模型 Key 只放在 `.env`，不要提交。
- 当前 `LLM_PROVIDER=mock` 即可开发与测试。
