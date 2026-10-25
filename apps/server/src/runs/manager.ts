import type { DatabaseSync } from 'node:sqlite';
import { ERROR_CODES, AppError, type CreateRunRequest, type SseEvent } from '@officepilot/shared';
import type { ModelGateway } from '../gateway/types.js';
import { createRun, getRun, markRunRunning, finishRun, failRun } from '../db/runs.js';
import { createRunEmitter } from '../graph/emitter.js';
import { buildOfficeGraph } from '../graph/office-graph.js';

export type RunSubscriber = (seq: number, event: SseEvent) => void;

export function createRunManager(options: {
  db: DatabaseSync;
  gateway: ModelGateway;
  threshold: number;
}) {
  const subscribers = new Map<string, Set<RunSubscriber>>();

  function notify(runId: string, seq: number, event: SseEvent) {
    for (const fn of subscribers.get(runId) ?? []) fn(seq, event);
  }

  async function execute(runId: string, request: CreateRunRequest) {
    markRunRunning(options.db, runId);
    const emitter = createRunEmitter(options.db, runId, (seq, event) => notify(runId, seq, event));
    try {
      if (request.skill === 'qa' && /总结|摘要/.test(request.input) && !request.docIds.length) {
        throw new AppError('INVALID_REQUEST', '请用 @ 指定要总结的文档');
      }
      const graph = buildOfficeGraph({
        db: options.db,
        gateway: options.gateway,
        threshold: options.threshold,
        emitter,
      });
      const state = await graph.invoke({
        runId,
        skill: request.skill,
        input: request.input,
        docIds: request.docIds,
        templateId: request.templateId ?? null,
        operation: 'answer',
        candidates: [],
        sources: [],
        draft: '',
        result: null,
        attempts: 0,
        usage: { promptTokens: 0, completionTokens: 0 },
      });
      const result = state.result;
      if (!result) throw new AppError('INTERNAL', '图未返回结果');
      emitter.emit({ type: 'result', result });
      finishRun(options.db, runId, 'succeeded', result, state.usage);
      emitter.emit({ type: 'done', runId, usage: state.usage });
    } catch (error) {
      const code = error instanceof AppError ? error.code : 'INTERNAL';
      const message = error instanceof Error ? error.message : String(error);
      emitter.emit({
        type: 'error',
        code,
        message: code === 'INTERNAL' ? '服务内部错误' : message,
        retryable: ERROR_CODES[code].retryable,
      });
      emitter.emit({ type: 'done', runId, usage: { promptTokens: 0, completionTokens: 0 } });
      failRun(options.db, runId, code, message);
    } finally {
      await emitter.flush();
    }
  }

  return {
    create(request: CreateRunRequest): string {
      const run = createRun(options.db, request);
      void execute(run.id, request);
      return run.id;
    },
    subscribe(runId: string, fn: RunSubscriber) {
      if (!subscribers.has(runId)) subscribers.set(runId, new Set());
      subscribers.get(runId)!.add(fn);
      return () => subscribers.get(runId)?.delete(fn);
    },
    get: (runId: string) => getRun(options.db, runId),
  };
}
