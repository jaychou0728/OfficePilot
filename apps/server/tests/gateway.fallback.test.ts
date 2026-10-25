import { describe, it, expect } from 'vitest';
import { createGateway } from '../src/gateway/index.js';
import { createMockProvider } from '../src/gateway/mock.js';
import type { ChatProvider, EmbeddingProvider } from '../src/gateway/types.js';

const brokenChat = (): ChatProvider => ({
  ...createMockProvider(),
  async *stream() { throw new Error('boom'); },
  async complete() { throw new Error('boom'); },
});

const brokenEmbed = (): EmbeddingProvider => ({
  ...createMockProvider(),
  async embed() { throw new Error('boom'); },
});

async function collect(stream: AsyncIterable<string>): Promise<string> {
  const out: string[] = [];
  for await (const token of stream) out.push(token);
  return out.join('');
}

describe('model gateway fallback', () => {
  it('falls back to the next chat provider when the primary fails before the first token', async () => {
    const gateway = createGateway({
      chat: { primary: brokenChat(), fallback: createMockProvider({ answer: 'fallback-answer' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 0, delaysMs: [] },
    });

    expect(await collect(gateway.chat.stream([{ role: 'user', content: 'q' }]))).toBe('fallback-answer');
  });

  it('rejects with LLM_UNAVAILABLE when all chat providers fail outside demo mode', async () => {
    const gateway = createGateway({
      chat: { primary: brokenChat(), fallback: brokenChat(), demo: createMockProvider({ answer: 'demo-answer' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 0, delaysMs: [] },
      demoMode: false,
    });

    await expect(
      collect(gateway.chat.stream([{ role: 'user', content: 'q' }])),
    ).rejects.toThrow(/LLM_UNAVAILABLE|模型服务不可用/);
  });

  it('retries a flaky primary before falling back', async () => {
    let calls = 0;
    const flaky: ChatProvider = {
      ...createMockProvider(),
      async *stream() {
        calls += 1;
        if (calls === 1) throw new Error('transient');
        yield 'ok';
      },
    };
    const gateway = createGateway({
      chat: { primary: flaky, fallback: createMockProvider({ answer: 'fallback-answer' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 1, delaysMs: [0] },
    });

    expect(await collect(gateway.chat.stream([{ role: 'user', content: 'q' }]))).toBe('ok');
    expect(calls).toBe(2);
  });

  it('falls back to the next embedding provider', async () => {
    const gateway = createGateway({
      embed: { primary: brokenEmbed(), fallback: createMockProvider() },
      chat: { primary: createMockProvider() },
      retry: { attempts: 0, delaysMs: [] },
    });

    const [vector] = await gateway.embed.embed(['差旅住宿标准']);
    expect(vector.length).toBeGreaterThan(0);
  });

  it('uses the demo chat provider when primary and fallback fail in demo mode', async () => {
    const gateway = createGateway({
      chat: { primary: brokenChat(), fallback: brokenChat(), demo: createMockProvider({ answer: 'demo-answer' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 0, delaysMs: [] },
      demoMode: true,
    });

    expect(await collect(gateway.chat.stream([{ role: 'user', content: 'q' }]))).toBe('demo-answer');
  });

  it('keeps chat and embedding provider chains independent', async () => {
    const gateway = createGateway({
      chat: { primary: createMockProvider({ answer: 'chat' }) },
      embed: { primary: createMockProvider({ dim: 64 }) },
    });

    expect(await gateway.chat.complete([{ role: 'user', content: 'q' }])).toBe('chat');
    expect(gateway.embed.model).toBe('mock-local');
    const [vector] = await gateway.embed.embed(['差旅']);
    expect(vector).toHaveLength(64);
  });

  it('does not retry after the first token was emitted', async () => {
    let fallbackCalls = 0;
    const partial: ChatProvider = {
      name: 'partial',
      async *stream() { yield 'a'; throw new Error('boom'); },
      async complete() { return 'x'; },
    };
    const fallback: ChatProvider = {
      ...createMockProvider({ answer: 'fallback' }),
      async *stream() { fallbackCalls++; yield* createMockProvider({ answer: 'fallback' }).stream([]); },
    };
    const gateway = createGateway({
      chat: { primary: partial, fallback },
      embed: { primary: createMockProvider() },
      retry: { attempts: 0, delaysMs: [] },
    });
    await expect(async () => {
      for await (const _ of gateway.chat.stream([{ role: 'user', content: 'q' }])) { /* noop */ }
    }).rejects.toMatchObject({ code: 'LLM_UNAVAILABLE' });
    expect(fallbackCalls).toBe(0);
  });

  it('does not retry non-retryable 401 but falls back', async () => {
    let calls = 0;
    const unauthorized: ChatProvider = {
      name: '401',
      async *stream() { calls++; throw Object.assign(new Error('401'), { status: 401 }); },
      async complete() { calls++; throw Object.assign(new Error('401'), { status: 401 }); },
    };
    const gateway = createGateway({
      chat: { primary: unauthorized, fallback: createMockProvider({ answer: 'ok' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 2, delaysMs: [0, 0] },
    });
    await expect(gateway.chat.complete([{ role: 'user', content: 'q' }])).resolves.toBe('ok');
    expect(calls).toBe(1);
  });

  it('stops immediately on caller abort without retry or fallback', async () => {
    let calls = 0;
    const aborting: ChatProvider = {
      name: 'abort',
      async *stream() { calls++; throw abortErrorForTest(); },
      async complete() { calls++; throw abortErrorForTest(); },
    };
    const gateway = createGateway({
      chat: { primary: aborting, fallback: createMockProvider({ answer: 'fallback' }) },
      embed: { primary: createMockProvider() },
      retry: { attempts: 2, delaysMs: [0, 0] },
    });
    await expect(gateway.chat.complete([{ role: 'user', content: 'q' }])).rejects.toThrow(/aborted/);
    expect(calls).toBe(1);
  });

  it('throws EMBEDDING_FAILED when the embedding chain is exhausted', async () => {
    const gateway = createGateway({
      chat: { primary: createMockProvider() },
      embed: { primary: brokenEmbed(), fallback: brokenEmbed() },
      retry: { attempts: 0, delaysMs: [] },
    });
    await expect(gateway.embed.embed(['x'])).rejects.toMatchObject({ code: 'EMBEDDING_FAILED' });
  });

  it('uses the demo embedding provider when demoMode is true', async () => {
    const gateway = createGateway({
      chat: { primary: createMockProvider() },
      embed: { primary: brokenEmbed(), fallback: brokenEmbed(), demo: createMockProvider({ dim: 32 }) },
      demoMode: true,
      retry: { attempts: 0, delaysMs: [] },
    });
    const [vector] = await gateway.embed.embed(['x']);
    expect(vector).toHaveLength(32);
  });
});

function abortErrorForTest() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}
