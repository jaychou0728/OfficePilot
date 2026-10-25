import { AppError } from '@officepilot/shared';
import type { ChatProvider, EmbeddingProvider, ModelGateway } from './types.js';

export type RetryOptions = { attempts?: number; delaysMs?: number[] };

export type GatewayOptions = {
  chat: { primary: ChatProvider; fallback?: ChatProvider; demo?: ChatProvider };
  embed: { primary: EmbeddingProvider; fallback?: EmbeddingProvider; demo?: EmbeddingProvider };
  retry?: RetryOptions;
  demoMode?: boolean;
};

const DEFAULT_RETRY: Required<RetryOptions> = { attempts: 2, delaysMs: [1000, 3000] };

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function normalizeRetry(retry?: RetryOptions): Required<RetryOptions> {
  return {
    attempts: Math.max(0, retry?.attempts ?? DEFAULT_RETRY.attempts),
    delaysMs: retry?.delaysMs ?? DEFAULT_RETRY.delaysMs,
  };
}

async function withRetry<T>(fn: () => Promise<T>, retry: Required<RetryOptions>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retry.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retry.attempts) await sleep(retry.delaysMs[attempt] ?? 0);
    }
  }
  throw lastError;
}

export function createGateway(options: GatewayOptions): ModelGateway {
  const retry = normalizeRetry(options.retry);
  const chatProviders = [options.chat.primary, options.chat.fallback, options.demoMode ? options.chat.demo : undefined]
    .filter(Boolean) as ChatProvider[];
  const embedProviders = [options.embed.primary, options.embed.fallback, options.demoMode ? options.embed.demo : undefined]
    .filter(Boolean) as EmbeddingProvider[];

  const chat: ChatProvider = {
    name: options.chat.primary.name,
    async *stream(messages, opts) {
      for (const provider of chatProviders) {
        for (let attempt = 0; attempt <= retry.attempts; attempt++) {
          let started = false;
          try {
            for await (const token of provider.stream(messages, opts)) {
              started = true;
              yield token;
            }
            return;
          } catch (error) {
            if (started) throw new AppError('LLM_UNAVAILABLE', '模型流式输出中断', String(error));
            if (attempt >= retry.attempts) break;
            await sleep(retry.delaysMs[attempt] ?? 0);
          }
        }
      }
      throw new AppError('LLM_UNAVAILABLE');
    },
    async complete(messages, opts) {
      for (const provider of chatProviders) {
        try {
          return await withRetry(() => provider.complete(messages, opts), retry);
        } catch {
          // try the next provider
        }
      }
      throw new AppError('LLM_UNAVAILABLE');
    },
  };

  const embed: EmbeddingProvider = {
    name: options.embed.primary.name,
    model: options.embed.primary.model,
    async embed(texts, signal) {
      for (const provider of embedProviders) {
        try {
          return await withRetry(() => provider.embed(texts, signal), retry);
        } catch {
          // try the next provider
        }
      }
      throw new AppError('EMBEDDING_FAILED');
    },
  };

  return { chat, embed };
}
