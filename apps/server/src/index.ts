import { buildApp } from './app.js';

const app = buildApp({ logger: true });
const config = app.config;

async function main() {
  await app.listen({ port: config.PORT, host: config.HOST });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
