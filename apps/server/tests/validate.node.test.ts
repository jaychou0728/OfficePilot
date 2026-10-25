import { describe, it, expect } from 'vitest';
import { decideAfterValidation, boundaryResult } from '../src/graph/nodes/validate.js';

describe('validation decisions', () => {
  it('retries then degrades', () => {
    expect(decideAfterValidation(false, 0)).toBe('retry');
    expect(decideAfterValidation(false, 2)).toBe('degrade');
    expect(decideAfterValidation(true, 1)).toBe('done');
  });
  it('builds a boundary result', () => {
    const result = boundaryResult('海外差旅', ['境外差旅规定']);
    expect(result.boundary?.handoff).toContain('转人工');
    expect(result.sources).toEqual([]);
  });
});
