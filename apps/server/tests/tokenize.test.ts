import { describe, it, expect } from 'vitest';
import { tokenizeForFts, toFtsQuery } from '../src/rag/tokenize.js';

describe('tokenizeForFts', () => {
  it('turns chinese runs into bigrams and lowercases english', () => {
    expect(tokenizeForFts('员工差旅住宿标准 650 元')).toBe('员工 工差 差旅 旅住 住宿 宿标 标准 650 元');
    expect(tokenizeForFts('Hello 世界')).toBe('hello 世界');
  });

  it('builds an OR query', () => {
    expect(toFtsQuery('差旅 住宿')).toBe('"差旅" OR "住宿"');
  });
});
