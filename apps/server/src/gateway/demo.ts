import type { ChatMessage, ChatOptions, ChatProvider, EmbeddingProvider } from './types.js';
import { hashEmbedding } from './mock.js';

const MEETING_ROWS = [
  { task: '输出「潮汐」2.0 交互原型', owner: '林澈', dueDate: '2026-11-03', priority: 'P0', risk: '中' },
  { task: '完成埋点方案评审', owner: '周瑜', dueDate: '2026-11-05', priority: 'P1', risk: '低' },
  { task: '补充企业版权限矩阵', owner: '陈默', dueDate: '2026-11-07', priority: 'P1', risk: '中' },
  { task: '确认第三方字体授权', owner: '苏晚', dueDate: '2026-11-06', priority: 'P2', risk: '高' },
  { task: '整理客户反馈清单', owner: '何田', dueDate: '2026-11-04', priority: 'P1', risk: '低' },
];

const SUPPLIER_ROWS = [
  { dimension: '资质合规', weight: '25%', criteria: '营业执照与行业资质证书齐全', source: '供应商准入评分表' },
  { dimension: '交付能力', weight: '30%', criteria: '近三年按期交付率与产能', source: '交付评估报告' },
  { dimension: '报价水平', weight: '25%', criteria: '报价与技术方案综合比价', source: '比价单' },
  { dimension: '服务响应', weight: '10%', criteria: '4 小时响应、24 小时到场', source: '服务承诺函' },
  { dimension: '信息安全', weight: '10%', criteria: 'ISO 27001 或等保三级', source: '安全评估' },
];

const CONTRACT_ROW = {
  parties: ['星海科技', '供应商'],
  amount: '120000 元',
  term: '2026-01-01 至 2026-12-31',
  penalty: '逾期交付按日千分之一支付违约金',
};

const TRAINING_ROWS = [
  { course: '信息安全意识培训', instructor: '苏晚', hours: 2, result: '通过' },
  { course: '数据合规与隐私保护', instructor: '陈默', hours: 3, result: '优秀' },
];

const WEEKLY_REPORT = [
  '本周完成',
  '- 「潮汐」2.0 交互原型完成评审',
  '- 供应商准入评分表完成 6 家初筛',
  '进行中',
  '- 企业版权限矩阵待定稿',
  '风险与阻塞',
  '- 第三方字体授权尚未确认',
  '下周计划',
  '- 完成埋点方案评审',
  '- 输出客户反馈清单',
].join('\n');

function lastUserContent(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return messages[messages.length - 1]?.content ?? '';
}

function respond(messages: ChatMessage[]): string {
  const user = lastUserContent(messages);
  // System prompts carry the operation hints for weekly/summary flows, so match
  // against the whole conversation as a fallback while the user text drives the
  // QA and extraction content.
  const all = messages.map((message) => message.content).join('\n');

  // 1. Structured extraction prompts.
  if (user.includes('字段：')) {
    if (user.includes('任务') && user.includes('责任人')) return JSON.stringify(MEETING_ROWS);
    if (user.includes('维度') && user.includes('权重')) return JSON.stringify(SUPPLIER_ROWS);
    if (user.includes('甲乙方') || user.includes('金额')) return JSON.stringify([CONTRACT_ROW]);
    if (user.includes('课程') && user.includes('讲师')) return JSON.stringify(TRAINING_ROWS);
    return '[]';
  }

  // 2. Weekly report composition and per-document summarisation.
  if (all.includes('按「本周完成') || all.includes('本周完成 / 进行中')) return WEEKLY_REPORT;
  if (all.includes('用 3 条要点总结')) return '- 要点：本周工作按计划推进';

  // 3. Document summary.
  if (all.includes('用 3 条中文要点总结') || all.includes('合并为 3–5 条')) {
    return '- 要点一\n- 要点二\n- 要点三';
  }

  // 4. Knowledge-base QA.
  if (user.includes('问题：')) {
    const question = user.slice(user.lastIndexOf('问题：') + '问题：'.length);
    if (/海外|境外/.test(question)) {
      return '当前知识库未覆盖境外差旅，建议补充《境外差旅补充规定》或转人工确认。';
    }
    if (/住宿|差旅|出差/.test(question)) {
      return '根据《员工差旅费用管理办法 v3.2》，一线城市住宿上限为 650 元/晚，差旅补贴为 120 元/天，出差需提前 3 个工作日在 OA 申请。[1]';
    }
    if (/年假|请假|休假/.test(question)) {
      return '年假按累计工作年限分档为 5 天、10 天、15 天；未休完最多结转 5 天至次年第一季度。[1]';
    }
    if (/密码/.test(question)) return '员工密码长度不得少于 12 位。[1]';
    if (/数据|外发|L3/.test(question)) return 'L3 及以上数据对外发送需数据 Owner 与信息安全负责人双审批。[1]';
    if (/供应商|评分|权重/.test(question)) {
      return '供应商评分包含资质合规 25%、交付能力 30%、报价水平 25%、服务响应 10%、信息安全 10%。[1]';
    }
    if (/会议|行动项/.test(question)) {
      return '会议形成 5 条行动项，责任人包括林澈、周瑜、陈默、苏晚、何田。[1]';
    }
    return '根据已入库文档整理如下，请查看右侧引用片段。[1]';
  }

  return '';
}

export function createDemoProvider(): ChatProvider & EmbeddingProvider {
  return {
    name: 'demo',
    model: 'demo-local',
    async *stream(messages: ChatMessage[], _options?: ChatOptions) {
      const chars = Array.from(respond(messages));
      for (let i = 0; i < chars.length; i += 8) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        yield chars.slice(i, i + 8).join('');
      }
    },
    async complete(messages: ChatMessage[], _options?: ChatOptions) {
      return respond(messages);
    },
    async embed(texts: string[]) {
      return texts.map((text) => hashEmbedding(text, 256));
    },
  };
}
