export function tokenizeForFts(text: string): string {
  const parts = text.replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const part of parts) {
    if (/[一-鿿]/.test(part)) {
      const chars = Array.from(part);
      if (chars.length === 1) out.push(chars[0]);
      else for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
    } else {
      out.push(part.toLowerCase());
    }
  }
  return out.join(' ');
}

export function toFtsQuery(text: string): string {
  const tokens = tokenizeForFts(text).split(' ').filter(Boolean);
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' OR ');
}
