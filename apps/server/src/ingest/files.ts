import { createHash } from 'node:crypto';
import path from 'node:path';
import { AppError, type DocumentType } from '@officepilot/shared';

const TYPES: Record<string, DocumentType> = {
  pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', md: 'MD', txt: 'TXT', csv: 'CSV',
};

export const MAX_BYTES = 20 * 1024 * 1024;

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function detectType(filename: string): DocumentType | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return TYPES[ext] ?? null;
}

export function safeJoin(root: string, filename: string): string {
  const base = path.resolve(root);
  const name = path.basename(filename);
  if (
    name !== filename ||
    filename === '.' ||
    filename === '..' ||
    filename.includes('..') ||
    path.isAbsolute(filename)
  ) {
    throw new AppError('INVALID_REQUEST', '非法文件路径');
  }
  const target = path.resolve(base, name);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new AppError('INVALID_REQUEST', '非法文件路径');
  }
  return target;
}

export function validateUpload(name: string, size: number): DocumentType {
  const type = detectType(name);
  if (!type) throw new AppError('DOC_UNSUPPORTED');
  if (size > MAX_BYTES) throw new AppError('DOC_TOO_LARGE');
  if (size <= 0) throw new AppError('INVALID_REQUEST', '文件为空');
  return type;
}
