import { describe, it, expect } from 'vitest';
import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { parseDocument } from '../src/ingest/parsers.js';

describe('parsers', () => {
  it('parses markdown and text', async () => {
    const md = await parseDocument(Buffer.from('# 制度\n\n一线城市住宿 650 元。'), 'MD');
    expect(md.text).toContain('650');
    expect(md.pages).toHaveLength(1);
    expect(md.sheets).toHaveLength(0);
  });

  it('parses docx', async () => {
    const doc = new Document({ sections: [{ children: [new Paragraph('一线城市住宿标准 650 元')] }] });
    const parsed = await parseDocument(await Packer.toBuffer(doc), 'DOCX');
    expect(parsed.text).toContain('650');
  });

  it('parses xlsx into sheets with page list empty', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('评分');
    ws.addRow(['维度', '权重']);
    ws.addRow(['交付能力', '30%']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseDocument(buffer, 'XLSX');
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0].name).toBe('评分');
    expect(parsed.sheets[0].rows.join('\n')).toContain('交付能力');
    expect(parsed.pages).toHaveLength(0);
  });

  it('parses csv into a sheet', async () => {
    const parsed = await parseDocument(Buffer.from('维度,权重\n交付,30%\n'), 'CSV');
    expect(parsed.sheets[0].rows.length).toBeGreaterThan(0);
    expect(parsed.text).toContain('交付');
  });

  it('parses a text pdf', async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText('Travel policy: 650 CNY per night.', { x: 40, y: 700, size: 12, font });
    const parsed = await parseDocument(Buffer.from(await pdf.save()), 'PDF');
    expect(parsed.text).toContain('650');
    expect(parsed.pages).toHaveLength(1);
  });

  it('rejects invalid or empty documents', async () => {
    await expect(parseDocument(Buffer.from('not a pdf'), 'PDF')).rejects.toMatchObject({ code: 'DOC_PARSE_FAILED' });
    await expect(parseDocument(Buffer.from(''), 'TXT')).rejects.toMatchObject({ code: 'DOC_PARSE_FAILED' });
  });
});
