import { ArrowRight, BookOpen, Globe, PlayCircle, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn, summarizeToSentenceCount } from '@/src/lib/utils';
import { Analysis } from '@/src/types';

interface KnowledgeBaseViewProps {
  analyses: Analysis[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

type LibraryFilter = 'all' | 'web' | 'video' | 'book';

function getTypeIcon(type: Analysis['type']) {
  switch (type) {
    case 'video':
      return PlayCircle;
    case 'book':
      return BookOpen;
    default:
      return Globe;
  }
}

function getTypeLabel(type: Analysis['type']) {
  switch (type) {
    case 'video':
      return '视频脱水';
    case 'book':
      return '文档脱水';
    case 'article':
      return '网页摘录';
    default:
      return '网页来源';
  }
}

function mapTypeToFilter(type: Analysis['type']): Exclude<LibraryFilter, 'all'> {
  switch (type) {
    case 'video':
      return 'video';
    case 'book':
      return 'book';
    default:
      return 'web';
  }
}

function getFilterLabel(filter: LibraryFilter) {
  switch (filter) {
    case 'all':
      return '全部';
    case 'web':
      return '网页';
    case 'video':
      return '视频';
    case 'book':
      return '文档';
  }
}

function getDehydrationTone(level: number) {
  if (level >= 85) {
    return 'bg-tertiary-container text-on-tertiary-container';
  }
  if (level >= 65) {
    return 'bg-secondary-container text-on-secondary-container';
  }
  if (level >= 35) {
    return 'bg-primary-fixed text-primary';
  }
  return 'bg-surface-container-high text-on-surface-variant';
}

function getPreview(analysis: Analysis) {
  return summarizeToSentenceCount(analysis.content, 3);
}

function getFilteredTags(analyses: Analysis[]) {
  return ['全部', ...Array.from(new Set(analyses.flatMap((analysis) => analysis.tags))).sort((left, right) => left.localeCompare(right, 'zh-CN'))];
}

function DeleteButton({ id, onDelete }: { id: string; onDelete: (id: string) => Promise<void> }) {
  return (
    <button
      className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-primary/8 hover:text-primary"
      onClick={async (event) => {
        event.stopPropagation();
        if (!window.confirm('删除后会同步删除知识库中的该条记录，确定继续吗？')) {
          return;
        }
        await onDelete(id);
      }}
      type="button"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function WaterfallNoteCard({
  analysis,
  onSelect,
  onDelete,
}: {
  analysis: Analysis;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const Icon = getTypeIcon(analysis.type);
  const preview = getPreview(analysis);
  const dehydrationLevel = analysis.dehydrationLevel ?? 60;
  const hasCover = Boolean(analysis.coverImageUrl);

  return (
    <article className="group mb-6 break-inside-avoid overflow-hidden rounded-lg border border-outline-variant/14 bg-surface-container-lowest shadow-[0_10px_24px_rgba(137,72,84,0.06)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(137,72,84,0.1)]">
      {hasCover ? (
        <button className="block w-full text-left" onClick={() => onSelect(analysis.id)} type="button">
          <div className="relative overflow-hidden bg-surface-container">
            <img
              src={analysis.coverImageUrl}
              alt={analysis.title}
              className="block h-auto w-full transition-transform duration-500 group-hover:scale-[1.02]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(27,28,27,0.64)] via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">{analysis.source}</p>
                <p className="mt-1 line-clamp-2 text-base font-headline font-extrabold leading-6 text-white">{analysis.title}</p>
              </div>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]', getDehydrationTone(dehydrationLevel))}>
                {getTypeLabel(analysis.type)}
              </span>
            </div>
          </div>
        </button>
      ) : null}

      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-lg bg-surface-container p-2 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              {!hasCover ? <p className="line-clamp-2 text-lg font-headline font-extrabold leading-7 text-on-surface">{analysis.title}</p> : null}
              <p className="text-xs text-on-surface-variant">{analysis.source}</p>
            </div>
          </div>
          <DeleteButton id={analysis.id} onDelete={onDelete} />
        </div>

        <button className="w-full text-left" onClick={() => onSelect(analysis.id)} type="button">
          <p className="text-sm leading-7 text-on-surface-variant">{preview}</p>
        </button>

        <div className="mt-4 flex flex-wrap gap-2">
          {analysis.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="rounded-md bg-surface-container-high px-2.5 py-1 text-[10px] font-medium text-on-surface-variant">
              {tag}
            </span>
          ))}
          <span className="rounded-md bg-primary/8 px-2.5 py-1 text-[10px] font-bold text-primary">
            {dehydrationLevel}/100
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-outline-variant/12 pt-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/55">{analysis.readTime}</span>
          <button className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.18em] text-primary transition-all group-hover:gap-2" onClick={() => onSelect(analysis.id)} type="button">
            查看详情
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export function KnowledgeBaseView({ analyses, onSelect, onDelete }: KnowledgeBaseViewProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string>('全部');

  const baseFiltered = useMemo(() => {
    return analyses.filter((analysis) => activeFilter === 'all' || mapTypeToFilter(analysis.type) === activeFilter);
  }, [activeFilter, analyses]);

  const visibleTags = useMemo(() => getFilteredTags(baseFiltered), [baseFiltered]);

  const filteredAnalyses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return baseFiltered.filter((analysis) => {
      if (selectedTag !== '全部' && !analysis.tags.includes(selectedTag)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [analysis.title, analysis.source, analysis.sourceUrl || '', analysis.content, analysis.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [baseFiltered, query, selectedTag]);

  const sortedAnalyses = useMemo(() => {
    return [...filteredAnalyses].sort((left, right) => right.id.localeCompare(left.id));
  }, [filteredAnalyses]);

  const imageAnalyses = useMemo(() => sortedAnalyses.filter((analysis) => Boolean(analysis.coverImageUrl)), [sortedAnalyses]);

  if (!analyses.length) {
    return (
      <div className="mx-auto max-w-screen-2xl px-6 py-10 md:px-8">
        <section className="rounded-xl bg-surface-container-lowest px-8 py-14 shadow-[0_12px_32px_rgba(137,72,84,0.06)]">
          <h1 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">知识库</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-on-surface-variant">
            这里还没有沉淀好的条目。创建脱水任务时勾选“写入本地知识库”，新内容会自动进入这里，供你筛选、回看和继续加工。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8 md:px-8 md:py-10">
      <section className="mb-10">
        <div className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">知识库</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
              你的脱水资料库。每张卡只保留 3 句话先说明问题，点开之后再看完整结构、摘要与可视化表达。
            </p>
          </div>

          <div className="flex w-fit rounded-full bg-surface-container p-1">
            {(['all', 'web', 'video', 'book'] as LibraryFilter[]).map((filter) => {
              const active = activeFilter === filter;
              return (
                <button
                  key={filter}
                  className={cn(
                    'rounded-full px-5 py-2 text-sm font-bold transition-colors',
                    active ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'
                  )}
                  onClick={() => {
                    setActiveFilter(filter);
                    setSelectedTag('全部');
                  }}
                  type="button"
                >
                  {getFilterLabel(filter)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 rounded-xl bg-surface-container-lowest p-5 shadow-[0_12px_32px_rgba(137,72,84,0.06)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              className="w-full rounded-full bg-surface-container-low px-10 py-3 text-sm text-on-surface outline-none transition focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-fixed"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索知识、标签、来源或正文片段"
              type="text"
              value={query}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => {
              const active = selectedTag === tag;
              return (
                <button
                  key={tag}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                    active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:text-primary'
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
      </section>

      {imageAnalyses.length ? (
        <section className="mb-10 space-y-4">
          <div>
            <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">图像笔记墙</h2>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              优先使用抓到的网页原图做封面，把带图条目先铺成一面真正的瀑布流笔记墙。
            </p>
          </div>

          <div className="rounded-lg border border-outline-variant/14 bg-surface px-4 py-4 md:px-5">
            <div className="columns-1 gap-6 md:columns-2 2xl:columns-3">
              {imageAnalyses.map((analysis) => (
                <WaterfallNoteCard key={`image-wall-${analysis.id}`} analysis={analysis} onDelete={onDelete} onSelect={onSelect} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {sortedAnalyses.length ? (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">全部笔记</h2>
            <p className="mt-2 text-sm leading-7 text-on-surface-variant">
              所有脱水条目统一进入瀑布流笔记墙，保留图像、标签、摘要和删除同步能力。
            </p>
          </div>

          <div className="rounded-lg border border-outline-variant/14 bg-surface px-4 py-4 md:px-5">
            <div className="columns-1 gap-6 md:columns-2 2xl:columns-3">
              {sortedAnalyses.map((analysis) => (
                <WaterfallNoteCard key={analysis.id} analysis={analysis} onDelete={onDelete} onSelect={onSelect} />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl bg-surface-container px-8 py-16 text-center">
          <h2 className="text-2xl font-headline font-bold text-on-surface">没有命中结果</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-on-surface-variant">
            试试换一个类型、切换标签，或者直接搜索标题、来源和正文里的关键句。
          </p>
        </section>
      )}
    </div>
  );
}
