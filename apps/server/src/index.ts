import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';

let app: FastifyInstance | null = null;

async function main() {
  app = buildApp({ logger: true });
  const config = app.config;

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      await app?.close();
      process.exit(0);
    });
  }

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((error) => {
  if (app) app.log.error(error);
  else console.error(error);
  process.exit(1);
});
