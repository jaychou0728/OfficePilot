import type { FastifyInstance } from 'fastify';

export function healthRoutes(app: FastifyInstance, embeddingDim: () => number | null) {
  app.get('/api/health', async () => {
    const dbReady = app.dbOk();
    return {
      status: dbReady ? 'ok' : 'degraded',
      db: dbReady ? 'ok' : 'error',
      embeddingDim: embeddingDim(),
      demoMode: app.config.demoMode,
      providers: [
        {
          name: app.config.LLM_PROVIDER,
          ok: app.config.LLM_PROVIDER === 'mock' || Boolean(app.config.LLM_API_KEY),
          latencyMs: null,
        },
        ...(app.config.FALLBACK_LLM_PROVIDER
          ? [{ name: app.config.FALLBACK_LLM_PROVIDER, ok: Boolean(app.config.FALLBACK_LLM_API_KEY), latencyMs: null }]
          : []),
      ],
    };
  });
}
