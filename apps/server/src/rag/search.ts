export type VectorHit = {
  chunkId: string;
  docId: string;
  docName: string;
  ordinal: number;
  text: string;
  page?: number | null;
  sheet?: string | null;
  section?: string | null;
  vector: number;
};

export type FtsHit = { chunkId: string; raw: number };

export type RankedHit = VectorHit & { bm25: number; hybrid: number };

export function hybridRank(input: {
  vectorHits: VectorHit[];
  ftsHits: FtsHit[];
  threshold: number;
  limit: number;
}): RankedHit[] {
  const limit = Math.max(0, Math.trunc(input.limit));
  if (!limit || !input.vectorHits.length) return [];

  const ftsScores = input.ftsHits.map((hit) => -hit.raw);
  const min = Math.min(...ftsScores, 0);
  const max = Math.max(...ftsScores, 0);
  const normalize = (score: number) =>
    max === min ? (score > 0 ? 1 : 0) : (score - min) / (max - min);
  const bm25Map = new Map(input.ftsHits.map((hit) => [hit.chunkId, normalize(-hit.raw)]));

  const merged = input.vectorHits
    .map((hit, index) => ({
      ...hit,
      bm25: bm25Map.get(hit.chunkId) ?? 0,
      hybrid: 0.75 * hit.vector + 0.25 * (bm25Map.get(hit.chunkId) ?? 0),
      __index: index,
    }))
    .filter((hit) => hit.vector >= input.threshold)
    .sort((a, b) => b.hybrid - a.hybrid || a.__index - b.__index);

  const deduped: RankedHit[] = [];
  for (const hit of merged) {
    const adjacent = deduped.find((x) => x.docId === hit.docId && Math.abs(x.ordinal - hit.ordinal) <= 1);
    if (!adjacent) {
      const { __index, ...rest } = hit;
      deduped.push(rest);
    }
    if (deduped.length >= limit) break;
  }
  return deduped;
}
