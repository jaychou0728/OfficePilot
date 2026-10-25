import type { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types.js';

type OpenAiConfig = { baseUrl: string; apiKey: string; model: string; timeoutMs: number; proxyBaseUrl?: string };

export function createOpenAiProvider(config: OpenAiConfig): ChatProvider & EmbeddingProvider {
  const base = (config.proxyBaseUrl || config.baseUrl).replace(/\/+$/, '');

  async function request(path: string, body: unknown, signal?: AbortSignal) {
    const timeout = AbortSignal.timeout(config.timeoutMs);
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
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

      if (!res.body) throw new Error('provider returned no body');
      const reader = res.body.getReader();
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
            if (json.error) throw new Error(`provider stream error: ${json.error.message ?? JSON.stringify(json.error)}`);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          }
        }
        const tail = buffer.trim();
        if (tail.startsWith('data:')) {
          const data = tail.slice(5).trim();
          if (data && data !== '[DONE]') {
            let json: { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> } | undefined;
            try {
              json = JSON.parse(data);
            } catch {
              json = undefined;
            }
            if (json) {
              if (json.error) throw new Error(`provider stream error: ${json.error.message ?? JSON.stringify(json.error)}`);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) yield delta;
            }
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
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
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('provider response missing content');
      return content;
    },

    async embed(texts: string[], signal?: AbortSignal) {
      const res = await request('/embeddings', { model: config.model, input: texts }, signal);
      const json = await res.json() as { data?: Array<{ embedding: number[] }> };
      const data = json.data;
      if (!Array.isArray(data)) throw new Error('provider response missing embeddings');
      return data.map((item) => item.embedding);
    },
  };
}
