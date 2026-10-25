import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config.js';
import { healthRoutes } from './routes/health.js';

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

  app.decorate('config', config);
  app.decorate('dbOk', () => true);

  healthRoutes(app);
  return app;
}
