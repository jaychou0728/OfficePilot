export async function mapReduceSummary(
  texts: string[],
  io: {
    summarize: (text: string) => Promise<string>;
    combine: (parts: string[]) => Promise<string>;
  },
  batchSize = 6,
): Promise<string> {
  const meaningful = texts.filter((text) => text.trim().length > 0);
  if (!meaningful.length) return '';
  const size = Number.isFinite(batchSize) ? Math.max(1, Math.trunc(batchSize)) : 1;
  const parts: string[] = [];

  for (let i = 0; i < meaningful.length; i += size) {
    parts.push(await io.summarize(meaningful.slice(i, i + size).join('\n\n')));
  }

  return parts.length === 1 ? parts[0] : io.combine(parts);
}
