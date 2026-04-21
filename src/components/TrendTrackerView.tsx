import { useEffect, useMemo, useState } from 'react';
import { Copy, EyeOff, Flame, LoaderCircle, Radar, RefreshCw, Search } from 'lucide-react';
import type { TrendOverviewResponse, TrendTopic } from '@/src/types';
import { fetchTrendOverview, refreshTrendOverview } from '@/src/lib/api';

interface TrendTrackerViewProps {
  onDehydrateUrl: (url: string) => Promise<void>;
  ignoredTopicIds: string[];
  onIgnoreTopic: (id: string) => void;
}

function matchesTopic(topic: TrendTopic, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalized = keyword.trim().toLowerCase();
  return topic.title.toLowerCase().includes(normalized) || topic.platformName.toLowerCase().includes(normalized);
}

export function TrendTrackerView({ onDehydrateUrl, ignoredTopicIds, onIgnoreTopic }: TrendTrackerViewProps) {
  const [overview, setOverview] = useState<TrendOverviewResponse | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | string>('all');
  const [onlyWithLinks, setOnlyWithLinks] = useState(false);
  const [dehydratingUrls, setDehydratingUrls] = useState<string[]>([]);
  const [copiedTopicId, setCopiedTopicId] = useState<string | null>(null);
  const [refreshingSnapshot, setRefreshingSnapshot] = useState(false);
  const [refreshHint, setRefreshHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError(null);
      try {
        const nextOverview = await fetchTrendOverview();
        if (!cancelled) {
          setOverview(nextOverview);
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewError(error instanceof Error ? error.message : '热点追踪读取失败。');
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, []);

  const platformSummaries = useMemo(() => overview?.platformSummaries || [], [overview]);
  const filteredLatestItems = useMemo(() => {
    const base = overview?.latestItems.filter((topic) => !ignoredTopicIds.includes(topic.id)) || [];
    return base.filter((topic) => {
      if (platformFilter !== 'all' && topic.platformId !== platformFilter) {
        return false;
      }
      if (onlyWithLinks && !topic.snapshotUrl) {
        return false;
      }
      return matchesTopic(topic, searchTerm);
    });
  }, [ignoredTopicIds, onlyWithLinks, overview, platformFilter, searchTerm]);
  const filteredTrackedTopics = useMemo(() => {
    const base = overview?.trackedTopics.filter((topic) => !ignoredTopicIds.includes(topic.id)) || [];
    return base.filter((topic) => {
      if (platformFilter !== 'all' && topic.platformId !== platformFilter) {
        return false;
      }
      if (onlyWithLinks && !topic.snapshotUrl) {
        return false;
      }
      return matchesTopic(topic, searchTerm);
    });
  }, [ignoredTopicIds, onlyWithLinks, overview, platformFilter, searchTerm]);
  const linkedCount = useMemo(() => filteredLatestItems.filter((topic) => Boolean(topic.snapshotUrl)).length, [filteredLatestItems]);

  return (
    <div className="mx-auto max-w-screen-2xl px-8 py-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">热点追踪</h1>
          <p className="mt-3 max-w-3xl text-sm text-on-surface-variant">
            这里专门看 TrendRadar 的热点快照、持续上榜主题和本轮热榜。直接按平台卡片筛选，再从当前列表里检索。
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/14 bg-surface-container-lowest px-4 py-3 text-sm font-bold text-primary"
          onClick={async () => {
            setRefreshingSnapshot(true);
            setOverviewLoading(true);
            setOverviewError(null);
            setRefreshHint(null);
            try {
              const result = await refreshTrendOverview();
              setOverview(result.overview);
              setRefreshHint(result.message);
            } catch (error) {
              setOverviewError(error instanceof Error ? error.message : '热点采集刷新失败。');
            } finally {
              setRefreshingSnapshot(false);
              setOverviewLoading(false);
            }
          }}
          disabled={refreshingSnapshot}
          type="button"
        >
          {refreshingSnapshot ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {refreshingSnapshot ? '正在采集...' : '采集并刷新'}
        </button>
      </div>
      {refreshHint ? <p className="-mt-4 mb-6 text-sm text-on-surface-variant">{refreshHint}</p> : null}

      <div className="grid gap-6">
        <section className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">TrendRadar</p>
              <h2 className="mt-2 text-2xl font-bold text-on-surface">热点快照</h2>
            </div>
            {overview?.snapshotLabel ? <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">{overview.snapshotLabel}</span> : null}
          </div>

          {overviewLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-on-surface-variant">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              正在读取热点快照...
            </div>
          ) : overviewError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{overviewError}</div>
          ) : overview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">最新热点</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-primary">{filteredLatestItems.length}</p>
                </div>
                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">持续热点</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-primary">{filteredTrackedTopics.length}</p>
                </div>
                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">覆盖平台</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-primary">{overview.platformSummaries.length}</p>
                </div>
                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">可用快照链接</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-primary">{linkedCount}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">平台分布</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="relative block min-w-[220px]">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
                          <input
                            className="w-full rounded-lg border border-outline-variant/12 bg-surface-container-low px-10 py-2.5 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="检索话题或平台"
                            type="text"
                            value={searchTerm}
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/12 bg-surface-container-low px-3 py-2.5 text-sm text-on-surface">
                          <input
                            checked={onlyWithLinks}
                            className="h-4 w-4 accent-[color:var(--color-primary)]"
                            onChange={(event) => setOnlyWithLinks(event.target.checked)}
                            type="checkbox"
                          />
                          只看带链接
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                          platformFilter === 'all'
                            ? 'border-primary bg-primary/8 text-primary'
                            : 'border-outline-variant/12 bg-surface-container-low text-on-surface-variant hover:border-primary/20 hover:text-primary'
                        }`}
                        onClick={() => setPlatformFilter('all')}
                        type="button"
                      >
                        全部平台
                      </button>
                      {platformSummaries.map((platform) => (
                        <button
                          key={platform.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                            platformFilter === platform.id
                              ? 'border-primary bg-primary/8 text-primary'
                              : 'border-outline-variant/12 bg-surface-container-low text-on-surface-variant hover:border-primary/20 hover:text-primary'
                          }`}
                          onClick={() => setPlatformFilter((current) => (current === platform.id ? 'all' : platform.id))}
                          type="button"
                        >
                          <span className="font-medium">{platform.name}</span>
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">{platform.itemCount}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">持续上榜</p>
                  <div className="mt-4 space-y-3">
                    {filteredTrackedTopics.slice(0, 5).map((topic) => (
                      <div key={topic.id} className="rounded-lg border border-outline-variant/12 bg-surface-container-low px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-6 text-on-surface">{topic.title}</p>
                            <p className="mt-2 text-xs text-on-surface-variant">{topic.platformName} · 最新排名 #{topic.latestRank}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-primary/8 px-2 py-1 text-[10px] font-bold text-primary">x{topic.occurrences}</span>
                            <button className="text-on-surface-variant hover:text-primary" onClick={() => onIgnoreTopic(topic.id)} type="button">
                              <EyeOff className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">本轮热榜</p>
                <div className="mt-4 grid gap-4">
                  {filteredLatestItems.slice(0, 10).map((topic) => (
                    <article key={topic.id} className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-primary">
                            <Flame className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-[0.22em]">{topic.platformName}</span>
                          </div>
                          <p className="mt-2 text-base font-semibold leading-7 text-on-surface">{topic.title}</p>
                          <p className="mt-1 text-xs text-on-surface-variant">当前排名 #{topic.latestRank} · 最近快照 {topic.latestSnapshot}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            className="rounded-lg border border-outline-variant/14 bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface-variant hover:text-primary"
                            onClick={() => onIgnoreTopic(topic.id)}
                            type="button"
                          >
                            <span className="inline-flex items-center gap-2">
                              <EyeOff className="h-4 w-4" />
                              忽略
                            </span>
                          </button>
                          <button
                            className="rounded-lg border border-outline-variant/14 bg-surface-container-low px-3 py-2 text-sm font-bold text-on-surface-variant hover:text-primary"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(topic.title);
                                setCopiedTopicId(topic.id);
                                window.setTimeout(() => setCopiedTopicId((current) => (current === topic.id ? null : current)), 1200);
                              } catch {
                                setCopiedTopicId(null);
                              }
                            }}
                            type="button"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Copy className="h-4 w-4" />
                              {copiedTopicId === topic.id ? '已复制' : '复制主题'}
                            </span>
                          </button>
                          {topic.snapshotUrl ? (
                            <button
                              className="rounded-lg border border-outline-variant/14 bg-surface-container-low px-3 py-2 text-sm font-bold text-primary"
                              disabled={dehydratingUrls.includes(topic.snapshotUrl)}
                              onClick={async () => {
                                try {
                                  setDehydratingUrls((current) => (current.includes(topic.snapshotUrl!) ? current : [...current, topic.snapshotUrl!]));
                                  await onDehydrateUrl(topic.snapshotUrl);
                                } finally {
                                  setDehydratingUrls((current) => current.filter((item) => item !== topic.snapshotUrl));
                                }
                              }}
                              type="button"
                            >
                              {dehydratingUrls.includes(topic.snapshotUrl) ? '排队中...' : '脱水链接'}
                            </button>
                          ) : null}
                          {topic.snapshotUrl ? (
                            <a className="text-sm font-bold text-on-surface-variant hover:text-primary" href={topic.snapshotUrl} rel="noreferrer" target="_blank">
                              打开链接
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}

                  {!filteredLatestItems.length ? (
                    <div className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-12 text-center text-sm text-on-surface-variant">
                      当前筛选条件下没有可展示的话题。
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
