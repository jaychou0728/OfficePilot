import { describe, it, expect } from 'vitest';
import { mapReduceSummary } from '../src/rag/summarize.js';

describe('mapReduceSummary', () => {
  it('summarizes batches and combines', async () => {
    const texts = ['第一段'.repeat(100), '第二段'.repeat(100)];
    const result = await mapReduceSummary(texts, {
      summarize: async (text) => `摘要:${text.slice(0, 2)}`,
      combine: async (parts) => parts.join('|'),
    }, 1);
    expect(result).toContain('摘要:');
    expect(result.split('|')).toHaveLength(2);
  });

  it('returns empty without calling providers for empty input', async () => {
    let calls = 0;
    const result = await mapReduceSummary([], {
      summarize: async () => { calls++; return 'x'; },
      combine: async () => { calls++; return 'y'; },
    });
    expect(result).toBe('');
    expect(calls).toBe(0);
  });

  it('does not combine a single batch', async () => {
    let combined = false;
    const result = await mapReduceSummary(['a', 'b'], {
      summarize: async () => 's',
      combine: async () => { combined = true; return 'c'; },
    }, 10);
    expect(result).toBe('s');
    expect(combined).toBe(false);
  });

  it('falls back to batch size 1 for non-finite input', async () => {
    let calls = 0;
    const result = await mapReduceSummary(['a', 'b'], {
      summarize: async () => { calls++; return 's'; },
      combine: async (parts) => parts.join('|'),
    }, NaN);
    expect(calls).toBe(2);
    expect(result).toBe('s|s');
  });

  it('ignores whitespace-only texts', async () => {
    let calls = 0;
    const result = await mapReduceSummary(['   '], {
      summarize: async () => { calls++; return 'x'; },
      combine: async () => 'y',
    });
    expect(result).toBe('');
    expect(calls).toBe(0);
  });

  it('clamps a non-positive batch size to 1', async () => {
    const calls: string[] = [];
    const result = await mapReduceSummary(['a', 'b'], {
      summarize: async (text) => { calls.push(text); return 's'; },
      combine: async (parts) => parts.join('|'),
    }, 0);
    expect(calls).toHaveLength(2);
    expect(result).toBe('s|s');
  });
});
