export const ERROR_CODES = {
  DOC_UNSUPPORTED: { status: 415, retryable: false, message: '不支持该文件类型' },
  DOC_TOO_LARGE: { status: 413, retryable: false, message: '文件超过 20 MB' },
  DOC_PARSE_FAILED: { status: 422, retryable: true, message: '文档解析失败；扫描件请先 OCR' },
  DOC_DUPLICATE: { status: 409, retryable: false, message: '该文档已存在' },
  KB_NOT_READY: { status: 409, retryable: true, message: '知识库尚未就绪' },
  RUN_NOT_FOUND: { status: 404, retryable: false, message: '运行记录不存在' },
  LLM_TIMEOUT: { status: 504, retryable: true, message: '模型响应超时' },
  LLM_RATE_LIMIT: { status: 429, retryable: true, message: '模型限流，稍后重试' },
  LLM_UNAVAILABLE: { status: 503, retryable: true, message: '模型服务不可用' },
  EMBEDDING_FAILED: { status: 502, retryable: true, message: '向量化失败' },
  EMBEDDING_DIM_MISMATCH: { status: 500, retryable: false, message: '向量维度不一致，请重建索引' },
  SCHEMA_INVALID: { status: 422, retryable: true, message: '结构化输出校验失败' },
  TEMPLATE_NOT_FOUND: { status: 400, retryable: false, message: '抽取字段不存在' },
  INVALID_REQUEST: { status: 400, retryable: false, message: '请求参数不合法' },
  NOT_FOUND: { status: 404, retryable: false, message: '资源不存在' },
  INTERNAL: { status: 500, retryable: true, message: '服务内部错误' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? ERROR_CODES[code].message);
    this.name = 'AppError';
  }

  get status() { return ERROR_CODES[this.code].status; }
  get retryable() { return ERROR_CODES[this.code].retryable; }
}
