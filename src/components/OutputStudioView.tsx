import { useMemo, useState, type DragEvent } from 'react';
import { Check, Copy, FileOutput, LoaderCircle, Search, Sparkles } from 'lucide-react';
import type { AiProfile, Analysis, OutputGenerationResponse, OutputStyle, PromptSettings } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface OutputStudioViewProps {
  analyses: Analysis[];
  activeProfile?: AiProfile | null;
  promptSettings: PromptSettings;
  onSelect: (id: string) => void;
  onGenerateOutput: (analyses: Analysis[], style: OutputStyle, topic: string) => Promise<OutputGenerationResponse>;
}

const STYLE_OPTIONS: Array<{ id: OutputStyle; label: string; note: string }> = [
  { id: 'wechat', label: '公众号', note: '长文、观点、HTML 排版' },
  { id: 'xhs', label: '小红书', note: '场景、反差、标签' },
  { id: 'article', label: '深度文章', note: '论证、结构、可归档' },
];

function formatGeneratedAt(value?: string) {
  if (!value) {
    return '刚刚';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function OutputStudioView({ analyses, activeProfile, promptSettings, onGenerateOutput, onSelect }: OutputStudioViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('全部');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [style, setStyle] = useState<OutputStyle>('wechat');
  const [topic, setTopic] = useState('');
  const [draft, setDraft] = useState<OutputGenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState<'markdown' | 'html' | 'image' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const allTags = useMemo(
    () => ['全部', ...Array.from(new Set(analyses.flatMap((analysis) => analysis.tags))).sort((left, right) => left.localeCompare(right, 'zh-CN'))],
    [analyses]
  );

  const filteredAnalyses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return analyses.filter((analysis) => {
      const matchesTag = selectedTag === '全部' || analysis.tags.includes(selectedTag);
      if (!matchesTag) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [analysis.title, analysis.source, analysis.tags.join(' '), analysis.content].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [analyses, query, selectedTag]);

  const selectedAnalyses = useMemo(
    () => selectedIds.map((id) => analyses.find((analysis) => analysis.id === id)).filter(Boolean) as Analysis[],
    [analyses, selectedIds]
  );

  const copyText = async (kind: 'markdown' | 'html' | 'image' | 'video', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const addSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleDropSelection = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);
    const id = event.dataTransfer.getData('text/plain');
    if (id && analyses.some((analysis) => analysis.id === id)) {
      addSelected(id);
    }
  };

  const generateDraft = async () => {
    if (!selectedAnalyses.length) {
      setError('请先选择至少一篇脱水文章。');
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const payload = await onGenerateOutput(selectedAnalyses, style, topic);
      setDraft(payload);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : '产出生成失败。');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!analyses.length) {
    return (
      <div className="mx-auto max-w-screen-xl px-8 py-10">
        <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-8 py-12 text-center">
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight">产出页</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-on-surface-variant">
            先完成几条真实脱水，再把它们聚合成公众号、小红书或深度文章。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-8 py-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">产出页</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            这里不是再展示脱水结果，而是从脱水素材里选几篇，让 AI 聚合成新的文章、平台文案、配图提示词和视频提示词。
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">素材库</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{analyses.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">已选择</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{selectedAnalyses.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">媒体接口</p>
            <p className="mt-3 text-sm font-bold text-on-surface">{promptSettings.imageApiBaseUrl || promptSettings.videoApiBaseUrl ? '已配置' : '提示词模式'}</p>
          </div>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-outline-variant/14 bg-surface-container-lowest p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
              <input
                className="w-full rounded-lg border border-outline-variant/12 bg-surface-container-low px-10 py-3 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="按标题、来源、内容或标签搜索素材"
                type="text"
                value={query}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-bold transition',
                      active
                        ? 'border-primary/20 bg-primary text-on-primary'
                        : 'border-outline-variant/16 bg-surface text-on-surface-variant hover:border-primary/18 hover:text-primary'
                    )}
                    onClick={() => setSelectedTag(tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">产出控制台</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left transition',
                    style === option.id ? 'border-primary/25 bg-primary/8 text-primary' : 'border-outline-variant/14 bg-surface-container-lowest text-on-surface-variant'
                  )}
                  onClick={() => setStyle(option.id)}
                  type="button"
                >
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="mt-1 block text-[10px] leading-4">{option.note}</span>
                </button>
              ))}
            </div>
            <input
              className="mt-4 w-full rounded-lg border border-outline-variant/12 bg-surface-container-lowest px-3 py-3 text-sm outline-none focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setTopic(event.target.value)}
              placeholder="可选：给这次聚合一个选题方向"
              value={topic}
            />
            <button
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-4 py-3 text-sm font-bold text-on-primary"
              disabled={isGenerating}
              onClick={generateDraft}
              type="button"
            >
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {activeProfile?.apiKey ? 'AI 聚合成文' : '生成提示词草稿'}
            </button>
            {error ? <p className="mt-3 text-xs leading-6 text-rose-600">{error}</p> : null}
          </div>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">
        <section className="grid gap-4 sm:grid-cols-2">
          {filteredAnalyses.map((analysis) => {
            const active = selectedIds.includes(analysis.id);

            return (
              <article
                key={analysis.id}
                draggable
                className={cn(
                  'group cursor-grab overflow-hidden rounded-xl border bg-surface-container-lowest shadow-[0_14px_30px_rgba(137,72,84,0.04)] transition active:cursor-grabbing',
                  active ? 'border-primary/30 ring-2 ring-primary/10' : 'border-outline-variant/14'
                )}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', analysis.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={() => onSelect(analysis.id)}
              >
                <div className="relative h-40 bg-surface-container">
                  {analysis.coverImageUrl ? (
                    <img alt={analysis.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={analysis.coverImageUrl} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-surface-container),var(--color-surface-container-high))] text-primary/35">
                      <FileOutput className="h-10 w-10" />
                    </div>
                  )}
                  <button
                    aria-label={active ? '取消选择' : '选择文章'}
                    className={cn(
                      'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur transition',
                      active ? 'border-primary bg-primary text-on-primary' : 'border-white/65 bg-white/82 text-on-surface-variant hover:text-primary'
                    )}
                    onClick={() => toggleSelected(analysis.id)}
                    type="button"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition',
                        active ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant/20 bg-surface text-transparent'
                      )}
                      onClick={() => toggleSelected(analysis.id)}
                      type="button"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 text-base font-bold leading-snug text-on-surface">{analysis.title}</h2>
                      <p className="mt-2 truncate text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/45">{analysis.source}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredAnalyses.length ? (
            <section className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-8 py-14 text-center">
              <h2 className="text-xl font-bold text-on-surface">没有命中素材</h2>
              <p className="mt-3 text-sm text-on-surface-variant">换个标签，或者直接搜标题、来源和正文里的关键词。</p>
            </section>
          ) : null}
        </section>

        <section
          className={cn(
            'sticky top-28 self-start rounded-xl border bg-surface-container-lowest p-6 shadow-[0_18px_36px_rgba(137,72,84,0.05)] transition',
            dragActive ? 'border-primary/45 ring-4 ring-primary/10' : 'border-outline-variant/14'
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragActive(false);
            }
          }}
          onDrop={handleDropSelection}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
                <FileOutput className="h-3.5 w-3.5" />
                生成结果
              </p>
              <h2 className="mt-2 text-2xl font-bold text-on-surface">{draft?.title || '等待聚合'}</h2>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">
                {draft ? `${draft.subtitle} · ${formatGeneratedAt(draft.generatedAt)}` : '选择素材后生成新的平台化内容。'}
              </p>
            </div>
          </div>

          <div className={cn('mb-5 rounded-lg border border-dashed px-4 py-4 transition', dragActive ? 'border-primary/45 bg-primary/8' : 'border-outline-variant/20 bg-surface')}>
            <p className="text-sm font-bold text-on-surface">把文章拖到这里，或点卡片上的勾。</p>
            <p className="mt-1 text-xs leading-5 text-on-surface-variant">已选 {selectedAnalyses.length} 篇，建议 2-6 篇相关素材一起聚合。</p>
            {selectedAnalyses.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedAnalyses.map((analysis) => (
                  <button
                    key={analysis.id}
                    className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary"
                    onClick={() => toggleSelected(analysis.id)}
                    type="button"
                  >
                    {analysis.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {draft ? (
            <div className="space-y-5">
              <section className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">Markdown 成稿</p>
                  <button className="inline-flex items-center gap-2 text-xs font-bold text-primary" onClick={() => copyText('markdown', draft.markdown)} type="button">
                    <Copy className="h-3.5 w-3.5" />
                    {copied === 'markdown' ? '已复制' : '复制'}
                  </button>
                </div>
                <pre className="max-h-[360px] whitespace-pre-wrap rounded-lg bg-surface-container-low p-4 text-sm leading-7 text-on-surface">{draft.markdown}</pre>
              </section>

              {draft.html ? (
                <section className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">公众号 HTML</p>
                    <button className="inline-flex items-center gap-2 text-xs font-bold text-primary" onClick={() => copyText('html', draft.html || '')} type="button">
                      <Copy className="h-3.5 w-3.5" />
                      {copied === 'html' ? '已复制' : '复制'}
                    </button>
                  </div>
                  <pre className="max-h-60 whitespace-pre-wrap rounded-lg bg-surface-container-low p-4 text-xs leading-6 text-on-surface-variant">{draft.html}</pre>
                </section>
              ) : null}

              <section className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">生图提示词</p>
                  <button className="inline-flex items-center gap-2 text-xs font-bold text-primary" onClick={() => copyText('image', draft.imagePrompts.join('\n\n'))} type="button">
                    <Copy className="h-3.5 w-3.5" />
                    {copied === 'image' ? '已复制' : '复制'}
                  </button>
                </div>
                <div className="space-y-3 text-sm leading-7 text-on-surface">
                  {draft.imagePrompts.map((prompt, index) => (
                    <p key={`${prompt}-${index}`} className="rounded-lg bg-surface-container-low px-4 py-3">{prompt}</p>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">视频提示词</p>
                  <button className="inline-flex items-center gap-2 text-xs font-bold text-primary" onClick={() => copyText('video', draft.videoPrompt)} type="button">
                    <Copy className="h-3.5 w-3.5" />
                    {copied === 'video' ? '已复制' : '复制'}
                  </button>
                </div>
                <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm leading-7 text-on-surface">{draft.videoPrompt}</p>
              </section>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-outline-variant/20 bg-surface px-8 py-16 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary/45" />
              <p className="mt-4 text-lg font-bold text-on-surface">还没有生成内容</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-7 text-on-surface-variant">
                把左侧文章拖进来，或点击勾选。AI 会重新组织主线，而不是把摘要复制粘贴在一起。
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
