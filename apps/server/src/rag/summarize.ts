export async function mapReduceSummary(
  texts: string[],
  io: {
    summarize: (text: string) => Promise<string>;
    combine: (parts: string[]) => Promise<string>;
  },
  batchSize = 6,
): Promise<string> {
  if (!texts.length) return '';
  const size = Math.max(1, Math.trunc(batchSize));
  const parts: string[] = [];

  for (let i = 0; i < texts.length; i += size) {
    parts.push(await io.summarize(texts.slice(i, i + size).join('\n\n')));
  }

  return parts.length === 1 ? parts[0] : io.combine(parts);
}
