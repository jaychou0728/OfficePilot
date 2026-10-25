import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { AppError, ERROR_CODES } from '@officepilot/shared';
import { loadConfig, type AppConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { getDocument } from './db/documents.js';
import { createGateway } from './gateway/index.js';
import { createMockProvider } from './gateway/mock.js';
import { createOpenAiProvider } from './gateway/openai.js';
import { createDocumentService } from './ingest/service.js';
import { documentRoutes } from './routes/documents.js';
import { healthRoutes } from './routes/health.js';
import { openapiRoutes, publicRoutes } from './routes/openapi.js';
import { runRoutes } from './routes/runs.js';
import { createRunManager } from './runs/manager.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    dbOk: () => boolean;
  }
}

export type BuildOptions = {
  dbPath?: string;
  env?: NodeJS.ProcessEnv;
  logger?: boolean;
};

export function createGatewayFromConfig(config: AppConfig) {
  if (config.LLM_PROVIDER === 'mock') {
    const mock = createMockProvider();
    return createGateway({
      chat: { primary: mock, demo: config.demoMode ? mock : undefined },
      embed: { primary: mock, demo: config.demoMode ? mock : undefined },
      retry: { attempts: 0, delaysMs: [] },
    });
  }

  const chat = createOpenAiProvider({
    baseUrl: config.LLM_BASE_URL,
    apiKey: config.LLM_API_KEY,
    model: config.LLM_MODEL,
    timeoutMs: config.LLM_TIMEOUT_MS,
  });
  const embed = createOpenAiProvider({
    baseUrl: config.EMBEDDING_BASE_URL || config.LLM_BASE_URL,
    apiKey: config.EMBEDDING_API_KEY || config.LLM_API_KEY,
    model: config.EMBEDDING_MODEL || config.LLM_MODEL,
    timeoutMs: config.EMBEDDING_TIMEOUT_MS,
  });
  const fallback = config.FALLBACK_LLM_PROVIDER
    ? createOpenAiProvider({
        baseUrl: config.FALLBACK_LLM_BASE_URL,
        apiKey: config.FALLBACK_LLM_API_KEY,
        model: config.FALLBACK_LLM_MODEL,
        timeoutMs: config.LLM_TIMEOUT_MS,
      })
    : undefined;
  const demo = config.demoMode ? createMockProvider() : undefined;

  return createGateway({
    chat: { primary: chat, fallback, demo },
    embed: { primary: embed, demo },
    demoMode: config.demoMode,
  });
}

export function buildApp(options: BuildOptions = {}): FastifyInstance {
  const config = loadConfig(options.env ?? process.env);
  const app = Fastify({
    logger: options.logger
      ? {
          redact: [
            'req.headers.authorization',
            'headers.authorization',
            'authorization',
            'apiKey',
            'api_key',
            '*.apiKey',
            '*.api_key',
            'LLM_API_KEY',
            'EMBEDDING_API_KEY',
            'FALLBACK_LLM_API_KEY',
            'config.LLM_API_KEY',
            'config.EMBEDDING_API_KEY',
            'config.FALLBACK_LLM_API_KEY',
          ],
        }
      : false,
  });

  const dbPath = options.dbPath
    ?? (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(config.dataDir, 'officepilot.db'));
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = openDatabase(dbPath);
  const gateway = createGatewayFromConfig(config);
  const manager = createRunManager({ db, gateway, threshold: config.MATCH_THRESHOLD });

  app.decorate('config', config);
  app.decorate('dbOk', () => {
    try {
      db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  });

  app.register(multipart);
  openapiRoutes(app);

  const documents = createDocumentService({
    db,
    dataDir: config.dataDir,
    ingest: {
      db,
      provider: gateway.embed,
      fileLoader: async (docId: string) => {
        const doc = getDocument(db, docId);
        if (!doc?.filePath) throw new AppError('DOC_PARSE_FAILED', '缺少原文件路径');
        return fs.promises.readFile(doc.filePath);
      },
    },
  });

  // Register API routes in a child plugin so they load after @fastify/swagger's
  // onRoute hook is installed; otherwise the generated spec has no paths.
  app.register(async (api) => {
    healthRoutes(api, () => {
      try {
        const row = db.prepare("SELECT value FROM app_meta WHERE key='embedding_dim'").get() as { value: string } | undefined;
        return row ? Number(row.value) : null;
      } catch {
        return null;
      }
    });
    runRoutes(api, manager, db);
    documentRoutes(api, { db, documents });
  });

  publicRoutes(app);

  app.setErrorHandler((error, request, reply) => {
    const appError = error instanceof AppError ? error : null;
    const zodError = error instanceof ZodError ? error : null;
    const code = appError?.code ?? (zodError ? 'INVALID_REQUEST' : 'INTERNAL');
    const status = appError?.status ?? (zodError ? 400 : ((error as { statusCode?: number }).statusCode ?? 500));
    const retryable = appError?.retryable ?? (zodError ? false : ERROR_CODES.INTERNAL.retryable);
    const message = appError
      ? appError.message
      : zodError
        ? zodError.issues[0]?.message ?? '请求参数不合法'
        : status >= 500
          ? '服务内部错误'
          // Fastify 5 types the handler error as unknown by default.
          : (error as Error).message;
    reply.code(status).send({ error: { code, message, retryable, requestId: request.id } });
  });

  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}
