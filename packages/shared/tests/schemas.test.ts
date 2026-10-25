import { describe, it, expect } from 'vitest';
import { AppError, CreateRunSchema, DocumentSchema, RunResultSchema, SourceSchema } from '../src/index.js';

describe('CreateRunSchema', () => {
  it('accepts a qa run', () => {
    const parsed = CreateRunSchema.parse({ skill: 'qa', input: '住宿标准？', docIds: ['d1'] });
    expect(parsed.docIds).toEqual(['d1']);
  });

  it('rejects extraction without exactly one document', () => {
    expect(() => CreateRunSchema.parse({ skill: 'extract', input: '抽取', docIds: [], templateId: 'meeting' })).toThrow();
    expect(() => CreateRunSchema.parse({ skill: 'extract', input: '抽取', docIds: ['a', 'b'], templateId: 'meeting' })).toThrow();
  });

  it('rejects extraction without a template', () => {
    expect(() => CreateRunSchema.parse({ skill: 'extract', input: '抽取', docIds: ['a'] })).toThrow();
  });
});

describe('DocumentSchema', () => {
  it('fills defaults', () => {
    const doc = DocumentSchema.parse({ id: 'd1', name: 'a.pdf', type: 'PDF', category: '制度', size: 10, status: 'ready' });
    expect(doc.progress).toBe(0);
    expect(doc.chunks).toBe(0);
  });
});

describe('SourceSchema', () => {
  it('accepts a source', () => {
    const s = SourceSchema.parse({ n: 1, docId: 'd1', docName: 'a', chunkId: 'c1', score: 0.9, snippet: 'x' });
    expect(s.n).toBe(1);
  });
});

describe('RunResultSchema', () => {
  it('accepts a qa result and rejects unknown types', () => {
    expect(RunResultSchema.parse({ type: 'qa', answer: 'x', sources: [], confidence: 0.9 }).type).toBe('qa');
    expect(() => RunResultSchema.parse({ type: 'nope' })).toThrow();
  });
});

describe('CreateRunSchema edge cases', () => {
  it('rejects extract when docIds is omitted', () => {
    expect(() => CreateRunSchema.parse({ skill: 'extract', input: 'x', templateId: 'meeting' })).toThrow();
  });

  it('rejects extract with templateId null', () => {
    expect(() => CreateRunSchema.parse({ skill: 'extract', input: 'x', docIds: ['a'], templateId: null })).toThrow();
  });
});

describe('AppError', () => {
  it('maps status/retryable and allows a message override', () => {
    const err = new AppError('SCHEMA_INVALID');
    expect(err.status).toBe(422);
    expect(err.retryable).toBe(true);
    expect(err.message).toBe('结构化输出校验失败');
    expect(new AppError('LLM_TIMEOUT', '超时了').message).toBe('超时了');
    expect(new AppError('EMBEDDING_DIM_MISMATCH').retryable).toBe(false);
  });
});
