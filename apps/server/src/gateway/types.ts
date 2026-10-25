export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatOptions = { temperature?: number; maxTokens?: number; signal?: AbortSignal };

export interface ChatProvider {
  readonly name: string;
  stream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
  complete(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  embed(texts: string[], signal?: AbortSignal): Promise<number[][]>;
}

export interface ModelGateway {
  chat: ChatProvider;
  embed: EmbeddingProvider;
}
