import type { ErrorCode } from './errors.js';
import type { RunResult, Source } from './schemas.js';

export type SseEvent =
  | { type: 'node'; node: string; status: 'running' | 'done' | 'fail'; ms?: number; detail?: string }
  | { type: 'token'; text: string }
  | { type: 'citation'; sources: Source[] }
  | { type: 'validation'; ok: boolean; errors: Array<{ field: string; reason: string }>; attempt: number }
  | { type: 'result'; result: RunResult }
  | { type: 'error'; code: ErrorCode; message: string; retryable: boolean }
  | { type: 'done'; runId: string; usage: { promptTokens: number; completionTokens: number } };

export function serializeSse(seq: number, event: SseEvent): string {
  return `id: ${seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
