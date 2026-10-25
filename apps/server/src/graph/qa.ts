import type { DatabaseSync } from 'node:sqlite';
import type { RunResult } from '@officepilot/shared';
import type { ChatProvider, EmbeddingProvider } from '../gateway/types.js';
import type { RunEmitter } from './emitter.js';
import { retrieveChunks } from './nodes/retrieve.js';
import { streamAnswer } from './nodes/answer.js';
import { boundaryResult } from './nodes/validate.js';
import { validateCitations, confidence } from '../validation/citations.js';

export async function runQa(input: {
  db: DatabaseSync;
  provider: ChatProvider;
  embedder: EmbeddingProvider;
  question: string;
  docIds: string[];
  threshold: number;
  emitter: RunEmitter;
}): Promise<RunResult> {
  input.emitter.node('router', 'done', 20, 'qa');
  input.emitter.node('retrieve', 'running');

  const { sources, filtered } = await retrieveChunks({
    db: input.db,
    provider: input.embedder,
    query: input.question,
    docIds: input.docIds,
    threshold: input.threshold,
  });
  input.emitter.node('retrieve', 'done', 300, `命中 ${sources.length} 条 · 过滤 ${filtered} 条`);

  if (!sources.length) {
    input.emitter.node('boundary', 'done', 10, '低于阈值');
    return boundaryResult(input.question, ['相关政策条款']);
  }

  input.emitter.emit({ type: 'citation', sources });
  input.emitter.node('answer', 'running');

  let draft = '';
  let validation = validateCitations('', sources);
  let attempts = 0;

  while (attempts < 3) {
    const started = Date.now();
    draft = await streamAnswer({
      question: input.question,
      sources,
      provider: input.provider,
      emitter: input.emitter,
    });
    input.emitter.node('answer', 'done', Date.now() - started);
    validation = validateCitations(draft, sources);
    if (validation.ok) break;
    input.emitter.emit({
      type: 'validation',
      ok: false,
      errors: validation.errors,
      attempt: attempts + 1,
    });
    attempts++;
  }

  input.emitter.node('validate', validation.ok ? 'done' : 'fail', 40, validation.ok ? '引用校验通过' : '引用校验失败');

  const cited = new Set([...draft.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])));
  const top = Math.max(0, ...sources.filter((source) => cited.has(source.n)).map((source) => source.score));

  if (!validation.ok) {
    return {
      type: 'qa',
      answer: '回答未通过引用校验，无法确认。请核对引用片段或转人工。',
      sources,
      confidence: confidence(top, validation.coverage, false),
      boundary: {
        reason: '引用校验重试后仍失败',
        missing: ['可核对的原文依据'],
        handoff: '请人工核对引用片段，或补充更明确的制度条款后重试。',
      },
    };
  }

  return {
    type: 'qa',
    answer: draft,
    sources,
    confidence: confidence(top, validation.coverage, true),
  };
}
