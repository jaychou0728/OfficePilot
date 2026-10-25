import type { ParsedDocument } from './parsers.js';

export type Chunk = {
  ordinal: number;
  text: string;
  page?: number;
  sheet?: string;
  section?: string;
  startOffset: number;
  endOffset: number;
};

export function chunkText(text: string, size = 800, overlap = 120): Chunk[] {
  size = Math.max(1, Math.trunc(size));
  overlap = Math.max(0, Math.min(Math.trunc(overlap), size - 1));
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks: Chunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(normalized.length, start + size);
    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const cut = Math.max(
        window.lastIndexOf('\n'),
        window.lastIndexOf('。'),
        window.lastIndexOf('；'),
        window.lastIndexOf('. '),
      );
      if (cut > size * 0.6) end = start + cut + 1;
    }
    const raw = normalized.slice(start, end);
    const piece = raw.trim();
    if (piece) {
      const leading = raw.length - raw.trimStart().length;
      const trailing = raw.length - raw.trimEnd().length;
      chunks.push({
        ordinal: chunks.length,
        text: piece,
        startOffset: start + leading,
        endOffset: end - trailing,
      });
    }
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function chunkDocument(doc: ParsedDocument, size = 800, overlap = 120): Chunk[] {
  const out: Chunk[] = [];

  if (doc.sheets.length) {
    for (const sheet of doc.sheets) {
      for (const chunk of chunkText(sheet.rows.join('\n'), size, overlap)) {
        out.push({ ...chunk, ordinal: out.length, sheet: sheet.name });
      }
    }
    return out;
  }

  for (const page of doc.pages) {
    for (const chunk of chunkText(page.text, size, overlap)) {
      out.push({ ...chunk, ordinal: out.length, page: page.page });
    }
  }

  if (!out.length && doc.text.trim()) {
    return chunkText(doc.text, size, overlap);
  }
  return out;
}
