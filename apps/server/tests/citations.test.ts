import { describe, it, expect } from 'vitest';
import { validateCitations, confidence } from '../src/validation/citations.js';

const src = (n: number, snippet: string) => ({
  n, docId: 'd', docName: 'doc', chunkId: `c${n}`, score: 0.9, snippet,
});

describe('citation validation', () => {
  it('passes when citations and numbers are grounded', () => {
    const result = validateCitations('住宿上限为 650 元[1]', [src(1, '住宿费标准为每人每晚不超过 650 元')]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when a number is not in the cited snippet', () => {
    const result = validateCitations('住宿上限为 900 元[1]', [src(1, '住宿费标准为每人每晚不超过 650 元')]);
    expect(result.ok).toBe(false);
    expect(result.errors[0].reason).toContain('900');
  });

  it('fails when a citation marker has no source', () => {
    const result = validateCitations('住宿上限为 650 元[2]', [src(1, '住宿上限为 650 元')]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === '[2]')).toBe(true);
  });

  it('fails when the answer has no citation', () => {
    const result = validateCitations('住宿上限为 650 元', [src(1, '住宿上限为 650 元')]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.field === 'citations')).toBe(true);
  });

  it('normalizes spaces and commas in numeric grounding', () => {
    const result = validateCitations('预算为 1,200 元[1]', [src(1, '预算 1200 元')]);
    expect(result.ok).toBe(true);
  });

  it('does not treat 650 as grounded in 6500', () => {
    const result = validateCitations('上限 650 元[1]', [src(1, '上限 6500 元')]);
    expect(result.ok).toBe(false);
  });

  it('handles thousands separators in both directions', () => {
    expect(validateCitations('预算 1,200 元[1]', [src(1, '预算 1200 元')]).ok).toBe(true);
    expect(validateCitations('预算 1200 元[1]', [src(1, '预算 1,200 元')]).ok).toBe(true);
  });

  it('requires dates to be grounded as a whole date', () => {
    expect(validateCitations('日期 2025-11-25[1]', [src(1, '发布于 2025 年 11 月 25 日')]).ok).toBe(true);
    expect(validateCitations('日期 2025-11-25[1]', [src(1, '发布于 2025 年，费用 11 元，人数 25 人')]).ok).toBe(false);
  });

  it('grounds list numbers without destroying separators', () => {
    const result = validateCitations('标准 650 元[1]', [src(1, '标准 650，900 元')]);
    expect(result.ok).toBe(true);
  });

  it('rejects negative and full-width mismatches correctly', () => {
    expect(validateCitations('价格 -650 元[1]', [src(1, '价格 650 元')]).ok).toBe(false);
    expect(validateCitations('价格 ６５０ 元[1]', [src(1, '价格 650 元')]).ok).toBe(true);
  });

  it('reports citation coverage', () => {
    const sources = [src(1, 'a 650'), src(2, 'b 900')];
    expect(validateCitations('650[1] 900[2]', sources).coverage).toBe(1);
    expect(validateCitations('650[1]', sources).coverage).toBe(1);
    expect(validateCitations('650[1] 900[2]', [sources[0]]).coverage).toBe(0.5);
  });

  it('computes a bounded confidence', () => {
    expect(confidence(0.9, 1, true)).toBeCloseTo(0.95, 2);
    expect(confidence(0, 0, false)).toBe(0);
    expect(confidence(2, 2, true)).toBe(1);
  });
});
