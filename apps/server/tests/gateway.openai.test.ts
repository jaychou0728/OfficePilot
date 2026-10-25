import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createOpenAiProvider } from '../src/gateway/openai.js';

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : {};
      if (req.url?.endsWith('/chat/completions')) {
        if (body.messages?.[0]?.content === 'stream-error') {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          res.write('data: {"error":{"message":"rate limited"}}\n\n');
          res.end();
          return;
        }
        if (body.model === 'fail') {
          res.writeHead(429, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'rate limited' } }));
          return;
        }
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream' });
          for (const text of ['一线城市', '住宿标准', '是 650 元']) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { content: 'done' } }] }));
        }
      } else if (req.url?.endsWith('/embeddings')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }));
      } else {
        res.writeHead(404).end();
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address && typeof address === 'object') baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function provider() {
  return createOpenAiProvider({ baseUrl, apiKey: 'k', model: 'm', timeoutMs: 5000 });
}

describe('openai provider', () => {
  it('streams chat tokens', async () => {
    const out: string[] = [];
    for await (const token of provider().stream([{ role: 'user', content: 'hi' }])) out.push(token);
    expect(out.join('')).toBe('一线城市住宿标准是 650 元');
  });

  it('completes non-streaming chat', async () => {
    await expect(provider().complete([{ role: 'user', content: 'hi' }])).resolves.toBe('done');
  });

  it('embeds text', async () => {
    await expect(provider().embed(['hi'])).resolves.toEqual([[0.1, 0.2, 0.3]]);
  });

  it('throws on an SSE error event', async () => {
    await expect(async () => {
      for await (const _ of provider().stream([{ role: 'user', content: 'stream-error' }])) {
        /* noop */
      }
    }).rejects.toThrow(/rate limited/);
  });

  it('surfaces non-2xx responses with status', async () => {
    const failing = createOpenAiProvider({ baseUrl, apiKey: 'k', model: 'fail', timeoutMs: 5000 });
    await expect(failing.complete([{ role: 'user', content: 'hi' }])).rejects.toThrow(/429/);
  });

  it('enforces the timeout even when a caller signal is supplied', async () => {
    const slow = http.createServer(() => { /* never responds */ });
    await new Promise<void>((resolve) => slow.listen(0, '127.0.0.1', resolve));
    const address = slow.address();
    const slowUrl = `http://127.0.0.1:${(address as { port: number }).port}`;
    const slowProvider = createOpenAiProvider({ baseUrl: slowUrl, apiKey: 'k', model: 'm', timeoutMs: 120 });
    const controller = new AbortController();
    try {
      await expect(slowProvider.complete([{ role: 'user', content: 'hi' }], { signal: controller.signal })).rejects.toThrow();
    } finally {
      await new Promise<void>((resolve) => slow.close(() => resolve()));
    }
  });
});
