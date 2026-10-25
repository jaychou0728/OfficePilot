import type { Source } from '@officepilot/shared';

export type ValidationResult = {
  ok: boolean;
  errors: Array<{ field: string; reason: string }>;
};

export function validateCitations(answer: string, sources: Source[]): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const refs = [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));

  if (!refs.length) {
    errors.push({ field: 'citations', reason: '回答没有引用' });
  }
  for (const n of refs) {
    if (!sources.some((source) => source.n === n)) {
      errors.push({ field: `[${n}]`, reason: '引用编号不存在' });
    }
  }

  // 引用标记 [1] 本身不是数字事实，先剥离再抽取正文数字
  const body = answer.replace(/\[\d+\]/g, '');
  const citedText = sources
    .filter((source) => refs.includes(source.n))
    .map((source) => source.snippet)
    .join('\n');
  const NUMBER_RE = /\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
  const numbers = [...body.matchAll(NUMBER_RE)].map((match) => match[0]);
  const normalize = (value: string) => value.replace(/[,，\s]/g, '');
  const citedNormalized = normalize(citedText);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const token of numbers) {
    const pattern = new RegExp(`(^|\\D)${escape(normalize(token))}(\\D|$)`);
    if (!pattern.test(citedNormalized)) {
      errors.push({ field: token, reason: `数字 ${token} 未在引用片段中找到` });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function confidence(topSimilarity: number, citationCoverage: number, passed: boolean): number {
  const value =
    0.5 * topSimilarity +
    0.3 * Math.min(1, Math.max(0, citationCoverage)) +
    0.2 * (passed ? 1 : 0);
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}
