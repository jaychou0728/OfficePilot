export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function topK<T extends { vector: ArrayLike<number> }>(
  items: T[],
  query: ArrayLike<number>,
  k: number,
): Array<T & { score: number }> {
  const limit = Math.max(0, Math.trunc(k));
  if (!limit || !items.length) return [];
  return items
    .map((item, index) => ({ item, index, score: cosine(item.vector, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item, score }) => ({ ...item, score }));
}
