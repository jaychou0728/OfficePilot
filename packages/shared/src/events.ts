import { z } from 'zod';
import { ERROR_CODES, type ErrorCode } from './errors.js';
import { RunResultSchema, RunUsageSchema, SourceSchema } from './schemas.js';

const ErrorCodeSchema = z.enum(Object.keys(ERROR_CODES) as [ErrorCode, ...ErrorCode[]]);

export const SseEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('node'),
    node: z.string(),
    status: z.enum(['running', 'done', 'fail']),
    ms: z.number().optional(),
    detail: z.string().optional(),
  }),
  z.object({ type: z.literal('token'), text: z.string() }),
  z.object({ type: z.literal('citation'), sources: z.array(SourceSchema) }),
  z.object({
    type: z.literal('validation'),
    ok: z.boolean(),
    errors: z.array(z.object({ field: z.string(), reason: z.string() })),
    attempt: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('result'), result: RunResultSchema }),
  z.object({
    type: z.literal('error'),
    code: ErrorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
  }),
  z.object({ type: z.literal('done'), runId: z.string(), usage: RunUsageSchema }),
]);

export type SseEvent = z.infer<typeof SseEventSchema>;

export function parseSseEvent(raw: unknown): SseEvent {
  return SseEventSchema.parse(raw);
}

export function serializeSse(seq: number, event: SseEvent): string {
  const payload = event.type === 'result' ? event.result : stripType(event);
  return `id: ${seq}\nevent: ${event.type}\ndata: ${JSON.stringify(payload)}\n\n`;
}

function stripType(event: SseEvent): Record<string, unknown> {
  const { type: _type, ...rest } = event;
  return rest as Record<string, unknown>;
}
