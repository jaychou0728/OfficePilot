import { useCallback, useEffect, useRef, useState } from 'react';
import type { Document, DocumentCategory, RunResult, Skill, TemplateId } from '@officepilot/shared';
import { api, toReadableError, type HealthResponse } from './api/client';
import { useDocuments } from './hooks/useDocuments';
import { useRunStream } from './hooks/useRunStream';
import { DocumentRail } from './components/DocumentRail';
import { Composer, type SendResult } from './components/Composer';
import { ChatPanel, type ChatMessage } from './components/ChatPanel';
import { Inspector, type InspectorTab } from './components/Inspector';

function nowLabel(): string {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function downloadText(filename: string, content: string, mime: string) {
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

function resultToText(result?: RunResult): string {
  if (!result) return '';
  if (result.type === 'qa') return result.answer;
  if (result.type === 'extract') {
    const rows = result.rows
      .map((row) => Object.values(row).map((value) => String(value ?? '')).join(' | '))
      .join('\n');
    return `抽取 ${result.rows.length} 行：\n${rows}`;
  }
  return [
    `${result.title}（${result.period}）`,
    ...result.sections.map(
      (section) => `${section.heading}\n${section.items.map((item) => `- ${item}`).join('\n')}`,
    ),
    `数据缺口：${result.gap}`,
  ].join('\n\n');
}

export default function App() {
  const {
    docs,
    total,
    isLoading,
    error: docsError,
    refresh,
    upload,
    remove,
    reindex,
    uploading,
  } = useDocuments();
  const run = useRunStream();
  const { state: runState } = run;

  const [skill, setSkill] = useState<Skill>('qa');
  const [templateId, setTemplateId] = useState<TemplateId>('meeting');
  const [mentions, setMentions] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<InspectorTab>('evidence');
  const [selectedSource, setSelectedSource] = useState<number | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const consumedRunRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((value) => {
        if (!cancelled) setHealth(value);
      })
      .catch(() => {
        if (!cancelled) setHealth(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1180) setInspectorOpen(false);
      if (window.innerWidth > 900) setLibraryOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Append the final assistant message exactly once per run.
  useEffect(() => {
    const result = runState.result;
    const runId = runState.runId;
    if (!result || !runId || consumedRunRef.current === runId) return;
    consumedRunRef.current = runId;
    const sources = runState.sources.length ? runState.sources : result.sources;
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: 'assistant', result, sources, time: nowLabel() },
    ]);
    setTab(result.type === 'qa' ? 'evidence' : 'result');
  }, [runState.result, runState.runId, runState.sources]);

  const readyDocs = docs.filter((doc) => doc.status === 'ready');
  const chunkCount = readyDocs.reduce((sum, doc) => sum + doc.chunks, 0);
  const busy = runState.status === 'running';
  const sources = runState.sources.length ? runState.sources : runState.result?.sources ?? [];

  const handleSend = useCallback(
    (text: string): SendResult => {
      if (runState.status === 'running') return { ok: false, error: '正在处理，请稍候' };
      const docIds = mentions.map((doc) => doc.id);
      if (docIds.length > 10) return { ok: false, error: '一次最多引用 10 份文档' };
      if (skill === 'extract') {
        if (!docIds.length) return { ok: false, error: '文档抽取需要先用 @ 引用一份文档' };
        if (docIds.length > 1) return { ok: false, error: '文档抽取只能引用一份文档' };
        if (!templateId) return { ok: false, error: '请选择一个抽取字段模板' };
      }

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', text, time: nowLabel() },
      ]);
      setSelectedSource(null);
      void run.start({
        skill,
        input: text,
        docIds,
        templateId: skill === 'extract' ? templateId : null,
      });
      return { ok: true };
    },
    [mentions, run, runState.status, skill, templateId],
  );

  const handleUpload = useCallback(
    async (file: File, category: DocumentCategory) => {
      try {
        const document = await upload(file, category);
        showToast(`已上传《${document.name}》，正在解析…`);
      } catch (error) {
        showToast(toReadableError(error));
        throw error;
      }
    },
    [showToast, upload],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await remove(id);
        setMentions((prev) => prev.filter((doc) => doc.id !== id));
        showToast('已删除文档');
      } catch (error) {
        showToast(toReadableError(error));
      }
    },
    [remove, showToast],
  );

  const handleReindex = useCallback(
    async (id: string) => {
      try {
        const result = await reindex(id);
        showToast(result.skipped ? '索引已是最新，无需重建' : '已加入重建索引队列');
      } catch (error) {
        showToast(toReadableError(error));
      }
    },
    [reindex, showToast],
  );

  const handleReindexAll = useCallback(async () => {
    const candidates = docs.filter((doc) => doc.status === 'ready' || doc.status === 'failed');
    if (!candidates.length) {
      showToast('没有可重建的文档');
      return;
    }
    try {
      await Promise.all(candidates.map((doc) => reindex(doc.id)));
      showToast('已触发索引重建');
    } catch (error) {
      showToast(toReadableError(error));
    }
  }, [docs, reindex, showToast]);

  const handleCite = useCallback((n: number) => {
    setTab('evidence');
    setSelectedSource(n);
    if (window.matchMedia('(max-width: 1180px)').matches) setInspectorOpen(true);
  }, []);

  const handleClearChat = useCallback(() => {
    run.reset();
    setMessages([]);
    setSelectedSource(null);
    setTab('evidence');
    showToast('会话已清空，文档索引保持不变');
  }, [run, showToast]);

  const handleExportChat = useCallback(() => {
    const lines = messages.map((message) =>
      message.role === 'user'
        ? `你：${message.text ?? ''}`
        : `OfficePilot：${resultToText(message.result)}`,
    );
    if (!lines.length) {
      showToast('当前没有可导出的会话');
      return;
    }
    downloadText('OfficePilot-会话记录.txt', lines.join('\n\n'), 'text/plain;charset=utf-8');
  }, [messages, showToast]);

  function closeDrawers() {
    setLibraryOpen(false);
    setInspectorOpen(false);
  }

  const engineLabel = health
    ? health.status === 'ok'
      ? '模型网关 · 在线'
      : '模型网关 · 异常'
    : '模型网关 · 连接中';
  const providerName = health?.providers?.[0]?.name;
  const modeLabel = health
    ? health.demoMode
      ? '演示模式'
      : providerName === 'mock'
        ? '本地模拟'
        : `${providerName ?? '本地'} · 本地`
    : '本地运行';

  return (
    <div
      className={`app${libraryOpen ? ' show-library' : ''}${inspectorOpen ? ' show-inspector' : ''}`}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            OP
          </span>
          <h1 className="visually-hidden">OfficePilot 办公工作台</h1>
          <span className="brand-name">OfficePilot</span>
          <span className="brand-sub">星海科技 · 办公工作台</span>
        </div>
        <div className="top-right">
          <button
            type="button"
            className="icon-btn library-toggle"
            onClick={() => {
              setInspectorOpen(false);
              setLibraryOpen((open) => !open);
            }}
            aria-label="打开文档库"
            aria-expanded={libraryOpen}
          >
            文档库
          </button>
          <button
            type="button"
            className="icon-btn inspector-toggle"
            onClick={() => {
              setLibraryOpen(false);
              setInspectorOpen((open) => !open);
            }}
            aria-label="打开证据与结果面板"
            aria-expanded={inspectorOpen}
          >
            面板
          </button>
          <div className="engine">
            <span
              className={`dot${health && health.status !== 'ok' ? ' off' : ''}`}
              aria-hidden="true"
            />
            <span>{engineLabel}</span>
          </div>
          <span className="mode-chip">{modeLabel}</span>
        </div>
      </header>

      <main className="workspace">
        <DocumentRail
          docs={docs}
          total={total}
          isLoading={isLoading}
          error={docsError}
          uploading={uploading}
          onRefresh={() => void refresh()}
          onUpload={handleUpload}
          onDelete={handleDelete}
          onReindex={handleReindex}
          onReindexAll={handleReindexAll}
        />

        <section className="conversation" aria-label="对话">
          <div className="conv-head">
            <div className="conv-title">
              新对话 <span>关联 {readyDocs.length} 份文档 · {chunkCount} 块</span>
            </div>
            <div className="conv-actions">
              <button type="button" className="ghost-btn" onClick={handleClearChat}>
                清空会话
              </button>
              <button type="button" className="ghost-btn" onClick={handleExportChat}>
                导出记录
              </button>
            </div>
          </div>

          <ChatPanel
            messages={messages}
            live={runState}
            docsCount={readyDocs.length}
            chunksCount={chunkCount}
            onCite={handleCite}
          />

          <Composer
            docs={docs}
            skill={skill}
            templateId={templateId}
            mentions={mentions}
            busy={busy}
            onSkillChange={setSkill}
            onTemplateChange={setTemplateId}
            onMentionsChange={setMentions}
            onSend={handleSend}
          />
        </section>

        <Inspector
          tab={tab}
          onTabChange={setTab}
          sources={sources}
          result={runState.result}
          timeline={runState.timeline}
          validations={runState.validations}
          docsCount={readyDocs.length}
          chunksCount={chunkCount}
          embeddingDim={health?.embeddingDim ?? null}
          selectedSource={selectedSource}
          onSelectSource={setSelectedSource}
        />
      </main>

      <div className="backdrop" onClick={closeDrawers} aria-hidden="true" />
      <div className={`toast${toastMessage ? ' show' : ''}`} role="status" aria-live="polite">
        {toastMessage}
      </div>
    </div>
  );
}
