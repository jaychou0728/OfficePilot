import { createHash } from 'node:crypto';
import path from 'node:path';
import { AppError, type DocumentType } from '@officepilot/shared';

const TYPES: Record<string, DocumentType> = {
  pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', md: 'MD', txt: 'TXT', csv: 'CSV',
};
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const BAD_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

export const MAX_BYTES = 20 * 1024 * 1024;

export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function detectType(filename: string): DocumentType | null {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return Object.hasOwn(TYPES, ext) ? TYPES[ext] : null;
}

export function validateFilename(filename: string): void {
  const name = path.basename(filename);
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name !== filename ||
    path.isAbsolute(filename) ||
    BAD_CHARS.test(name) ||
    RESERVED.test(name)
  ) {
    throw new AppError('INVALID_REQUEST', '非法文件路径');
  }
}

export function safeJoin(root: string, filename: string): string {
  validateFilename(filename);
  const base = path.resolve(root);
  const target = path.resolve(base, filename);
  if (!target.startsWith(base + path.sep)) {
    throw new AppError('INVALID_REQUEST', '非法文件路径');
  }
  return target;
}

export function validateUpload(name: string, size: number): DocumentType {
  const type = detectType(name);
  if (!type) throw new AppError('DOC_UNSUPPORTED');
  if (!Number.isInteger(size) || size <= 0) throw new AppError('INVALID_REQUEST', '文件为空');
  if (size > MAX_BYTES) throw new AppError('DOC_TOO_LARGE');
  return type;
}
