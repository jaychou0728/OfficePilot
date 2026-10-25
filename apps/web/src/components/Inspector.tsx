import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  ExtractResult,
  QaResult,
  RunResult,
  Source,
  TemplateId,
  WeeklyResult,
} from '@officepilot/shared';
import type { TimelineEntry, ValidationEntry } from '../hooks/useRunStream';

export type InspectorTab = 'evidence' | 'result' | 'trace';

const TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'evidence', label: '证据' },
  { id: 'result', label: '结果' },
  { id: 'trace', label: '执行链路' },
];

const TEMPLATE_NAMES: Record<TemplateId, string> = {
  meeting: '会议行动项',
  supplier: '供应商评分',
  contract: '合同要素',
  training: '培训记录',
};

const FIELD_MAPS: Record<TemplateId, Array<{ key: string; label: string }>> = {
  meeting: [
    { key: 'task', label: '任务' },
    { key: 'owner', label: '责任人' },
    { key: 'dueDate', label: '截止日期' },
    { key: 'priority', label: '优先级' },
    { key: 'risk', label: '风险' },
  ],
  supplier: [
    { key: 'dimension', label: '维度' },
    { key: 'weight', label: '权重' },
    { key: 'criteria', label: '评分要点' },
    { key: 'source', label: '来源' },
  ],
  contract: [
    { key: 'parties', label: '甲乙方' },
    { key: 'amount', label: '金额' },
    { key: 'term', label: '期限' },
    { key: 'penalty', label: '违约条款' },
  ],
  training: [
    { key: 'course', label: '课程' },
    { key: 'instructor', label: '讲师' },
    { key: 'hours', label: '学时' },
    { key: 'result', label: '考核结果' },
  ],
};

const NODE_LABELS: Record<string, string> = {
  router: 'Router · 路由',
  retrieve: 'Retrieve · 检索',
  answer: 'Generate · 生成',
  validate: 'Validate · 校验',
  boundary: 'Boundary · 边界判定',
  parseDoc: 'Parse · 解析文档',
  extract: 'Extract · 字段抽取',
  compose: 'Compose · 组装结果',
  collect: 'Collect · 收集文档',
  summarize: 'Summarize · 分段摘要',
  loadDoc: 'Load · 载入文档',
};

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => formatCell(item)).join('、');
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(value: unknown): string {
  let text = formatCell(value);
  // Avoid Excel formula injection.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: string[][]): string {
  return `﻿${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

function weeklyMarkdown(result: WeeklyResult): string {
  const lines: string[] = [`# ${result.title}`, '', `周期：${result.period}`, ''];
  for (const section of result.sections) {
    lines.push(`## ${section.heading}`);
    for (const item of section.items) lines.push(`- ${item}`);
    lines.push('');
  }
  lines.push(`> 数据缺口：${result.gap}`, '');
  if (result.sources.length) {
    lines.push('## 来源');
    for (const source of result.sources) lines.push(`- [${source.n}] ${source.docName}`);
  }
  return lines.join('\n');
}

function useCopyFeedback() {
  const [copied, setCopied] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function copy(label: string, text: string) {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(label);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(null), 2200);
      })
      .catch(() => undefined);
  }

  return { copied, copy };
}

function EmptyPanel({
  mark,
  title,
  hint,
  children,
}: {
  mark: string;
  title: string;
  hint: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        {mark}
      </span>
      <p>
        {title}
        <span>{hint}</span>
      </p>
      {children}
    </div>
  );
}

function sourceMeta(source: Source): string {
  const bits: string[] = [];
  if (source.page != null) bits.push(`第 ${source.page} 页`);
  if (source.sheet) bits.push(`工作表 ${source.sheet}`);
  bits.push(`片段 ${source.chunkId.slice(0, 8)}`);
  bits.push(`相似度 ${source.score.toFixed(2)}`);
  return bits.join(' · ');
}

function EvidencePanel({
  sources,
  docsCount,
  chunksCount,
  embeddingDim,
  selectedSource,
  onSelectSource,
}: {
  sources: Source[];
  docsCount: number;
  chunksCount: number;
  embeddingDim: number | null;
  selectedSource: number | null;
  onSelectSource: (n: number) => void;
}) {
  if (!sources.length) {
    return (
      <EmptyPanel
        mark="◌"
        title="等待一次检索"
        hint="提问后，这里会显示命中的原文片段、相似度与过滤结果。"
      >
        <div className="corpus-stats">
          <div>
            <b>{docsCount}</b>
            <span>文档</span>
          </div>
          <div>
            <b>{chunksCount}</b>
            <span>知识块</span>
          </div>
          <div>
            <b>{embeddingDim ?? '—'}</b>
            <span>向量维度</span>
          </div>
        </div>
      </EmptyPanel>
    );
  }

  return (
    <>
      <div className="ev-list">
        {sources.map((source) => {
          const weak = source.score < 0.55;
          return (
            <div
              key={source.chunkId}
              className={`ev${weak ? ' weak' : ''}${selectedSource === source.n ? ' selected' : ''}`}
              data-n={source.n}
              data-evidence={source.n}
              onClick={() => onSelectSource(source.n)}
            >
              <div className="ev-head">
                <span className="ev-n">{String(source.n).padStart(2, '0')}</span>
                <div>
                  <div className="ev-doc">{source.docName}</div>
                  <div className="ev-meta">{sourceMeta(source)}</div>
                </div>
                <span className="ev-score-num">{source.score.toFixed(2)}</span>
              </div>
              <div className="ev-bar">
                <i style={{ width: `${Math.min(100, Math.max(2, source.score * 100))}%` }} />
              </div>
              <blockquote>{source.snippet}</blockquote>
            </div>
          );
        })}
      </div>
      {sources.some((source) => source.score < 0.55) ? (
        <div className="ev-empty">部分片段相似度低于 0.55，仅作参考。</div>
      ) : null}
    </>
  );
}

function QaResultPanel({
  result,
  validations,
}: {
  result: QaResult;
  validations: ValidationEntry[];
}) {
  const { copied, copy } = useCopyFeedback();
  const sources = result.sources;
  const topScore = sources.reduce((max, source) => Math.max(max, source.score), 0);
  const docs = new Set(sources.map((source) => source.docId)).size;
  const boundary = result.boundary;
  const failedValidation = validations.some((item) => !item.ok);
  const validationLabel = boundary
    ? failedValidation
      ? '重试后仍失败'
      : '未执行'
    : failedValidation
      ? '重试后通过'
      : '通过';
  const citations = sources
    .map((source) => `[${source.n}] ${source.docName} — ${source.snippet}`)
    .join('\n');

  return (
    <>
      <div className="res-kicker">制度问答 / 回答摘要</div>
      <h3 className="res-title">回答摘要</h3>
      <div className="res-stats">
        <div>
          <span>置信度</span>
          <strong>{Math.round(result.confidence * 100)}%</strong>
        </div>
        <div>
          <span>引用片段</span>
          <strong>{sources.length}</strong>
        </div>
        <div>
          <span>覆盖文档</span>
          <strong>{docs}</strong>
        </div>
      </div>
      <div className="answer-block">
        <div className="answer-label">摘要</div>
        <p className="stream-p">{result.answer}</p>
      </div>
      <div className="res-facts">
        <div>
          <span>最高相似度</span>
          <b>{topScore.toFixed(2)}</b>
        </div>
        <div>
          <span>引用校验</span>
          <b>{validationLabel}</b>
        </div>
        <div>
          <span>知识库边界</span>
          <b>{boundary ? '已触发' : '未触发'}</b>
        </div>
      </div>
      <p className="res-note">引用片段可在「证据」中查看；点击正文中的 [n] 可直接定位。</p>
      {boundary ? (
        <div className="handoff">
          <div className="handoff-title">建议转人工 / 补充资料</div>
          <p className="res-note warn">{boundary.reason}</p>
          {boundary.missing.length ? (
            <ol>
              {boundary.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}
          <p className="res-note">{boundary.handoff}</p>
          <button
            type="button"
            onClick={() => copy('handoff', `${boundary.reason}\n${boundary.handoff}`)}
          >
            {copied === 'handoff' ? '已复制' : '复制转人工说明'}
          </button>
        </div>
      ) : null}
      <div className="res-actions">
        <button type="button" onClick={() => copy('answer', result.answer)}>
          {copied === 'answer' ? '已复制' : '复制回答'}
        </button>
        <button type="button" onClick={() => copy('sources', citations)}>
          {copied === 'sources' ? '已复制' : '复制引用'}
        </button>
      </div>
    </>
  );
}

function ExtractResultPanel({ result }: { result: ExtractResult }) {
  const { copied, copy } = useCopyFeedback();
  const templateId = result.templateId;
  const known = FIELD_MAPS[templateId] ?? [];
  const seen = new Set<string>();
  const columns: Array<{ key: string; label: string }> = [];
  for (const field of known) {
    seen.add(field.key);
    columns.push(field);
  }
  for (const row of result.rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push({ key, label: key });
      }
    }
  }

  const headers = columns.map((column) => column.label);
  const tableRows = result.rows.map((row) => columns.map((column) => formatCell(row[column.key])));
  const templateName = TEMPLATE_NAMES[templateId] ?? templateId;

  function exportCsv() {
    downloadFile(
      `${templateName}.csv`,
      toCsv(headers, tableRows),
      'text/csv;charset=utf-8',
    );
  }

  function copyTable() {
    copy('table', [headers, ...tableRows].map((row) => row.join('\t')).join('\n'));
  }

  return (
    <>
      <div className="res-kicker">文档抽取 / {templateName}</div>
      <h3 className="res-title">{templateName}</h3>
      <div className="badges">
        {result.warnings.length ? (
          <span className="badge warn">{result.warnings.length} 条字段告警</span>
        ) : (
          <span className="badge ok">Schema 校验通过</span>
        )}
        <span className="badge">{result.rows.length} 行</span>
        <span className="badge">{columns.length} 个字段</span>
      </div>
      <div className="res-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.length ? (
              tableRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${columns[cellIndex]?.key ?? cellIndex}`}>
                      {cell || '—'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={Math.max(1, headers.length)}>没有抽取到字段</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {result.warnings.length ? (
        <p className="res-note warn">校验提示：{result.warnings.join('；')}</p>
      ) : (
        <p className="res-note">缺失字段会重试或标注，不会凭空补全。</p>
      )}
      <div className="res-actions">
        <button type="button" onClick={exportCsv}>
          导出 CSV
        </button>
        <button type="button" onClick={copyTable}>
          {copied === 'table' ? '已复制' : '复制表格'}
        </button>
      </div>
    </>
  );
}

function WeeklyResultPanel({ result }: { result: WeeklyResult }) {
  const { copied, copy } = useCopyFeedback();

  function exportMarkdown() {
    downloadFile('本周工作周报.md', weeklyMarkdown(result), 'text/markdown;charset=utf-8');
  }

  return (
    <>
      <div className="res-kicker">周报生成 / 草稿</div>
      <h3 className="res-title">{result.title}</h3>
      <div className="res-meta-line">
        {result.period} · 来源 {result.sources.length} 份文档
      </div>
      <div className="report">
        {result.sections.map((section) => (
          <div key={section.heading}>
            <h4>{section.heading}</h4>
            {section.items.length ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="res-note">本节暂无可用条目。</p>
            )}
          </div>
        ))}
      </div>
      <p className="res-note warn">数据缺口：{result.gap}</p>
      {result.sources.length ? (
        <div className="res-facts">
          {result.sources.map((source) => (
            <div key={source.chunkId}>
              <span>
                [{source.n}] {source.docName}
              </span>
              <b>{source.score.toFixed(2)}</b>
            </div>
          ))}
        </div>
      ) : null}
      <div className="res-actions">
        <button type="button" onClick={exportMarkdown}>
          导出 Markdown
        </button>
        <button type="button" onClick={() => copy('report', weeklyMarkdown(result))}>
          {copied === 'report' ? '已复制' : '复制全文'}
        </button>
      </div>
    </>
  );
}

function ResultPanel({
  result,
  validations,
}: {
  result: RunResult | null;
  validations: ValidationEntry[];
}) {
  if (!result) {
    return (
      <EmptyPanel
        mark="◌"
        title="尚无结果"
        hint="完成一次问答、抽取或周报生成后，结构化结果会出现在这里。"
      />
    );
  }
  if (result.type === 'qa') return <QaResultPanel result={result} validations={validations} />;
  if (result.type === 'extract') return <ExtractResultPanel result={result} />;
  return <WeeklyResultPanel result={result} />;
}

function TracePanel({
  timeline,
  validations,
}: {
  timeline: TimelineEntry[];
  validations: ValidationEntry[];
}) {
  if (!timeline.length && !validations.length) {
    return (
      <EmptyPanel
        mark="◌"
        title="尚无执行记录"
        hint="运行一次任务后，这里会显示 Router → Retrieve → Generate → Validate 的节点耗时与重试。"
      />
    );
  }

  const totalMs = timeline.reduce((sum, entry) => sum + (entry.ms ?? 0), 0);
  const failures = timeline.filter((entry) => entry.status === 'fail').length;

  return (
    <>
      <ol className="trace">
        {timeline.map((entry) => (
          <li key={entry.id} className={`trace-item ${entry.status}`}>
            <span className="trace-dot" aria-hidden="true" />
            <div className="trace-body">
              <div className="trace-head">
                <span className="trace-name">{NODE_LABELS[entry.node] ?? entry.node}</span>
                <span className="trace-ms">{entry.ms != null ? `${entry.ms} ms` : ''}</span>
              </div>
              <div className="trace-sub">{entry.detail ?? ''}</div>
            </div>
          </li>
        ))}
      </ol>
      {validations.length ? (
        <div className="trace-validations">
          <div className="res-kicker">引用校验记录</div>
          {validations.map((validation) => (
            <div key={`${validation.attempt}-${validation.ok}`} className="trace-validation">
              <span className={`badge ${validation.ok ? 'ok' : 'warn'}`}>
                第 {validation.attempt} 次 · {validation.ok ? '通过' : '未通过'}
              </span>
              {validation.errors.length ? (
                <p>
                  {validation.errors
                    .map((error) => `${error.field}：${error.reason}`)
                    .join('；')}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="trace-foot">
        节点 {timeline.length} · 总耗时 {(totalMs / 1000).toFixed(2)} s · 失败 {failures} 次
        <br />
        检索 top-k 5 · 阈值 0.55 · 引用校验开启
      </div>
    </>
  );
}

export type InspectorProps = {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  sources: Source[];
  result: RunResult | null;
  timeline: TimelineEntry[];
  validations: ValidationEntry[];
  docsCount: number;
  chunksCount: number;
  embeddingDim: number | null;
  selectedSource: number | null;
  onSelectSource: (n: number) => void;
};

export function Inspector({
  tab,
  onTabChange,
  sources,
  result,
  timeline,
  validations,
  docsCount,
  chunksCount,
  embeddingDim,
  selectedSource,
  onSelectSource,
}: InspectorProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== 'evidence' || selectedSource == null) return;
    const element = bodyRef.current?.querySelector<HTMLElement>(
      `[data-evidence="${selectedSource}"]`,
    );
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [tab, selectedSource, sources]);

  return (
    <aside className="inspector" aria-label="证据、结果与执行链路">
      <div className="insp-tabs" role="tablist" aria-label="面板切换">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`tab${tab === item.id ? ' active' : ''}`}
            role="tab"
            id={`insp-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls="inspector-panel"
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="insp-body"
        id="inspector-panel"
        role="tabpanel"
        aria-labelledby={`insp-tab-${tab}`}
        ref={bodyRef}
      >
        {tab === 'evidence' ? (
          <EvidencePanel
            sources={sources}
            docsCount={docsCount}
            chunksCount={chunksCount}
            embeddingDim={embeddingDim}
            selectedSource={selectedSource}
            onSelectSource={onSelectSource}
          />
        ) : null}
        {tab === 'result' ? <ResultPanel result={result} validations={validations} /> : null}
        {tab === 'trace' ? <TracePanel timeline={timeline} validations={validations} /> : null}
      </div>
      <div className="insp-foot">top-k 5 · 相似度阈值 0.55 · 温度 0.2 · 引用必须可定位</div>
    </aside>
  );
}
