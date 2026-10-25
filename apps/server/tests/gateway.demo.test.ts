import { describe, it, expect } from 'vitest';
import { createDemoProvider } from '../src/gateway/demo.js';
import { TEMPLATES } from '../src/extract/templates.js';
import { parseWeeklySections } from '../src/graph/weekly.js';

async function collect(stream: AsyncIterable<string>): Promise<string> {
  const out: string[] = [];
  for await (const token of stream) out.push(token);
  return out.join('');
}

describe('demo provider', () => {
  it('streams the travel QA answer containing 650', async () => {
    const provider = createDemoProvider();
    const answer = await collect(provider.stream([
      { role: 'system', content: '只依据给定片段回答；每段结论后附 [n] 引用。' },
      { role: 'user', content: '片段：\n[1] 一线城市住宿费上限为每人每晚 650 元。\n\n问题：一线城市住宿标准是多少？' },
    ]));
    expect(answer).toContain('650');
  });

  it('extracts five meeting action rows that satisfy the meeting schema', async () => {
    const provider = createDemoProvider();
    const text = await provider.complete([
      { role: 'system', content: '只输出 JSON 数组，不要解释。' },
      { role: 'user', content: '字段：任务、责任人、截止日期、优先级、风险\n\n文档：\n会议行动项……' },
    ]);
    const rows = JSON.parse(text) as unknown[];
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(() => TEMPLATES.meeting.schema.parse(row)).not.toThrow();
    }
  });

  it('composes a weekly report with four headings', async () => {
    const provider = createDemoProvider();
    const text = await provider.complete([
      { role: 'system', content: '按「本周完成 / 进行中 / 风险与阻塞 / 下周计划」四段输出周报。' },
      { role: 'user', content: '- 要点：本周工作按计划推进' },
    ]);
    const sections = parseWeeklySections(text);
    expect(sections).toHaveLength(4);
    expect(sections.map((section) => section.heading)).toEqual(['本周完成', '进行中', '风险与阻塞', '下周计划']);
    expect(sections.every((section) => section.items.length > 0)).toBe(true);
  });

  it('embeds text in the same 256-dimension space as the mock provider', async () => {
    const provider = createDemoProvider();
    const [vector] = await provider.embed(['差旅住宿标准']);
    expect(vector).toHaveLength(256);
  });
});
