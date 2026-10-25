import { describe, it, expect } from 'vitest';
import { routeInput } from '../src/graph/nodes/router.js';

describe('router', () => {
  it('detects summary intent', () => {
    expect(routeInput('帮我总结这份文档', 'qa').operation).toBe('summary');
  });
  it('keeps explicit skills', () => {
    expect(routeInput('抽取行动项', 'extract').skill).toBe('extract');
    expect(routeInput('写周报', 'weekly').operation).toBe('weekly');
  });
  it('defaults to answer', () => {
    expect(routeInput('今天天气不错', 'qa').operation).toBe('answer');
  });
});
