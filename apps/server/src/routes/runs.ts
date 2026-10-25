import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';
import { CreateRunSchema, parseSseEvent, serializeSse, type SseEvent } from '@officepilot/shared';
import { getEventsAfter } from '../db/runs.js';
import type { createRunManager } from '../runs/manager.js';

export function runRoutes(app: FastifyInstance, manager: ReturnType<typeof createRunManager>, db: DatabaseSync) {
  app.post('/api/runs', async (request, reply) => {
    const parsed = CreateRunSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: parsed.error.issues[0]?.message ?? '请求参数不合法',
          retryable: false,
          requestId: request.id,
        },
      });
    }
    const runId = manager.create(parsed.data);
    return reply.code(202).send({ runId, status: 'queued' });
  });

  app.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = manager.get(id);
    if (!run) {
      return reply.code(404).send({
        error: { code: 'RUN_NOT_FOUND', message: '运行记录不存在', retryable: false, requestId: request.id },
      });
    }
    return { run };
  });

  app.get('/api/runs/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = manager.get(id);
    if (!run) {
      return reply.code(404).send({
        error: { code: 'RUN_NOT_FOUND', message: '运行记录不存在', retryable: false, requestId: request.id },
      });
    }

    const header = request.headers['last-event-id'];
    const last = Number(header ?? 0);
    const fromSeq = Number.isFinite(last) ? last : 0;

    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    let lastSeq = fromSeq;
    let closed = false;
    let unsubscribe = () => {};

    const stop = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      reply.raw.end();
    };

    const write = (seq: number, event: SseEvent) => {
      if (closed || seq <= lastSeq) return;
      lastSeq = seq;
      reply.raw.write(serializeSse(seq, event));
      if (event.type === 'done') stop();
    };

    unsubscribe = manager.subscribe(id, (seq, event) => write(seq, event));
    request.raw.on('close', () => {
      if (!closed) {
        closed = true;
        unsubscribe();
      }
    });

    for (const event of getEventsAfter(db, id, fromSeq)) {
      if (closed) break;
      write(event.seq, parseSseEvent(event.payload, event.type as SseEvent['type']));
    }
  });
}
