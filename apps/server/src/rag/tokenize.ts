export function tokenizeForFts(text: string): string {
  const parts = text.replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    const segments = part.match(/[一-鿿]+|[^一-鿿]+/g) ?? [];
    for (const segment of segments) {
      if (/[一-鿿]/.test(segment)) {
        const chars = Array.from(segment);
        if (chars.length === 1) out.push(chars[0]);
        else for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
      } else {
        out.push(segment.toLowerCase());
      }
    }
  }
  return out.join(' ');
}

// Returns '' when there are no searchable tokens; callers must not pass '' to FTS5 MATCH.
export function toFtsQuery(text: string): string {
  const tokens = tokenizeForFts(text).split(' ').filter(Boolean);
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
}
