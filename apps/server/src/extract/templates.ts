import { z } from 'zod';
import type { TemplateId } from '@officepilot/shared';

export const TEMPLATES = {
  meeting: {
    name: '会议行动项',
    fields: ['任务', '责任人', '截止日期', '优先级', '风险'],
    schema: z.object({
      task: z.string(),
      owner: z.string(),
      dueDate: z.string(),
      priority: z.enum(['P0', 'P1', 'P2']),
      risk: z.enum(['低', '中', '高']),
    }),
  },
  supplier: {
    name: '供应商评分',
    fields: ['维度', '权重', '评分要点', '来源'],
    schema: z.object({
      dimension: z.string(),
      weight: z.string(),
      criteria: z.string(),
      source: z.string(),
    }),
  },
  contract: {
    name: '合同要素',
    fields: ['甲乙方', '金额', '期限', '违约条款'],
    schema: z.object({
      parties: z.array(z.string()).min(2),
      amount: z.string(),
      term: z.string(),
      penalty: z.string(),
    }),
  },
  training: {
    name: '培训记录',
    fields: ['课程', '讲师', '学时', '考核结果'],
    schema: z.object({
      course: z.string(),
      instructor: z.string(),
      hours: z.number(),
      result: z.string(),
    }),
  },
} satisfies Record<TemplateId, { name: string; fields: string[]; schema: z.ZodTypeAny }>;

export type Template = (typeof TEMPLATES)[TemplateId];
