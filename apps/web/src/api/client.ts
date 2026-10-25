import type {
  CreateRunRequest,
  Document,
  DocumentCategory,
  RunResult,
  RunUsage,
  Skill,
  TemplateId,
} from '@officepilot/shared';

export type HealthResponse = {
  status: string;
  db: string;
  embeddingDim: number | null;
  demoMode: boolean;
  providers: Array<{ name: string; ok: boolean; latencyMs: number | null }>;
};

export type RunDetail = {
  id: string;
  skill: Skill;
  input: string;
  docIds: string[];
  templateId: TemplateId | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | (string & {});
  result: RunResult | null;
  errorCode: string | null;
  errorMessage: string | null;
  usage: RunUsage | null;
  timeline: Array<{ node: string; status: string; ms?: number; detail?: string }>;
  createdAt: string;
  finishedAt: string | null;
};

export type ErrorEnvelope = {
  code: string;
  message: string;
  retryable: boolean;
  requestId?: string;
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number;
  readonly requestId?: string;

  constructor(
    message: string,
    options: { code?: string; retryable?: boolean; status?: number; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = options.code ?? 'REQUEST_FAILED';
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? 0;
    this.requestId = options.requestId;
  }
}

const NETWORK_MESSAGE = '无法连接后端服务，请确认服务已启动';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: ErrorEnvelope } | null;
    const error = body?.error;
    throw new ApiRequestError(error?.message || `请求失败（HTTP ${response.status}）`, {
      code: error?.code ?? 'HTTP_ERROR',
      retryable: error?.retryable ?? false,
      status: response.status,
      requestId: error?.requestId,
    });
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiRequestError(NETWORK_MESSAGE, { code: 'NETWORK', retryable: true });
  }
  return parseResponse<T>(response);
}

export function toReadableError(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return '发生未知错误，请稍后重试';
}

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  listDocuments: () => request<{ items: Document[]; total: number }>('/api/documents'),

  uploadDocument: (file: File, category: DocumentCategory) => {
    const form = new FormData();
    // Fastify's multipart parser reads `file` first and then exposes the remaining
    // fields on it, so `category` must be appended before the file.
    form.append('category', category);
    form.append('file', file);
    return request<{ document: Document }>('/api/documents', { method: 'POST', body: form });
  },

  deleteDocument: (id: string) =>
    request<void>(`/api/documents/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  reindexDocument: (id: string) =>
    request<{ skipped?: boolean; document?: Document | null }>(
      `/api/documents/${encodeURIComponent(id)}/reindex`,
      { method: 'POST' },
    ),

  createRun: (body: CreateRunRequest) =>
    request<{ runId: string; status: string }>('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getRun: (id: string) =>
    request<{ run: RunDetail }>(`/api/runs/${encodeURIComponent(id)}`),
};
