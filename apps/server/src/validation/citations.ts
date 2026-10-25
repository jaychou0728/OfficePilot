import type { Source } from '@officepilot/shared';

export type ValidationResult = {
  ok: boolean;
  errors: Array<{ field: string; reason: string }>;
  coverage: number;
};

const REF_RE = /\[(\d+)\]/g;
const DATE_RE = /\d{4}\s*[-/.年]\s*\d{1,2}\s*[-/.月]\s*\d{1,2}\s*日?|\d{1,2}\s*月\s*\d{1,2}\s*日?/g;
const NUMBER_RE = /-?\d{1,3}(?:[,，]\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

const nfkc = (value: string) => value.normalize('NFKC');
const normalizeNumber = (value: string) => value.replace(/[,，\s]/g, '');
const canonicalDate = (value: string) =>
  value.replace(/[年/.]/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/[,，\s]/g, '');

export function validateCitations(answer: string, sources: Source[]): ValidationResult {
  const errors: ValidationResult['errors'] = [];
  const text = nfkc(answer);
  const refs = [...text.matchAll(REF_RE)].map((match) => Number(match[1]));
  const uniqueRefs = [...new Set(refs)];

  if (!refs.length) {
    errors.push({ field: 'citations', reason: '回答没有引用' });
  }
  for (const n of uniqueRefs) {
    if (!sources.some((source) => source.n === n)) {
      errors.push({ field: `[${n}]`, reason: '引用编号不存在' });
    }
  }

  const citedSources = sources.filter((source) => refs.includes(source.n));
  const citedText = nfkc(citedSources.map((source) => source.snippet).join('\n'));
  const body = text.replace(REF_RE, '');

  const citedDates = new Set(
    [...citedText.matchAll(DATE_RE)].map((match) => canonicalDate(match[0])),
  );
  const dates = [...new Set([...body.matchAll(DATE_RE)].map((match) => match[0]))];
  for (const date of dates) {
    if (!citedDates.has(canonicalDate(date))) {
      errors.push({ field: date, reason: `日期 ${date} 未在引用片段中找到` });
    }
  }

  const bodyWithoutDates = body.replace(DATE_RE, ' ');
  const citedNumbers = new Set(
    [...citedText.matchAll(NUMBER_RE)].flatMap((match) => {
      const token = normalizeNumber(match[0]);
      // 逗号常作列表分隔（如“650，900”，NFKC 后为“650,900”），
      // 同时保留整体与各项，避免把列表粘成一个数
      const parts = match[0].split(/[,，]/).map(normalizeNumber).filter(Boolean);
      return parts.length > 1 ? [token, ...parts] : [token];
    }),
  );
  const numbers = [...new Set([...bodyWithoutDates.matchAll(NUMBER_RE)].map((match) => match[0]))];
  for (const token of numbers) {
    if (!citedNumbers.has(normalizeNumber(token))) {
      errors.push({ field: token, reason: `数字 ${token} 未在引用片段中找到` });
    }
  }

  const coverage = uniqueRefs.length ? citedSources.length / uniqueRefs.length : 0;
  return { ok: errors.length === 0, errors, coverage };
}

export function confidence(topSimilarity: number, citationCoverage: number, passed: boolean): number {
  const top = Number.isFinite(topSimilarity) ? topSimilarity : 0;
  const coverage = Number.isFinite(citationCoverage) ? citationCoverage : 0;
  const value = 0.5 * top + 0.3 * Math.min(1, Math.max(0, coverage)) + 0.2 * (passed ? 1 : 0);
  return Number.isFinite(value)
    ? Math.round(Math.min(1, Math.max(0, value)) * 100) / 100
    : 0;
}
