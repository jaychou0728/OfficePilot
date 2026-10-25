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
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.isMerged && cell.master !== cell) return;
          const text = excelCellText(cell);
          if (text) cells.push(text);
        });
        if (cells.length) rows.push(cells.join(' | '));
      });
      if (rows.length) sheets.push({ name: sheet.name, rows });
    });
    if (!sheets.length) throw new Error('empty');
    const text = sheets.map((sheet) => `[${sheet.name}]\n${sheet.rows.join('\n')}`).join('\n\n');
    return { text, pages: [], sheets };
  } catch {
    throw new AppError('DOC_PARSE_FAILED');
  }
}

function excelCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value) {
      const result = (value as { result?: unknown }).result;
      return result == null ? '' : String(result);
    }
    if ('hyperlink' in value) {
      return String((value as { text?: string }).text ?? cell.text ?? '');
    }
    if ('richText' in value) {
      return (value as { richText: Array<{ text: string }> }).richText.map((part) => part.text).join('');
    }
  }
  return cell.text ?? String(value ?? '');
}

function parseCsv(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf8').replace(/^﻿/, '');
  const rows = parseCsvRows(text);
  if (!rows.length) throw new AppError('DOC_PARSE_FAILED', 'CSV 为空');
  const lines = rows.map((row) => row.map((cell) => cell.trim()).join(' | '));
  return { text: lines.join('\n'), pages: [], sheets: [{ name: 'CSV', rows: lines }] };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
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
