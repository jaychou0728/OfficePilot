import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { AppError, type DocumentType } from '@officepilot/shared';

export type ParsedPage = { page: number; text: string };
export type ParsedSheet = { name: string; rows: string[] };
export type ParsedDocument = { text: string; pages: ParsedPage[]; sheets: ParsedSheet[] };

export async function parseDocument(buffer: Buffer, type: DocumentType): Promise<ParsedDocument> {
  switch (type) {
    case 'MD':
    case 'TXT': return parseText(buffer);
    case 'DOCX': return parseDocx(buffer);
    case 'XLSX': return parseXlsx(buffer);
    case 'CSV': return parseCsv(buffer);
    case 'PDF': return parsePdf(buffer);
    default: throw new AppError('DOC_UNSUPPORTED');
  }
}

function parseText(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf8').replace(/\r\n/g, '\n').trim();
  if (!text) throw new AppError('DOC_PARSE_FAILED', '文档为空');
  return { text, pages: [{ page: 1, text }], sheets: [] };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    const text = value.replace(/\r\n/g, '\n').trim();
    if (!text) throw new Error('empty');
    return { text, pages: [{ page: 1, text }], sheets: [] };
  } catch {
    throw new AppError('DOC_PARSE_FAILED');
  }
}

async function parseXlsx(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheets: ParsedSheet[] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow((row) => {
        const values = row.values as unknown[];
        const line = values.slice(1).map((value) => String(value ?? '').trim()).filter(Boolean).join(' | ');
        if (line) rows.push(line);
      });
      sheets.push({ name: sheet.name, rows });
    });
    const text = sheets.map((sheet) => `[${sheet.name}]\n${sheet.rows.join('\n')}`).join('\n\n').trim();
    if (!text) throw new Error('empty');
    return { text, pages: [], sheets };
  } catch {
    throw new AppError('DOC_PARSE_FAILED');
  }
}

function parseCsv(buffer: Buffer): ParsedDocument {
  const rows = buffer.toString('utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) throw new AppError('DOC_PARSE_FAILED', 'CSV 为空');
  const text = rows.join('\n');
  return { text, pages: [], sheets: [{ name: 'CSV', rows }] };
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(pdf, { mergePages: false });
    const texts = Array.isArray(result.text) ? result.text : [result.text];
    const pages = texts.map((text, index) => ({ page: index + 1, text })).filter((page) => page.text.trim());
    if (!pages.length) throw new Error('no text layer');
    return { text: pages.map((page) => page.text).join('\n\n'), pages, sheets: [] };
  } catch {
    throw new AppError('DOC_PARSE_FAILED');
  }
}
