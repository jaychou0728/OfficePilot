import { describe, it, expect } from 'vitest';
import { chunkText, chunkDocument } from '../src/ingest/chunker.js';

describe('chunker', () => {
  it('splits with overlap and keeps every chunk under limit', () => {
    const text = '第一段。'.repeat(300);
    const chunks = chunkText(text, 100, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(100);
    expect(chunks[1].startOffset).toBeLessThan(chunks[0].endOffset);
  });

  it('keeps page metadata', () => {
    const chunks = chunkDocument({ text: 'x', pages: [{ page: 3, text: '一二三四五。'.repeat(30) }], sheets: [] }, 50, 10);
    expect(chunks[0].page).toBe(3);
    expect(chunks[0].sheet).toBeUndefined();
  });

  it('chunks sheets with sheet metadata', () => {
    const chunks = chunkDocument({
      text: 'x',
      pages: [],
      sheets: [{ name: '评分', rows: ['维度 | 权重', '交付能力 | 30%'] }],
    }, 100, 10);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sheet).toBe('评分');
    expect(chunks[0].text).toContain('交付能力');
    expect(chunks[0].page).toBeUndefined();
  });

  it('splits a long sheet and keeps sheet metadata on every chunk', () => {
    const rows = Array.from({ length: 100 }, (_, i) => `第 ${i} 行 | 内容`.repeat(3));
    const chunks = chunkDocument({ text: 'x', pages: [], sheets: [{ name: '长表', rows }] }, 200, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.sheet === '长表')).toBe(true);
  });

  it('offsets reconstruct the trimmed chunk text', () => {
    const text = 'line one\n   line two   \nline three';
    const chunks = chunkText(text, 12, 2);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(text.slice(chunk.startOffset, chunk.endOffset)).toBe(chunk.text);
    }
  });

  it('falls back to doc.text when pages and sheets are empty', () => {
    const chunks = chunkDocument({ text: 'a'.repeat(50), pages: [], sheets: [] }, 20, 5);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((chunk) => chunk.text.length <= 20)).toBe(true);
  });

  it('returns no chunks for empty or whitespace text', () => {
    expect(chunkText('   \n ', 10, 2)).toEqual([]);
  });
});
