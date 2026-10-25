import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('127.0.0.1'),
  DATA_DIR: z.string().default('./data').refine((value) => value.trim().length > 0, 'DATA_DIR 不能为空'),
  LLM_PROVIDER: z.string().default('mock'),
  LLM_BASE_URL: z.string().default(''),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default(''),
  EMBEDDING_BASE_URL: z.string().default(''),
  EMBEDDING_API_KEY: z.string().default(''),
  EMBEDDING_MODEL: z.string().default(''),
  FALLBACK_LLM_PROVIDER: z.string().default(''),
  FALLBACK_LLM_BASE_URL: z.string().default(''),
  FALLBACK_LLM_API_KEY: z.string().default(''),
  FALLBACK_LLM_MODEL: z.string().default(''),
  OPENAI_PROXY_BASE_URL: z.string().default(''),
  DEMO_MODE: z.string().default('false').transform((value) => ['true', '1', 'yes'].includes(value.trim().toLowerCase())),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  EMBEDDING_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  MATCH_THRESHOLD: z.coerce.number().min(0).max(1).default(0.55),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = EnvSchema.parse(env);
  return {
    ...parsed,
    repoRoot,
    dataDir: path.isAbsolute(parsed.DATA_DIR) ? parsed.DATA_DIR : path.resolve(repoRoot, parsed.DATA_DIR),
    demoMode: parsed.DEMO_MODE,
  };
}
