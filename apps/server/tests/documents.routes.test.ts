import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'officepilot-routes-'));

function multipartBody(text: string) {
  const boundary = '----officepilot-test';
  return {
    boundary,
    body:
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="category"\r\n\r\n' +
      '制度\r\n' +
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="a.md"\r\n' +
      'Content-Type: text/markdown\r\n\r\n' +
      `${text}\r\n` +
      `--${boundary}--\r\n`,
  };
}

describe('documents routes', () => {
  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('uploads, indexes, lists, returns chunks, skips unchanged reindex and deletes', async () => {
    const app = buildApp({
      dbPath: ':memory:',
      env: { LLM_PROVIDER: 'mock', DEMO_MODE: 'false', DATA_DIR: dataDir } as NodeJS.ProcessEnv,
    });

    const { boundary, body } = multipartBody('一线城市住宿 650 元。');
    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/documents',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(uploaded.statusCode).toBe(202);
    const docId = uploaded.json().document.id as string;

    let document: { status: string } | null = null;
    for (let i = 0; i < 30; i++) {
      const res = await app.inject({ method: 'GET', url: `/api/documents/${docId}` });
      document = res.json().document;
      if (document?.status === 'ready' || document?.status === 'failed') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(document?.status).toBe('ready');

    const list = await app.inject({ method: 'GET', url: '/api/documents' });
    expect(list.json().total).toBe(1);

    const chunks = await app.inject({ method: 'GET', url: `/api/documents/${docId}/chunks` });
    expect(chunks.json().total).toBeGreaterThan(0);
    expect(chunks.json().items[0].embedding).toBeUndefined();
    expect(chunks.json().items[0].text).toContain('650');

    const reindex = await app.inject({ method: 'POST', url: `/api/documents/${docId}/reindex` });
    expect(reindex.statusCode).toBe(200);
    expect(reindex.json()).toEqual({ skipped: true });

    const removed = await app.inject({ method: 'DELETE', url: `/api/documents/${docId}` });
    expect(removed.statusCode).toBe(204);

    const missing = await app.inject({ method: 'GET', url: `/api/documents/${docId}` });
    expect(missing.statusCode).toBe(404);

    await app.close();
  });
});
