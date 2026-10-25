import type { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types.js';

type OpenAiConfig = { baseUrl: string; apiKey: string; model: string; timeoutMs: number; proxyBaseUrl?: string };

export function createOpenAiProvider(config: OpenAiConfig): ChatProvider & EmbeddingProvider {
  const base = (config.proxyBaseUrl || config.baseUrl).replace(/\/$/, '');

  async function request(path: string, body: unknown, signal?: AbortSignal) {
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) {
      const text = await res.text();
      const error = new Error(`provider ${res.status}: ${text}`) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    return res;
  }

  return {
    name: 'openai-compatible',
    model: config.model,

    async *stream(messages: ChatMessage[], options: ChatOptions = {}) {
      const res = await request('/chat/completions', {
        model: config.model,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
      }, options.signal);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index: number;
          while ((index = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, index).trim();
            buffer = buffer.slice(index + 1);
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') return;
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          }
        }
      } finally {
        reader.releaseLock();
      }
    },

    async complete(messages: ChatMessage[], options: ChatOptions = {}) {
      const res = await request('/chat/completions', {
        model: config.model,
        messages,
        stream: false,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens,
      }, options.signal);
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      return json.choices?.[0]?.message?.content ?? '';
    },

    async embed(texts: string[], signal?: AbortSignal) {
      const res = await request('/embeddings', { model: config.model, input: texts }, signal);
      const json = await res.json() as { data?: Array<{ embedding: number[] }> };
      return (json.data ?? []).map((item) => item.embedding);
    },
  };
}
