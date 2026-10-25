import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import type { Document, Skill, TemplateId } from '@officepilot/shared';

export type ExtractTemplate = {
  id: TemplateId;
  name: string;
  fields: string[];
};

export const EXTRACT_TEMPLATES: ExtractTemplate[] = [
  { id: 'meeting', name: '会议行动项', fields: ['任务', '责任人', '截止日期', '优先级', '风险'] },
  { id: 'supplier', name: '供应商评分', fields: ['维度', '权重', '评分要点', '来源'] },
  { id: 'contract', name: '合同要素', fields: ['甲乙方', '金额', '期限', '违约条款'] },
  { id: 'training', name: '培训记录', fields: ['课程', '讲师', '学时', '考核结果'] },
];

const SKILLS: Array<{ id: Skill; label: string }> = [
  { id: 'qa', label: '制度问答' },
  { id: 'extract', label: '文档抽取' },
  { id: 'weekly', label: '周报生成' },
];

const PLACEHOLDERS: Record<Skill, string> = {
  qa: '问一个关于公司制度的问题…',
  extract: '先用 @ 引用一份文档，再选择字段模板…',
  weekly: '选择要汇总的文档，或直接说“生成本周周报”…',
};

const EXTRACT_SUGGESTION: Record<TemplateId, string> = {
  meeting: '抽取这份会议纪要的行动项',
  supplier: '抽取供应商评分维度',
  contract: '抽取合同要素',
  training: '抽取培训记录',
};

export type SendResult = { ok: boolean; error?: string };

export type ComposerProps = {
  docs: Document[];
  skill: Skill;
  templateId: TemplateId;
  mentions: Document[];
  busy: boolean;
  onSkillChange: (skill: Skill) => void;
  onTemplateChange: (templateId: TemplateId) => void;
  onMentionsChange: (mentions: Document[]) => void;
  onSend: (text: string) => SendResult;
};

type MentionState = { open: boolean; query: string; start: number; index: number };

const CLOSED_MENTION: MentionState = { open: false, query: '', start: -1, index: 0 };

export function Composer({
  docs,
  skill,
  templateId,
  mentions,
  busy,
  onSkillChange,
  onTemplateChange,
  onMentionsChange,
  onSend,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const [mention, setMention] = useState<MentionState>(CLOSED_MENTION);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeTemplate =
    EXTRACT_TEMPLATES.find((template) => template.id === templateId) ?? EXTRACT_TEMPLATES[0];
  const readyDocs = useMemo(() => docs.filter((doc) => doc.status === 'ready'), [docs]);
  const filtered = useMemo(() => {
    const query = mention.query.trim().toLowerCase();
    if (!query) return readyDocs;
    return readyDocs.filter((doc) => doc.name.toLowerCase().includes(query));
  }, [readyDocs, mention.query]);

  const suggestions = useMemo(() => {
    if (skill === 'qa') return ['一线城市住宿标准是多少？', '年假怎么计算？', '海外出差怎么报销？'];
    if (skill === 'weekly') return ['生成本周周报', '周报会引用哪些文档？'];
    return [EXTRACT_SUGGESTION[templateId], '先 @ 引用一份文档再抽取'];
  }, [skill, templateId]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(120, el.scrollHeight)}px`;
  }, [value]);

  useEffect(() => {
    if (!mention.open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (inputRef.current?.contains(target)) return;
      setMention((prev) => ({ ...prev, open: false }));
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [mention.open]);

  useEffect(() => {
    if (!mention.open) return;
    const active = popoverRef.current?.querySelector('.mention-item.active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [mention.open, mention.index]);

  function detectMention(el: HTMLTextAreaElement) {
    const before = el.value.slice(0, el.selectionStart ?? 0);
    const match = /@([^\s@]*)$/.exec(before);
    if (!match) {
      setMention(CLOSED_MENTION);
      return;
    }
    setMention({
      open: true,
      query: match[1],
      start: before.length - match[1].length - 1,
      index: 0,
    });
  }

  function onChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    setHint(null);
    detectMention(event.target);
  }

  function closeMention() {
    setMention(CLOSED_MENTION);
  }

  function chooseMention(doc: Document) {
    const el = inputRef.current;
    if (!el) return;
    const fallbackPos = mention.start + 1 + mention.query.length;
    const pos = el.selectionStart ?? fallbackPos;
    const start = mention.start >= 0 ? mention.start : pos;
    const before = value.slice(0, start);
    const after = value.slice(pos);
    setValue(`${before}@${doc.name} ${after}`);
    if (!mentions.some((item) => item.id === doc.id)) onMentionsChange([...mentions, doc]);
    closeMention();
    setHint(null);
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + doc.name.length + 2;
      el.setSelectionRange(caret, caret);
    });
  }

  function removeMention(id: string) {
    onMentionsChange(mentions.filter((doc) => doc.id !== id));
  }

  function submit(explicitText?: string) {
    const text = (explicitText ?? value).trim();
    if (!text) {
      setHint('请输入内容后再发送');
      return;
    }
    if (busy) {
      setHint('正在处理，请稍候');
      return;
    }
    const result = onSend(text);
    if (!result.ok) {
      setHint(result.error ?? '暂时无法发送，请稍后重试');
      return;
    }
    setValue('');
    onMentionsChange([]);
    closeMention();
    setHint(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mention.open) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (filtered.length) {
          setMention((prev) => ({ ...prev, index: (prev.index + 1) % filtered.length }));
        }
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (filtered.length) {
          setMention((prev) => ({
            ...prev,
            index: (prev.index - 1 + filtered.length) % filtered.length,
          }));
        }
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (filtered.length) {
          event.preventDefault();
          chooseMention(filtered[mention.index] ?? filtered[0]);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMention();
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function onSuggestion(text: string) {
    if (busy) {
      setHint('正在处理，请稍候');
      return;
    }
    if (skill === 'extract' && mentions.length !== 1) {
      setValue(text);
      setHint('文档抽取需要先用 @ 引用一份文档');
      inputRef.current?.focus();
      return;
    }
    submit(text);
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        {mention.open ? (
          <div
            className="mention-pop"
            ref={popoverRef}
            id="mention-popover"
            role="listbox"
            aria-label="选择要引用的文档"
          >
            {filtered.length ? (
              filtered.map((doc, index) => {
                const name = doc.name;
                const query = mention.query.trim();
                const matchIndex = query
                  ? name.toLowerCase().indexOf(query.toLowerCase())
                  : -1;
                return (
                  <button
                    type="button"
                    key={doc.id}
                    className={`mention-item${index === mention.index ? ' active' : ''}`}
                    onMouseEnter={() => setMention((prev) => ({ ...prev, index }))}
                    onClick={() => chooseMention(doc)}
                    role="option"
                    aria-selected={index === mention.index}
                  >
                    <span className="mention-type" aria-hidden="true">
                      {doc.type}
                    </span>
                    <span className="mention-name">
                      {matchIndex >= 0 ? (
                        <>
                          {name.slice(0, matchIndex)}
                          <mark>{name.slice(matchIndex, matchIndex + query.length)}</mark>
                          {name.slice(matchIndex + query.length)}
                        </>
                      ) : (
                        name
                      )}
                    </span>
                    <span className="mention-meta">
                      {doc.category} · {doc.chunks} 块
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="mention-empty">没有匹配文档。试试文件名的一部分，或先上传文档。</div>
            )}
            <div className="mention-help">↑↓ 选择 · Enter 确认 · Esc 关闭</div>
          </div>
        ) : null}

        <div className="composer-top">
          <div className="skills" role="group" aria-label="选择技能">
            {SKILLS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`skill${skill === item.id ? ' active' : ''}`}
                onClick={() => {
                  onSkillChange(item.id);
                  closeMention();
                  setHint(null);
                }}
                aria-pressed={skill === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span className="ctx">关联 {readyDocs.length} 份文档</span>
        </div>

        {skill === 'extract' ? (
          <div className="fields-panel">
            <div className="fields-head">
              <span className="fields-label">抽取字段</span>
              <span className="fields-hint">
                {activeTemplate.name}：{activeTemplate.fields.join(' / ')}
              </span>
            </div>
            <div className="fields-list">
              {EXTRACT_TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.id}
                  className={`field-chip${template.id === templateId ? ' active' : ''}`}
                  onClick={() => onTemplateChange(template.id)}
                  title={template.fields.join(' / ')}
                  aria-pressed={template.id === templateId}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {mentions.length ? (
          <div className="mention-row">
            <span className="mention-caption">已引用</span>
            {mentions.map((doc) => (
              <span className="mention-chip" key={doc.id}>
                {doc.name}
                <button
                  type="button"
                  onClick={() => removeMention(doc.id)}
                  aria-label={`移除引用 ${doc.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {hint ? (
          <p className="composer-alert" role="alert">
            {hint}
          </p>
        ) : null}

        <div className="composer-input">
          <textarea
            ref={inputRef}
            id="input"
            rows={1}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onClick={(event) => detectMention(event.currentTarget)}
            placeholder={PLACEHOLDERS[skill]}
            spellCheck={false}
            aria-label="输入问题或指令"
            aria-autocomplete="list"
            aria-expanded={mention.open}
            aria-controls={mention.open ? 'mention-popover' : undefined}
          />
          <button
            type="button"
            className="send"
            id="send"
            onClick={() => submit()}
            disabled={busy}
          >
            {busy ? '处理中…' : '发送'} <span className="send-key">↵</span>
          </button>
        </div>

        <div className="suggest">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              className="sug"
              key={suggestion}
              onClick={() => onSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
      <div className="hint">
        <span>Enter 发送 · Shift + Enter 换行 · 输入 @ 引用文档</span>
        <span>仅依据文档库回答 · 低于阈值即拒答</span>
      </div>
    </div>
  );
}
