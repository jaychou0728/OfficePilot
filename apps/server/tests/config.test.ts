import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('anchors a relative DATA_DIR to the repo root', () => {
    const config = loadConfig({ DATA_DIR: 'data' } as NodeJS.ProcessEnv);
    expect(path.isAbsolute(config.dataDir)).toBe(true);
    expect(config.dataDir.endsWith(path.join('腾讯选修课课程作业', 'data'))).toBe(true);
  });

  it('keeps an absolute DATA_DIR', () => {
    const abs = 'D:/somewhere/data';
    expect(loadConfig({ DATA_DIR: abs } as NodeJS.ProcessEnv).dataDir).toBe(abs);
  });

  it('parses demo mode variants', () => {
    expect(loadConfig({ DEMO_MODE: 'TRUE' } as NodeJS.ProcessEnv).demoMode).toBe(true);
    expect(loadConfig({ DEMO_MODE: '1' } as NodeJS.ProcessEnv).demoMode).toBe(true);
    expect(loadConfig({ DEMO_MODE: 'false' } as NodeJS.ProcessEnv).demoMode).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: '-1' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ MATCH_THRESHOLD: '2' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ DATA_DIR: '   ' } as NodeJS.ProcessEnv)).toThrow();
  });
});
