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
});
