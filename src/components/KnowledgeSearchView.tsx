import { ArrowRight, Database, ExternalLink, Loader2, Search, Sparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { searchKnowledgeBase } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import type { Analysis, KnowledgeSearchHit, KnowledgeSearchResponse } from '@/src/types';

interface KnowledgeSearchViewProps {
  analyses: Analysis[];
  onSelectAnalysis: (id: string) => void;
}

function formatScore(score: number) {
  if (!Number.isFinite(score)) {
    return '0';
  }
  return score >= 10 ? score.toFixed(0) : score.toFixed(2);
}

function formatDate(value?: string) {
  if (!value) {
    return '本地知识库';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '本地知识库';
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SearchResultCard({
  hit,
  canOpenAnalysis,
  onSelectAnalysis,
}: {
  hit: KnowledgeSearchHit;
  canOpenAnalysis: boolean;
  onSelectAnalysis: (id: string) => void;
}) {
  return (
    <article className="group rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-5 shadow-[0_12px_32px_rgba(137,72,84,0.06)] transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(137,72,84,0.1)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
              RAG {formatScore(hit.score)}
            </span>
            <span className="text-xs text-on-surface-variant/70">{formatDate(hit.createdAt)}</span>
          </div>
          <h2 className="line-clamp-2 text-xl font-headline font-extrabold leading-8 text-on-surface transition-colors group-hover:text-primary">
            {hit.title}
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">{hit.source}</p>
        </div>
        <div className="rounded-lg bg-surface-container p-2 text-primary">
          <Database className="h-4 w-4" />
        </div>
      </div>

      <p className="rounded-lg bg-surface-container-low px-4 py-3 text-sm leading-7 text-on-surface-variant">
        {hit.snippet || hit.contentPreview || '这个条目命中了检索，但没有可展示的片段。'}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {hit.tags.slice(0, 8).map((tag) => (
          <span key={tag} className="rounded-md bg-surface-container-high px-2.5 py-1 text-[10px] font-medium text-on-surface-variant">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/12 pt-4">
        {hit.sourceUrl ? (
          <a
            className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant transition-colors hover:text-primary"
            href={hit.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            打开来源
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-xs text-on-surface-variant/55">无来源链接</span>
        )}

        {canOpenAnalysis ? (
          <button
            className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-[0.18em] text-primary transition-all group-hover:gap-2"
            onClick={() => onSelectAnalysis(hit.id)}
            type="button"
          >
            查看详情
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-xs font-bold text-on-surface-variant/55">仅存在于知识库</span>
        )}
      </div>
    </article>
  );
}

export function KnowledgeSearchView({ analyses, onSelectAnalysis }: KnowledgeSearchViewProps) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(8);
  const [result, setResult] = useState<KnowledgeSearchResponse | null>(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const analysisIds = useMemo(() => new Set(analyses.map((analysis) => analysis.id)), [analyses]);
  const suggestedTags = useMemo(() => {
    return Array.from(new Set(analyses.flatMap((analysis) => analysis.tags)))
      .filter(Boolean)
      .slice(0, 10);
  }, [analyses]);

  const handleSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setError('先输入一个问题、标签或概念。');
      return;
    }

    setIsSearching(true);
    setError('');
    try {
      const payload = await searchKnowledgeBase({ query: normalizedQuery, limit });
      setResult(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '知识搜索失败。');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8 md:px-8 md:py-10">
      <section className="mb-8 rounded-xl bg-surface-container-lowest p-6 shadow-[0_12px_32px_rgba(137,72,84,0.06)] md:p-8">
        <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              本地知识搜索
            </div>
            <h1 className="text-4xl font-headline font-extrabold tracking-tight text-on-surface">搜索你的知识库</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
              直接检索已经写入本地知识库的脱水结果。后端会走 SQLite + 向量召回 + reranker，适合查概念、主题、来源和旧笔记里的关键句。
            </p>
          </div>
          <div className="rounded-lg bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            当前前端条目 <span className="font-bold text-primary">{analyses.length}</span> 条
          </div>
        </div>

        <form className="flex flex-col gap-3 md:flex-row" onSubmit={handleSearch}>
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant/50" />
            <input
              className="w-full rounded-lg bg-surface-container-low px-12 py-4 text-base text-on-surface outline-none transition focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-fixed"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="例如：工作记忆、AI 社交、公众号验证、认知负荷"
              type="search"
              value={query}
            />
          </label>
          <select
            className="rounded-lg border border-outline-variant/18 bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface outline-none focus:ring-2 focus:ring-primary-fixed"
            onChange={(event) => setLimit(Number(event.target.value))}
            value={limit}
          >
            <option value={5}>5 条</option>
            <option value={8}>8 条</option>
            <option value={12}>12 条</option>
            <option value={20}>20 条</option>
          </select>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 font-headline text-sm font-bold text-on-primary shadow-[0_12px_28px_rgba(137,72,84,0.16)] transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSearching}
            type="submit"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            搜索
          </button>
        </form>

        {suggestedTags.length ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                className="rounded-full bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-primary/8 hover:text-primary"
                onClick={() => {
                  setQuery(tag);
                  setResult(null);
                  setError('');
                }}
                type="button"
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <section className="mb-6 rounded-lg border border-error/20 bg-error-container px-5 py-4 text-sm font-medium text-on-error-container">
          {error}
        </section>
      ) : null}

      {result ? (
        <section className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-headline font-extrabold tracking-tight text-on-surface">{result.message}</h2>
              <p className="mt-2 text-sm text-on-surface-variant">检索词：{result.query}</p>
            </div>
          </div>

          {result.hits.length ? (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {result.hits.map((hit) => (
                <SearchResultCard
                  key={hit.id}
                  canOpenAnalysis={analysisIds.has(hit.id)}
                  hit={hit}
                  onSelectAnalysis={onSelectAnalysis}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-surface-container px-8 py-16 text-center">
              <h2 className="text-2xl font-headline font-bold text-on-surface">没有命中</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-on-surface-variant">
                你可以换成更宽的主题词，或者在脱水时勾选“写入本地知识库”，让后续搜索有东西可召回。
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className={cn('rounded-xl border border-dashed border-outline-variant/28 bg-surface px-8 py-14 text-center', isSearching && 'opacity-70')}>
          <h2 className="text-2xl font-headline font-bold text-on-surface">问你的本地知识库一个问题</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-on-surface-variant">
            搜索结果会优先返回相关片段，而不是只做标题匹配。它可以成为后续“知识库 MCP”的可视化入口。
          </p>
        </section>
      )}
    </div>
  );
}
