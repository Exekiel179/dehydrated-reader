import { useMemo, useState } from 'react';
import { Copy, FileOutput, Search, Tags } from 'lucide-react';
import type { Analysis } from '@/src/types';
import { cn, splitIntoSentences } from '@/src/lib/utils';

interface OutputStudioViewProps {
  analyses: Analysis[];
  onSelect: (id: string) => void;
}

function extractSection(markdown: string, heading: string) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === `# ${heading}`);
  if (start === -1) {
    return '';
  }

  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#\s+/.test(line.trim())) {
      break;
    }
    collected.push(line);
  }

  return collected.join('\n').trim();
}

function toThreeSentenceBrief(markdown: string) {
  const core = extractSection(markdown, '核心摘要');
  return splitIntoSentences(core || markdown).slice(0, 3).join(' ');
}

function toStructureBrief(markdown: string) {
  return extractSection(markdown, '结构拆解')
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function OutputStudioView({ analyses, onSelect }: OutputStudioViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('全部');
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyMarkdown = async (analysis: Analysis) => {
    await navigator.clipboard.writeText(analysis.content);
    setCopiedId(analysis.id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === analysis.id ? null : current));
    }, 1600);
  };

  if (!analyses.length) {
    return (
      <div className="mx-auto max-w-screen-xl px-8 py-10">
        <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-8 py-12 text-center">
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight">产出页</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-on-surface-variant">
            先完成一条真实脱水，这里才会出现可导出、可复用、可二次分发的结果。
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
          <p className="mt-3 text-sm text-on-surface-variant">按标签和关键词快速筛出可复用内容，直接复制到你的后续工作流。</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">可用条目</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{analyses.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">当前命中</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{filteredAnalyses.length}</p>
          </div>
        </div>
      </div>

      <section className="mb-8 rounded-xl border border-outline-variant/14 bg-surface-container-lowest p-5">
        <div className="flex flex-col gap-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            <input
              className="w-full rounded-lg border border-outline-variant/12 bg-surface-container-low px-10 py-3 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按标题、来源、内容或标签搜索"
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
      </section>

      {filteredAnalyses.length ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {filteredAnalyses.map((analysis) => {
            const brief = toThreeSentenceBrief(analysis.content);
            const structure = toStructureBrief(analysis.content);

            return (
              <article key={analysis.id} className="overflow-hidden rounded-xl border border-outline-variant/14 bg-surface-container-lowest shadow-[0_14px_30px_rgba(137,72,84,0.05)]">
                {analysis.coverImageUrl ? (
                  <img
                    alt={analysis.title}
                    className="h-48 w-full object-cover"
                    referrerPolicy="no-referrer"
                    src={analysis.coverImageUrl}
                  />
                ) : null}
                <div className="flex flex-col p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">{analysis.source}</p>
                    <h2 className="mt-2 text-2xl font-bold text-on-surface">{analysis.title}</h2>
                    <p className="mt-2 text-sm text-on-surface-variant">{analysis.timestamp} · 脱水 {analysis.dehydrationLevel ?? 60}</p>
                  </div>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/14 bg-surface px-3 py-2 text-sm font-bold text-primary hover:border-primary/18"
                    onClick={() => copyMarkdown(analysis)}
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                    {copiedId === analysis.id ? '已复制' : '复制 Markdown'}
                  </button>
                </div>

                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                    <FileOutput className="h-3.5 w-3.5" />
                    产出可用
                  </span>
                  {analysis.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                      <Tags className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>

                <section className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">三句简介</p>
                  <p className="mt-3 text-sm leading-7 text-on-surface">{brief || '暂无可提炼简介。'}</p>
                </section>

                <section className="mt-4 rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">结构提炼</p>
                  {structure.length ? (
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-on-surface">
                      {structure.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-on-surface-variant">暂无结构提炼。</p>
                  )}
                </section>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-xs text-on-surface-variant">适合做复盘、归档、二次出稿和知识库追踪。</p>
                  <button className="text-sm font-bold text-primary" onClick={() => onSelect(analysis.id)} type="button">
                    打开详情
                  </button>
                </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-8 py-14 text-center">
          <h2 className="text-xl font-bold text-on-surface">没有命中结果</h2>
          <p className="mt-3 text-sm text-on-surface-variant">换个标签，或者直接搜标题、来源和正文里的关键词。</p>
        </section>
      )}
    </div>
  );
}
