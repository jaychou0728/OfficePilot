import { describe, it, expect } from 'vitest';
import { CreateRunSchema, DocumentSchema, SourceSchema } from '../src/index.js';

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
