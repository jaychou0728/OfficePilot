import fs from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { loadConfig, type AppConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createGateway } from './gateway/index.js';
import { createMockProvider } from './gateway/mock.js';
import { createOpenAiProvider } from './gateway/openai.js';
import { healthRoutes } from './routes/health.js';
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
  healthRoutes(app);
  runRoutes(app, manager, db);

  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}
