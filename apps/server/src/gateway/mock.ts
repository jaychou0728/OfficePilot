import type { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types.js';
import { tokenizeForFts } from '../rag/tokenize.js';

const DEFAULT_ANSWER = '根据已入库文档，一线城市住宿费上限为 650 元/晚，差旅补贴为 120 元/天。[1][2]';

export function hashEmbedding(text: string, dim = 256): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const token of tokenizeForFts(text).split(' ').filter(Boolean)) {
    let h = 2166136261;
    for (const ch of token) {
      h ^= ch.codePointAt(0)!;
      h = Math.imul(h, 16777619);
    }
    const index = (h >>> 0) % dim;
    vec[index] += 1;
  }
  const norm = Math.hypot(...vec) || 1;
  return vec.map((value) => value / norm);
}

export function createMockProvider(options: { answer?: string; dim?: number } = {}): ChatProvider & EmbeddingProvider {
  const answer = options.answer ?? DEFAULT_ANSWER;
  const dim = options.dim ?? 256;
  return {
    name: 'mock',
    model: 'mock-local',
    async *stream(_messages: ChatMessage[], _options?: ChatOptions) {
      const chars = Array.from(answer);
      for (let i = 0; i < chars.length; i += 8) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        yield chars.slice(i, i + 8).join('');
      }
    },
    async complete(_messages: ChatMessage[], _options?: ChatOptions) {
      return answer;
    },
    async embed(texts: string[]) {
      return texts.map((text) => hashEmbedding(text, dim));
    },
  };
}
