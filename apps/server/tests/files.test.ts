import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { sha256, detectType, safeJoin, validateUpload, MAX_BYTES } from '../src/ingest/files.js';

describe('files', () => {
  it('hashes and detects type', () => {
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(detectType('a.PDF')).toBe('PDF');
    expect(detectType('a.docx')).toBe('DOCX');
    expect(detectType('a.exe')).toBeNull();
  });

  it('blocks traversal and absolute paths', () => {
    const root = 'C:/data/uploads';
    expect(() => safeJoin(root, '../../etc/passwd')).toThrow();
    expect(() => safeJoin(root, path.resolve('etc', 'passwd'))).toThrow();
    expect(() => safeJoin(root, '..\\evil.pdf')).toThrow();
    expect(safeJoin(root, 'a.pdf')).toBe(path.resolve(root, 'a.pdf'));
  });

  it('validates uploads', () => {
    expect(validateUpload('a.pdf', 10)).toBe('PDF');
    expect(() => validateUpload('a.exe', 10)).toThrow();
    expect(() => validateUpload('a.pdf', MAX_BYTES + 1)).toThrow();
  });
});
