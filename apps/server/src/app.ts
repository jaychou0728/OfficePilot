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
      ? { redact: ['req.headers.authorization', '*.apiKey', '*.api_key'] }
      : false,
  });

  app.decorate('config', config);
  app.decorate('dbOk', () => true);

  healthRoutes(app, config, () => true);
  return app;
}
