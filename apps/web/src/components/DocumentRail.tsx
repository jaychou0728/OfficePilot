import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import type { Document, DocumentCategory, DocumentStatus } from '@officepilot/shared';

const CATEGORIES: DocumentCategory[] = ['制度', '会议', '表格', '合同'];
const PROCESSING = new Set<DocumentStatus>(['queued', 'parsing', 'chunking', 'embedding']);

const STATUS_LABELS: Record<DocumentStatus, string> = {
  queued: '排队中',
  parsing: '解析中',
  chunking: '切块中',
  embedding: '向量化',
  ready: '已入库',
  failed: '失败',
};

function formatSize(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export type DocumentRailProps = {
  docs: Document[];
  total: number;
  isLoading: boolean;
  error: string | null;
  uploading: boolean;
  onRefresh: () => void;
  onUpload: (file: File, category: DocumentCategory) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReindex: (id: string) => Promise<void>;
  onReindexAll: () => Promise<void>;
};

export function DocumentRail({
  docs,
  total,
  isLoading,
  error,
  uploading,
  onRefresh,
  onUpload,
  onDelete,
  onReindex,
  onReindexAll,
}: DocumentRailProps) {
  const [category, setCategory] = useState<DocumentCategory>('制度');
  const [filter, setFilter] = useState<'all' | DocumentCategory>('all');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: docs.length };
    for (const item of CATEGORIES) result[item] = 0;
    for (const doc of docs) {
      if (result[doc.category] != null) result[doc.category] += 1;
    }
    return result;
  }, [docs]);

  const visibleDocs = useMemo(
    () => (filter === 'all' ? docs : docs.filter((doc) => doc.category === filter)),
    [docs, filter],
  );

  const readyDocs = docs.filter((doc) => doc.status === 'ready');
  const chunkCount = readyDocs.reduce((sum, doc) => sum + doc.chunks, 0);
  const processingCount = docs.filter((doc) => PROCESSING.has(doc.status)).length;

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    for (const file of list) {
      try {
        await onUpload(file, category);
      } catch {
        // App surfaces the readable error as a toast.
      }
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) void handleFiles(event.target.files);
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void handleFiles(event.dataTransfer.files);
  }

  function docMeta(doc: Document): string {
    if (doc.status === 'ready') {
      return `${doc.category} · ${doc.chunks} 块 · ${formatSize(doc.size)} · 已入库`;
    }
    if (doc.status === 'failed') {
      return `${doc.category} · 入库失败`;
    }
    const stage = doc.stage || STATUS_LABELS[doc.status];
    return `${doc.category} · ${stage} · ${doc.progress}%`;
  }

  return (
    <aside className="library" aria-label="文档库">
      <div className="lib-scroll">
        <div className="lib-head">
          <span className="kicker">01 / 文档库</span>
          <button type="button" className="text-btn" onClick={onRefresh}>
            刷新
          </button>
        </div>

        <div className="upload-config">
          <label className="kicker" htmlFor="upload-category">
            分类
          </label>
          <select
            id="upload-category"
            className="category-select"
            value={category}
            onChange={(event) => setCategory(event.target.value as DocumentCategory)}
            aria-label="上传文档分类"
          >
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className={`dropzone${dragging ? ' drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={onDrop}
          aria-label={`上传文档到「${category}」分类`}
        >
          <span className="dz-plus" aria-hidden="true">
            ＋
          </span>
          <span className="dz-title">{uploading ? '正在上传…' : '上传文档'}</span>
          <span className="dz-sub">拖入或点击 · PDF / DOCX / XLSX / MD</span>
          <span className="dz-sub">当前分类：{category}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.md,.txt,.csv"
          multiple
          hidden
          onChange={onFileChange}
          aria-label="选择要上传的文档"
        />

        <div className="filters" role="group" aria-label="按分类筛选文档">
          {(['all', ...CATEGORIES] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`chip${filter === item ? ' active' : ''}`}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              {item === 'all' ? '全部' : item}
              <span>{counts[item] ?? 0}</span>
            </button>
          ))}
        </div>

        {error ? (
          <div className="lib-error" role="alert">
            <p>{error}</p>
            <button type="button" className="text-btn" onClick={onRefresh}>
              重试
            </button>
          </div>
        ) : null}

        {isLoading && !docs.length ? (
          <div className="doc-skeleton-list" aria-label="正在加载文档" role="status">
            {[0, 1, 2].map((item) => (
              <div className="doc-skeleton" key={item}>
                <span className="doc-skeleton-type" />
                <span className="doc-skeleton-lines">
                  <i />
                  <i />
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !visibleDocs.length ? (
          <div className="lib-empty">
            {docs.length ? (
              <p>
                该分类暂无文档
                <span>切换到「全部」或上传一份新文档。</span>
              </p>
            ) : (
              <p>
                还没有文档
                <span>上传 PDF、DOCX、XLSX 或 Markdown 开始建立知识库。</span>
              </p>
            )}
          </div>
        ) : null}

        <div id="docList">
          {visibleDocs.map((doc) => {
            const processing = PROCESSING.has(doc.status);
            return (
              <div className="doc" key={doc.id}>
                <span className="doc-type" aria-hidden="true">
                  {doc.type}
                </span>
                <div className="doc-main">
                  <div className="doc-name" title={doc.name}>
                    {doc.name}
                  </div>
                  <div className="doc-meta">{docMeta(doc)}</div>
                  {processing ? (
                    <div
                      className="doc-progress"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={doc.progress}
                      aria-label={`${doc.name} 入库进度`}
                    >
                      <i style={{ width: `${Math.max(2, doc.progress)}%` }} />
                    </div>
                  ) : null}
                  {doc.status === 'failed' && doc.error ? (
                    <div className="doc-error">{doc.error}</div>
                  ) : null}
                  <div className="doc-actions">
                    {doc.status === 'ready' || doc.status === 'failed' ? (
                      <button
                        type="button"
                        onClick={() => void onReindex(doc.id)}
                        aria-label={`重建 ${doc.name} 的索引`}
                      >
                        {doc.status === 'failed' ? '重试' : '重建'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (window.confirm(`确定删除《${doc.name}》？索引与原文都会移除。`)) {
                          void onDelete(doc.id);
                        }
                      }}
                      aria-label={`删除 ${doc.name}`}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <span
                  className={`doc-dot ${doc.status}`}
                  title={STATUS_LABELS[doc.status]}
                  aria-label={STATUS_LABELS[doc.status]}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="lib-foot">
        <span>
          {readyDocs.length}/{total} 份就绪 · 索引 {chunkCount} 块
          {processingCount ? ` · ${processingCount} 份处理中` : ''}
        </span>
        <button
          type="button"
          className="text-btn"
          onClick={() => void onReindexAll()}
          disabled={!readyDocs.length}
        >
          重建索引
        </button>
      </div>
    </aside>
  );
}
