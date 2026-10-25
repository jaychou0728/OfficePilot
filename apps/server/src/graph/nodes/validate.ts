import type { Source } from '@officepilot/shared';

export function decideAfterValidation(ok: boolean, attempts: number): 'done' | 'retry' | 'degrade' {
  if (ok) return 'done';
  return attempts < 2 ? 'retry' : 'degrade';
}

export function boundaryResult(topic: string, missing: string[]) {
  return {
    type: 'qa' as const,
    answer: `当前知识库未覆盖「${topic}」，我不会基于常识推测。`,
    sources: [] as Source[],
    confidence: 0,
    boundary: {
      reason: `知识库没有与「${topic}」直接相关且高于阈值的片段。`,
      missing,
      handoff: `建议补充${missing.join('、')}，或在 OA 发起制度咨询工单，转人工确认。`,
    },
  };
}
