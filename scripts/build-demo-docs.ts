import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const outDir = path.join(repoRoot, 'fixtures', 'demo');
const FONT_PATH = 'C:/Windows/Fonts/simhei.ttf';

async function buildPdf(lines: string[], fileName: string): Promise<void> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fs.readFileSync(FONT_PATH), { subset: true });
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 56;
  const fontSize = 11;
  const lineHeight = 20;
  const maxWidth = page.getWidth() - margin * 2;

  const wrapped: string[] = [];
  for (const line of lines) {
    let current = '';
    for (const char of Array.from(line)) {
      const next = current + char;
      if (current && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
        wrapped.push(current);
        current = char;
      } else {
        current = next;
      }
    }
    wrapped.push(current);
  }

  let y = page.getHeight() - margin;
  for (const line of wrapped) {
    page.drawText(line, { x: margin, y, size: fontSize, font });
    y -= lineHeight;
  }

  fs.writeFileSync(path.join(outDir, fileName), await pdf.save());
  console.log(`wrote ${fileName}`);
}

async function buildDocx(paragraphs: string[], fileName: string): Promise<void> {
  const doc = new Document({
    sections: [{
      children: paragraphs.map((text) => new Paragraph({ children: [new TextRun(text)] })),
    }],
  });
  fs.writeFileSync(path.join(outDir, fileName), await Packer.toBuffer(doc));
  console.log(`wrote ${fileName}`);
}

async function buildXlsx(fileName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('评分');
  sheet.addRow(['维度', '权重', '评分要点', '来源']);
  sheet.addRow(['资质合规', '25%', '营业执照与行业资质证书齐全', '供应商准入清单']);
  sheet.addRow(['交付能力', '30%', '近三年按期交付率与产能', '交付评估报告']);
  sheet.addRow(['报价水平', '25%', '报价与技术方案综合比价', '比价单']);
  sheet.addRow(['服务响应', '10%', '4 小时响应、24 小时到场', '服务承诺函']);
  sheet.addRow(['信息安全', '10%', 'ISO 27001 或等保三级', '安全评估']);
  sheet.columns.forEach((column) => { column.width = 28; });
  await workbook.xlsx.writeFile(path.join(outDir, fileName));
  console.log(`wrote ${fileName}`);
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });

  await buildPdf([
    '星海科技 员工差旅费用管理办法 v3.2',
    '第 1.3 条 本办法仅适用于境内差旅，境外差旅另行规定。',
    '第 3.1 条 员工应在出差前至少 3 个工作日在 OA 提交出差申请。',
    '第 4.2 条 一线城市（北京、上海、广州、深圳）住宿费上限为每人每晚 650 元，凭发票实报实销；二线城市 450 元；其他城市 350 元。',
    '第 4.3 条 差旅补贴：一线城市 120 元/天，二线 100 元/天，其他 80 元/天。',
  ], '员工差旅费用管理办法 v3.2.pdf');

  await buildPdf([
    '数据分为 L1、L2、L3、L4 四级。',
    'L3 及以上数据对外发送需数据 Owner 与信息安全负责人双审批。',
    '员工密码长度不得少于 12 位。',
  ], '信息安全与数据保密规范.pdf');

  await buildDocx([
    '星海科技 请假与考勤制度',
    '年假（年休假）：累计工作满 1 年不满 10 年的 5 天；满 10 年不满 20 年的 10 天；满 20 年及以上的 15 天。',
    '未休完部分最多结转 5 天至次年第一季度。',
  ], '请假与考勤制度.docx');

  fs.writeFileSync(path.join(outDir, 'Q3 产品评审会纪要.md'), [
    '本次会议共形成 5 条行动项。',
    '会议行动项：',
    '- 输出「潮汐」2.0 交互原型，责任人林澈，截止 2026-11-03，优先级 P0，风险中。',
    '- 完成埋点方案评审，责任人周瑜，截止 2026-11-05，优先级 P1，风险低。',
    '- 补充企业版权限矩阵，责任人陈默，截止日期下周五前（推断 2026-11-07），优先级 P1，风险中。',
    '- 确认第三方字体授权，责任人苏晚，截止 2026-11-06，优先级 P2，风险高。',
    '- 整理客户反馈清单，责任人何田，截止 2026-11-04，优先级 P1，风险低。',
    '',
  ].join('\n'));
  console.log('wrote Q3 产品评审会纪要.md');

  await buildXlsx('供应商准入评分表.xlsx');

  await buildDocx([
    'Q3 培训预算执行率 62%，剩余预算按计划结转至 Q4。',
    '课程：信息安全意识培训；讲师：苏晚；学时：2；考核结果：通过。',
    '课程：数据合规与隐私保护；讲师：陈默；学时：3；考核结果：优秀。',
  ], '2026 年度培训与预算计划.docx');

  await buildDocx([
    '采购合同模板',
    '甲方：星海科技',
    '乙方：供应商',
    '合同金额：120,000 元',
    '合同期限：2026-01-01 至 2026-12-31',
    '违约条款：逾期交付按日千分之一支付违约金',
  ], '采购合同模板.docx');

  console.log(`Demo fixtures ready in ${outDir}`);
}

const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
