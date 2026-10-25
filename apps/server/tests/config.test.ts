import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';

const repoRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

describe('loadConfig', () => {
  it('anchors a relative DATA_DIR to the repo root', () => {
    const config = loadConfig({ DATA_DIR: 'data' } as NodeJS.ProcessEnv);
    expect(config.dataDir).toBe(path.join(repoRoot, 'data'));
  });

  it('keeps an absolute DATA_DIR', () => {
    const abs = path.resolve('somewhere', 'data');
    expect(loadConfig({ DATA_DIR: abs } as NodeJS.ProcessEnv).dataDir).toBe(abs);
  });

  it('parses demo mode variants', () => {
    expect(loadConfig({ DEMO_MODE: 'TRUE' } as NodeJS.ProcessEnv).demoMode).toBe(true);
    expect(loadConfig({ DEMO_MODE: '1' } as NodeJS.ProcessEnv).demoMode).toBe(true);
    expect(loadConfig({ DEMO_MODE: 'yes' } as NodeJS.ProcessEnv).demoMode).toBe(true);
    expect(loadConfig({ DEMO_MODE: 'false' } as NodeJS.ProcessEnv).demoMode).toBe(false);
  });

  it('rejects invalid values', () => {
    expect(() => loadConfig({ PORT: '-1' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ PORT: '70000' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ LLM_TIMEOUT_MS: '0' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ MATCH_THRESHOLD: '-1' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ MATCH_THRESHOLD: '2' } as NodeJS.ProcessEnv)).toThrow();
    expect(() => loadConfig({ DATA_DIR: '   ' } as NodeJS.ProcessEnv)).toThrow();
  });
});
