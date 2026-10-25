import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// openapi.ts lives in apps/server/src/routes, so four levels up is the repo root.
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export function openapiRoutes(app: FastifyInstance) {
  app.register(swagger, {
    openapi: { info: { title: 'OfficePilot API', version: '0.1.0' } },
  });
  app.register(swaggerUi, { routePrefix: '/docs' });
  app.get('/api/openapi.json', async () => app.swagger());
}

export function publicRoutes(app: FastifyInstance) {
  app.register(cors, { origin: true });
  const webDist = path.resolve(repoRoot, 'apps/web/dist');
  if (existsSync(webDist)) {
    app.register(fastifyStatic, { root: webDist });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND', message: '资源不存在', retryable: false, requestId: request.id },
        });
      }
      return reply.sendFile('index.html');
    });
  }
}
