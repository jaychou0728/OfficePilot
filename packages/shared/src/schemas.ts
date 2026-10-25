import { z } from 'zod';

export const SkillSchema = z.enum(['qa', 'extract', 'weekly']);
export const DocumentCategorySchema = z.enum(['制度', '会议', '表格', '合同']);
export const DocumentStatusSchema = z.enum(['queued', 'parsing', 'chunking', 'embedding', 'ready', 'failed']);
export const DocumentTypeSchema = z.enum(['PDF', 'DOCX', 'XLSX', 'MD', 'TXT', 'CSV']);
export const TemplateIdSchema = z.enum(['meeting', 'supplier', 'contract', 'training']);

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DocumentTypeSchema,
  category: DocumentCategorySchema,
  size: z.number().int().nonnegative(),
  status: DocumentStatusSchema,
  stage: z.string().nullable().optional(),
  progress: z.number().int().min(0).max(100).default(0),
  chunks: z.number().int().nonnegative().default(0),
  error: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export const CreateRunSchema = z.object({
  skill: SkillSchema,
  input: z.string().min(1).max(4000),
  docIds: z.array(z.string()).max(10).default([]),
  templateId: TemplateIdSchema.nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.skill === 'extract' && value.docIds.length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['docIds'], message: '抽取必须指定恰好 1 份文档' });
  }
  if (value.skill === 'extract' && !value.templateId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['templateId'], message: '抽取必须指定字段模板' });
  }
});

export const SourceSchema = z.object({
  n: z.number().int().positive(),
  docId: z.string(),
  docName: z.string(),
  chunkId: z.string(),
  page: z.number().int().nullable().optional(),
  sheet: z.string().nullable().optional(),
  score: z.number(),
  snippet: z.string(),
});

export const BoundarySchema = z.object({
  reason: z.string(),
  missing: z.array(z.string()),
  handoff: z.string(),
});

export const QaResultSchema = z.object({
  type: z.literal('qa'),
  answer: z.string(),
  sources: z.array(SourceSchema),
  confidence: z.number().min(0).max(1),
  boundary: BoundarySchema.optional(),
});

export const ExtractResultSchema = z.object({
  type: z.literal('extract'),
  templateId: TemplateIdSchema,
  rows: z.array(z.record(z.unknown())),
  warnings: z.array(z.string()),
  sources: z.array(SourceSchema),
});

export const WeeklyResultSchema = z.object({
  type: z.literal('weekly'),
  title: z.string(),
  period: z.string(),
  sections: z.array(z.object({ heading: z.string(), items: z.array(z.string()) })),
  gap: z.string(),
  sources: z.array(SourceSchema),
});

export const RunResultSchema = z.discriminatedUnion('type', [QaResultSchema, ExtractResultSchema, WeeklyResultSchema]);

export const RunUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
});

export type Skill = z.infer<typeof SkillSchema>;
export type DocumentCategory = z.infer<typeof DocumentCategorySchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type TemplateId = z.infer<typeof TemplateIdSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type CreateRunRequest = z.infer<typeof CreateRunSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type RunResult = z.infer<typeof RunResultSchema>;
export type Boundary = z.infer<typeof BoundarySchema>;
export type QaResult = z.infer<typeof QaResultSchema>;
export type ExtractResult = z.infer<typeof ExtractResultSchema>;
export type WeeklyResult = z.infer<typeof WeeklyResultSchema>;
export type RunUsage = z.infer<typeof RunUsageSchema>;
export type CreateRunInput = z.input<typeof CreateRunSchema>;
