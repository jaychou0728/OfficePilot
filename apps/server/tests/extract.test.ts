import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../src/extract/templates.js';
import { parseJsonObject, extractStructured } from '../src/graph/nodes/extract.js';
import type { ChatProvider } from '../src/gateway/types.js';

describe('templates', () => {
  it('exposes four templates', () => {
    expect(Object.keys(TEMPLATES)).toEqual(['meeting', 'supplier', 'contract', 'training']);
    expect(TEMPLATES.meeting.fields).toContain('截止日期');
  });
  it('parses fenced and prose-wrapped json', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('结果为：[{"a":1}] 谢谢')).toEqual([{ a: 1 }]);
  });
});

describe('extractStructured', () => {
  it('retries after invalid JSON and returns schema-valid rows', async () => {
    let calls = 0;
    const provider: ChatProvider = {
      name: 'mock',
      async complete() {
        calls++;
        return calls === 1
          ? 'not json'
          : JSON.stringify([{ task: '交付原型', owner: '林澈', dueDate: '2026-11-03', priority: 'P0', risk: '中' }]);
      },
      async *stream() {},
    };
    const validation: unknown[] = [];
    const emitter = {
      emit: (event: unknown) => validation.push(event),
      node() {},
      token() {},
      flush: async () => {},
    } as never;

    const result = await extractStructured({
      provider,
      templateId: 'meeting',
      documentText: '林澈负责 11 月 3 日交付原型',
      emitter,
    });

    expect(calls).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(validation).toHaveLength(1);
  });

  it('returns field errors after two invalid attempts', async () => {
    const provider: ChatProvider = {
      name: 'bad',
      async complete() { return '[{"task":"x"}]'; },
      async *stream() {},
    };
    const emitter = { emit() {}, node() {}, token() {}, flush: async () => {} } as never;
    const result = await extractStructured({ provider, templateId: 'meeting', documentText: 'x', emitter });
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toBeTruthy();
  });
});
