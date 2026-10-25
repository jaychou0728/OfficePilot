import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Boundary, QaResult, RunResult, Source } from '@officepilot/shared';
import type { RunStreamState } from '../hooks/useRunStream';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  result?: RunResult;
  sources?: Source[];
  time: string;
};

export type ChatPanelProps = {
  messages: ChatMessage[];
  live: RunStreamState;
  docsCount: number;
  chunksCount: number;
  onCite: (n: number) => void;
};

const CITE_PATTERN = /\[(\d+)\]/g;

const TEMPLATE_LABELS: Record<string, string> = {
  meeting: '会议行动项',
  supplier: '供应商评分',
  contract: '合同要素',
  training: '培训记录',
};

function CitationText({
  text,
  sources,
  onCite,
}: {
  text: string;
  sources: Source[];
  onCite: (n: number) => void;
}) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(CITE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const n = Number(match[1]);
    const source = sources.find((item) => item.n === n);
    nodes.push(
      <button
        type="button"
        key={`cite-${key++}`}
        className="cite"
        onClick={() => onCite(n)}
        title={source ? `${source.docName} · 相似度 ${source.score.toFixed(2)}` : `查看证据 [${n}]`}
        aria-label={source ? `查看证据 ${n}：${source.docName}` : `查看证据 ${n}`}
      >
        [{n}]
      </button>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}

function BoundaryCard({ boundary }: { boundary: Boundary }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function copy() {
    const text = [
      boundary.reason,
      boundary.missing.length ? `缺失资料：${boundary.missing.join('、')}` : '',
      boundary.handoff,
    ]
      .filter(Boolean)
      .join('\n');
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => undefined);
  }

  return (
    <div className="handoff">
      <div className="handoff-title">建议转人工 / 补充资料</div>
      {boundary.missing.length ? (
        <ol>
          {boundary.missing.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : null}
      <p className="res-note">{boundary.handoff}</p>
      <button type="button" onClick={copy}>
        {copied ? '已复制' : '复制转人工说明'}
      </button>
    </div>
  );
}

function QaMessage({ result, sources, onCite }: { result: QaResult; sources: Source[]; onCite: (n: number) => void }) {
  const boundary = result.boundary;
  return (
    <>
      <div className={`answer-block${boundary ? ' warn' : ''}`}>
        <div className="answer-label">{boundary ? '边界' : '结论'}</div>
        <p>
          <CitationText text={result.answer} sources={sources} onCite={onCite} />
        </p>
      </div>
      {boundary ? (
        <>
          <p className="res-note warn">{boundary.reason}</p>
          <BoundaryCard boundary={boundary} />
        </>
      ) : (
        <p className="muted">
          置信度 {Math.round(result.confidence * 100)}% · 引用 {sources.length} 个原文片段，可在右侧「证据」中核对。
        </p>
      )}
    </>
  );
}

function ResultMessage({
  result,
  sources,
  onCite,
}: {
  result: RunResult;
  sources: Source[];
  onCite: (n: number) => void;
}) {
  if (result.type === 'qa') {
    return <QaMessage result={result} sources={sources} onCite={onCite} />;
  }
  if (result.type === 'extract') {
    return (
      <>
        <div className="route-line">文档抽取 · 模板：{TEMPLATE_LABELS[result.templateId] ?? result.templateId}</div>
        <p>
          已抽取 <strong>{result.rows.length}</strong> 行结构化数据
          {result.warnings.length ? `，${result.warnings.length} 条字段告警` : '，字段校验通过'}。
        </p>
        <p className="muted">完整表格、CSV 导出与引用来源在右侧「结果」面板。</p>
      </>
    );
  }
  return (
    <>
      <div className="route-line">周报生成 · {result.period}</div>
      <p>
        已生成<strong>《{result.title}》</strong>，共 {result.sections.length} 个章节、
        {result.sections.reduce((sum, section) => sum + section.items.length, 0)} 条要点。
      </p>
      <p className="muted">完整草稿与 Markdown 导出在右侧「结果」面板；{result.gap}</p>
    </>
  );
}

export function ChatPanel({ messages, live, docsCount, chunksCount, onCite }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom || messages.length <= 1) el.scrollTop = el.scrollHeight;
  }, [messages, live.tokens, live.timeline.length, live.status]);

  const liveSources = live.result?.sources?.length ? live.result.sources : live.sources;
  const lastFailedValidation = [...live.validations].reverse().find((item) => !item.ok);
  const showLive = live.status === 'running' && !live.result;
  const showError = live.status === 'error';

  return (
    <div className="chat" id="chatScroll" ref={scrollRef}>
      <div className="chat-inner" id="chat">
        {!messages.length && !showLive && !showError ? (
          <article className="msg assistant">
            <div className="msg-head">
              <span className="avatar">OP</span>
              <span className="role">OfficePilot</span>
              <span className="time">在线</span>
            </div>
            <div className="msg-body">
              <p className="lede">把零散的办公文档，变成可以直接使用的结果。</p>
              <p>
                我是星海科技的办公文档助手。当前已加载 <strong>{docsCount} 份文档、{chunksCount} 个知识块</strong>，可以帮你做三件事：
              </p>
              <div className="cap-grid">
                <div className="cap">
                  <span className="cap-k">01</span>
                  <div>
                    <strong>制度问答</strong>
                    <p>依据制度文档回答，附可点击的原文引用；超出知识库范围会明确拒答并建议转人工。</p>
                  </div>
                </div>
                <div className="cap">
                  <span className="cap-k">02</span>
                  <div>
                    <strong>文档抽取</strong>
                    <p>先用 @ 引用一份文档，再按字段模板抽取，输出经过 schema 校验的结构化表格。</p>
                  </div>
                </div>
                <div className="cap">
                  <span className="cap-k">03</span>
                  <div>
                    <strong>周报生成</strong>
                    <p>汇总本周文档与会议纪要，生成可导出的周报草稿；缺失数据会标注，不做编造。</p>
                  </div>
                </div>
              </div>
              <p className="muted">
                所有回答仅依据已入库文档。输入 @ 可以引用某份文档再提问，也可以直接使用下方的快捷指令。
              </p>
            </div>
          </article>
        ) : null}

        {messages.map((message) =>
          message.role === 'user' ? (
            <article className="msg user" key={message.id}>
              <div className="msg-head">
                <span className="avatar user">你</span>
                <span className="role">你</span>
                <span className="time">{message.time}</span>
              </div>
              <div className="msg-body">
                <p>{message.text}</p>
              </div>
            </article>
          ) : (
            <article className="msg assistant" key={message.id}>
              <div className="msg-head">
                <span className="avatar">OP</span>
                <span className="role">OfficePilot</span>
                <span className="time">{message.time}</span>
              </div>
              <div className="msg-body">
                {message.result ? (
                  <ResultMessage
                    result={message.result}
                    sources={message.result.sources ?? message.sources ?? []}
                    onCite={onCite}
                  />
                ) : (
                  <p className="stream-p">
                    <CitationText text={message.text ?? ''} sources={message.sources ?? []} onCite={onCite} />
                  </p>
                )}
              </div>
            </article>
          ),
        )}

        {showLive ? (
          <article className="msg assistant">
            <div className="msg-head">
              <span className="avatar">OP</span>
              <span className="role">OfficePilot</span>
              <span className="time">生成中</span>
            </div>
            <div className="msg-body" aria-live="polite">
              {live.tokens ? (
                <p className="stream-p">
                  <CitationText text={live.tokens} sources={liveSources} onCite={onCite} />
                  <span className="caret" aria-hidden="true" />
                </p>
              ) : (
                <div className="live-wait" role="status">
                  <span className="spinner" aria-hidden="true" />
                  <span>正在检索文档并生成回答…</span>
                </div>
              )}
              {lastFailedValidation ? (
                <p className="notice warn" role="status">
                  第 {lastFailedValidation.attempt} 次引用校验未通过，正在重试…
                  {lastFailedValidation.errors.length
                    ? `（${lastFailedValidation.errors.map((item) => item.field).join('、')}）`
                    : ''}
                </p>
              ) : null}
            </div>
          </article>
        ) : null}

        {showError ? (
          <article className="msg assistant">
            <div className="msg-head">
              <span className="avatar">OP</span>
              <span className="role">OfficePilot</span>
              <span className="time">失败</span>
            </div>
            <div className="msg-body" aria-live="polite">
              {live.tokens ? (
                <p className="stream-p">
                  <CitationText text={live.tokens} sources={liveSources} onCite={onCite} />
                </p>
              ) : null}
              <div className="error-banner" role="alert">
                <b>生成失败{live.error?.code ? ` · ${live.error.code}` : ''}</b>
                <span>{live.error?.message ?? '运行失败，请稍后重试'}</span>
                {live.error?.retryable ? <span className="error-hint">该错误可重试。</span> : null}
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
