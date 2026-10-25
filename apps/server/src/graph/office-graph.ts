import { StateGraph, START, END } from '@langchain/langgraph';
import type { DatabaseSync } from 'node:sqlite';
import type { ModelGateway } from '../gateway/types.js';
import type { RunEmitter } from './emitter.js';
import { RunState } from './state.js';
import { routeInput } from './nodes/router.js';
import { runQa } from './qa.js';
import { runExtract } from './extract.js';
import { runWeekly } from './weekly.js';
import { runSummary } from './summary.js';

export function buildOfficeGraph(ctx: {
  db: DatabaseSync; gateway: ModelGateway; threshold: number; emitter: RunEmitter;
}) {
  return new StateGraph(RunState)
    .addNode('router', async (state) => {
      const routed = routeInput(state.input, state.skill);
      ctx.emitter.node('router', 'done', 10, routed.operation);
      return { operation: routed.operation };
    })
    .addNode('qa', async (state) => ({
      result: await runQa({
        db: ctx.db, provider: ctx.gateway.chat, embedder: ctx.gateway.embed,
        question: state.input, docIds: state.docIds, threshold: ctx.threshold, emitter: ctx.emitter,
      }),
    }))
    .addNode('summary', async (state) => ({
      result: await runSummary({ db: ctx.db, provider: ctx.gateway.chat, docIds: state.docIds, emitter: ctx.emitter }),
    }))
    .addNode('extract', async (state) => ({
      result: await runExtract({
        db: ctx.db, provider: ctx.gateway.chat, docId: state.docIds[0],
        templateId: state.templateId!, emitter: ctx.emitter,
      }),
    }))
    .addNode('weekly', async (state) => ({
      result: await runWeekly({ db: ctx.db, provider: ctx.gateway.chat, docIds: state.docIds, emitter: ctx.emitter }),
    }))
    .addEdge(START, 'router')
    .addConditionalEdges('router', (state) => state.operation, {
      answer: 'qa',
      summary: 'summary',
      extract: 'extract',
      weekly: 'weekly',
    })
    .addEdge('qa', END)
    .addEdge('summary', END)
    .addEdge('extract', END)
    .addEdge('weekly', END)
    .compile();
}
