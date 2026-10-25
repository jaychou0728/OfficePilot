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

function abortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  if (status != null) return status === 429 || status >= 500;
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return true;
    if (/timeout|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/i.test(error.message)) return true;
  }
  return true;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeRetry(retry?: RetryOptions): Required<RetryOptions> {
  return {
    attempts: Math.max(0, Math.trunc(retry?.attempts ?? DEFAULT_RETRY.attempts)),
    delaysMs: retry?.delaysMs ?? DEFAULT_RETRY.delaysMs,
  };
}

async function withRetry<T>(fn: () => Promise<T>, retry: Required<RetryOptions>, signal?: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retry.attempts; attempt++) {
    if (signal?.aborted) throw abortError();
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isAbort(error) || !isRetryable(error) || attempt >= retry.attempts) break;
      await sleep(retry.delaysMs[attempt] ?? 0, signal);
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
          if (opts?.signal?.aborted) throw abortError();
          let started = false;
          try {
            for await (const token of provider.stream(messages, opts)) {
              started = true;
              yield token;
            }
            return;
          } catch (error) {
            if (started) throw new AppError('LLM_UNAVAILABLE', '模型流式输出中断', String(error));
            if (isAbort(error)) throw error;
            if (!isRetryable(error) || attempt >= retry.attempts) break;
            await sleep(retry.delaysMs[attempt] ?? 0, opts?.signal);
          }
        }
      }
      throw new AppError('LLM_UNAVAILABLE');
    },
    async complete(messages, opts) {
      for (const provider of chatProviders) {
        try {
          return await withRetry(() => provider.complete(messages, opts), retry, opts?.signal);
        } catch (error) {
          if (isAbort(error)) throw error;
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
          return await withRetry(() => provider.embed(texts, signal), retry, signal);
        } catch (error) {
          if (isAbort(error)) throw error;
        }
      }
      throw new AppError('EMBEDDING_FAILED');
    },
  };

  return { chat, embed };
}
