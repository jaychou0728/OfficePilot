import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';

export function healthRoutes(app: FastifyInstance, config: AppConfig, dbOk: () => boolean) {
  app.get('/api/health', async () => ({
    status: dbOk() ? 'ok' : 'degraded',
    db: dbOk() ? 'ok' : 'error',
    embeddingDim: 1024,
    demoMode: config.demoMode,
    providers: [
      { name: config.LLM_PROVIDER, ok: config.LLM_PROVIDER === 'mock' || Boolean(config.LLM_API_KEY), latencyMs: 0 },
      ...(config.FALLBACK_LLM_PROVIDER
        ? [{ name: config.FALLBACK_LLM_PROVIDER, ok: Boolean(config.FALLBACK_LLM_API_KEY), latencyMs: 0 }]
        : []),
    ],
  }));
}
