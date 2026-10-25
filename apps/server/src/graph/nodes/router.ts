import type { Skill } from '@officepilot/shared';

export function routeInput(
  input: string,
  skill: Skill,
): { skill: Skill; operation: 'answer' | 'summary' | 'extract' | 'weekly' } {
  if (skill === 'extract') return { skill, operation: 'extract' };
  if (skill === 'weekly') return { skill, operation: 'weekly' };
  if (/总结|摘要/.test(input)) return { skill, operation: 'summary' };
  return { skill: 'qa', operation: 'answer' };
}
