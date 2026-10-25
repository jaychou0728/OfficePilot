import { Annotation } from '@langchain/langgraph';
import type { RunResult, Skill, Source, TemplateId } from '@officepilot/shared';

export const RunState = Annotation.Root({
  runId: Annotation<string>(),
  skill: Annotation<Skill>(),
  input: Annotation<string>(),
  docIds: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),
  templateId: Annotation<TemplateId | null>({ reducer: (_a, b) => b, default: () => null }),
  operation: Annotation<'answer' | 'summary' | 'extract' | 'weekly'>({ reducer: (_a, b) => b, default: () => 'answer' }),
  candidates: Annotation<unknown[]>({ reducer: (_a, b) => b, default: () => [] }),
  sources: Annotation<Source[]>({ reducer: (_a, b) => b, default: () => [] }),
  draft: Annotation<string>({ reducer: (_a, b) => b, default: () => '' }),
  result: Annotation<RunResult | null>({ reducer: (_a, b) => b, default: () => null }),
  attempts: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  usage: Annotation<{ promptTokens: number; completionTokens: number }>({
    reducer: (_a, b) => b,
    default: () => ({ promptTokens: 0, completionTokens: 0 }),
  }),
});

export type RunStateType = typeof RunState.State;
