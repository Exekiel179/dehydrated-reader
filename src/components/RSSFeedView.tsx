import { useEffect, useMemo, useState } from 'react';
import { Bolt, ExternalLink, EyeOff, LoaderCircle, Plus, RefreshCw, Rss, Search, Trash2 } from 'lucide-react';
import type { AiProfile, RSSFeedItem, RSSSubscription } from '@/src/types';
import { discoverRssSubscriptions, fetchRssFeeds, importRssSubscription } from '@/src/lib/api';
import { DEFAULT_RSS_SUBSCRIPTIONS } from '@/src/rssPresets';

interface RSSFeedViewProps {
  subscriptions: RSSSubscription[];
  onSaveSubscriptions: (subscriptions: RSSSubscription[]) => void;
  ignoredItemIds: string[];
  onIgnoreItem: (id: string) => void;
  onDehydrateUrl: (url: string) => Promise<void>;
  activeProfile?: AiProfile | null;
}

type RSSCategoryFilter = string | 'all';

const RSS_CATEGORY_LABELS_STORAGE_KEY = 'dehydrated-reader-rss-category-labels';

const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  all: '全部',
  psychology: '心理学',
  'psychology-journal': '心理学顶刊',
  ai: '人工智能',
  'ai-product': 'AI 产品',
  github: 'GitHub 趋势',
  custom: '自定义',
};

const DEFAULT_CATEGORY_ORDER = ['all', 'psychology', 'psychology-journal', 'ai', 'ai-product', 'github', 'custom'];

function normalizeCategoryId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createCategoryId(label: string) {
  const ascii = normalizeCategoryId(label);
  if (ascii) {
    return ascii.startsWith('custom-') ? ascii : `custom-${ascii}`;
  }
  return `custom-${Date.now().toString(36)}`;
}

function normalizeCategoryLabels(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') {
    return DEFAULT_CATEGORY_LABELS;
  }
  const next = { ...DEFAULT_CATEGORY_LABELS };
  for (const [category, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      const normalizedCategory = normalizeCategoryId(category);
      if (normalizedCategory) {
        next[normalizedCategory] = value.trim().slice(0, 16);
      }
    }
  }
  return next;
}

function isLikelyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  return /^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed);
}

function toImportableUrl(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function faviconUrl(siteUrl?: string) {
  if (!siteUrl) {
    return '';
  }
  return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(siteUrl)}`;
}

function formatPublishedAt(value?: string) {
  if (!value) {
    return '刚刚更新';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function itemMatches(item: RSSFeedItem, keyword: string) {
  if (!keyword.trim()) {
    return true;
  }
  const normalized = keyword.trim().toLowerCase();
  return (
    item.title.toLowerCase().includes(normalized) ||
    item.excerpt.toLowerCase().includes(normalized) ||
    item.subscriptionTitle.toLowerCase().includes(normalized)
  );
}

export function RSSFeedView({
  subscriptions,
  onSaveSubscriptions,
  ignoredItemIds,
  onIgnoreItem,
  onDehydrateUrl,
  activeProfile,
}: RSSFeedViewProps) {
  const [items, setItems] = useState<RSSFeedItem[]>([]);
  const [resolvedSubscriptions, setResolvedSubscriptions] = useState<RSSSubscription[]>(subscriptions);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedHint, setFeedHint] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<RSSCategoryFilter>('all');
  const [importUrl, setImportUrl] = useState('');
  const [importCategory, setImportCategory] = useState<RSSSubscription['category']>('custom');
  const [importing, setImporting] = useState(false);
  const [aiResults, setAiResults] = useState<RSSSubscription[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_CATEGORY_LABELS;
    }
    try {
      return normalizeCategoryLabels(JSON.parse(window.localStorage.getItem(RSS_CATEGORY_LABELS_STORAGE_KEY) || 'null'));
    } catch {
      return DEFAULT_CATEGORY_LABELS;
    }
  });
  const [editingCategories, setEditingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [dehydratingUrls, setDehydratingUrls] = useState<string[]>([]);
  const subscriptionBase = resolvedSubscriptions.length ? resolvedSubscriptions : subscriptions;
  const currentInputIsUrl = isLikelyUrl(importUrl);
  const categoryOrder = useMemo(() => {
    const fromSubscriptions = subscriptionBase.map((subscription) => subscription.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORY_ORDER, ...Object.keys(categoryLabels), ...fromSubscriptions]));
  }, [categoryLabels, subscriptionBase]);
  const importCategoryOptions = useMemo(() => categoryOrder.filter((category) => category !== 'all'), [categoryOrder]);

  useEffect(() => {
    setResolvedSubscriptions(subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    window.localStorage.setItem(RSS_CATEGORY_LABELS_STORAGE_KEY, JSON.stringify(categoryLabels));
  }, [categoryLabels]);

  useEffect(() => {
    let cancelled = false;

    async function loadFeeds() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchRssFeeds(subscriptions, 4);
        if (!cancelled) {
          setItems(response.items);
          setResolvedSubscriptions(response.subscriptions);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'RSS 抓取失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeeds();
    return () => {
      cancelled = true;
    };
  }, [subscriptions]);

  const visibleSubscriptions = useMemo(
    () => resolvedSubscriptions.filter((subscription) => activeCategory === 'all' || subscription.category === activeCategory),
    [activeCategory, resolvedSubscriptions]
  );

  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !ignoredItemIds.includes(item.id) &&
          (activeCategory === 'all' || item.subscriptionCategory === activeCategory) &&
          itemMatches(item, searchTerm)
      ),
    [activeCategory, ignoredItemIds, items, searchTerm]
  );

  const mergeSubscriptions = (nextSubscriptions: RSSSubscription[]) => {
    const merged = new Map<string, RSSSubscription>();
    for (const subscription of nextSubscriptions) {
      merged.set(subscription.id, subscription);
    }
    onSaveSubscriptions(Array.from(merged.values()));
  };

  const labelForCategory = (category: string) => categoryLabels[category] || category;

  const handleAddCategory = () => {
    const label = newCategoryName.trim().slice(0, 16);
    if (!label) {
      return;
    }
    const baseId = createCategoryId(label);
    let id = baseId;
    let index = 2;
    while (categoryLabels[id]) {
      id = `${baseId}-${index}`;
      index += 1;
    }
    setCategoryLabels((current) => ({ ...current, [id]: label }));
    setImportCategory(id);
    setActiveCategory(id);
    setNewCategoryName('');
    setFeedHint(`已新增分组：${label}。`);
  };

  const handleSmartImport = async () => {
    const value = importUrl.trim();
    if (!value) {
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setFeedHint(null);
      setAiResults([]);

      if (isLikelyUrl(value)) {
        const response = await importRssSubscription(toImportableUrl(value), importCategory);
        const merged = new Map(subscriptionBase.map((subscription) => [subscription.id, subscription]));
        merged.set(response.subscription.id, response.subscription);
        onSaveSubscriptions(Array.from(merged.values()));
        setFeedHint(`已导入 ${response.subscription.title}。`);
        setImportUrl('');
        return;
      }

      const response = await discoverRssSubscriptions({
        query: value,
        category: importCategory,
        aiProfile: activeProfile,
      });
      setAiResults(response.subscriptions);
      setFeedHint(response.message || `AI 已根据“${value}”找到 ${response.subscriptions.length} 个候选源。`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : currentInputIsUrl ? 'RSS 导入失败。' : 'AI 搜索 RSS 失败。');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-8 py-8">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-on-surface">RSS 订阅</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-on-surface-variant">
            粘贴 RSS/Atom 链接会直接导入；输入关键词会调用当前 AI 配置搜索可读订阅源。每条更新都能直接送进脱水队列。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/18 bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-primary/20 hover:text-primary"
            onClick={() => {
              setFeedHint('已补齐推荐订阅。');
              const current = new Map(subscriptionBase.map((subscription) => [subscription.id, subscription]));
              for (const preset of DEFAULT_RSS_SUBSCRIPTIONS) {
                current.set(preset.id, current.get(preset.id) || preset);
              }
              onSaveSubscriptions(Array.from(current.values()));
            }}
            type="button"
          >
            <Plus className="h-4 w-4" />
            导入推荐源
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/18 bg-surface-container-lowest px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-primary/20 hover:text-primary"
            onClick={() => onSaveSubscriptions(subscriptions.map((subscription) => ({ ...subscription })))}
            type="button"
          >
            <RefreshCw className="h-4 w-4" />
            刷新订阅
          </button>
        </div>
      </div>

      <section className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">智能导入</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">链接导入 / AI 搜索</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-on-surface-variant">
            当前输入会自动判断：链接走订阅校验，非链接走 AI 发现并返回候选源。
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_180px_auto]">
          <label className="relative block">
            {currentInputIsUrl ? (
              <Rss className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            ) : (
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            )}
            <input
              className="w-full rounded-lg border border-outline-variant/16 bg-surface-container-low px-10 py-3 text-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setImportUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSmartImport();
                }
              }}
              placeholder="粘贴 RSS / Atom 地址，或输入关键词让 AI 搜索"
              value={importUrl}
            />
          </label>

          <select
            className="rounded-lg border border-outline-variant/16 bg-surface-container-low px-4 py-3 text-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
            onChange={(event) => setImportCategory(event.target.value as RSSSubscription['category'])}
            value={importCategory}
          >
            {importCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {labelForCategory(category)}
              </option>
            ))}
          </select>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-5 py-3 text-sm font-bold text-on-primary"
            disabled={importing || !importUrl.trim()}
            onClick={() => void handleSmartImport()}
            type="button"
          >
            {importing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : currentInputIsUrl ? <Plus className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {currentInputIsUrl ? '导入订阅' : 'AI 搜索'}
          </button>
        </div>

        {feedHint ? <p className="mt-4 text-sm leading-7 text-on-surface-variant">{feedHint}</p> : null}
        {error ? <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div> : null}

        {aiResults.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {aiResults.map((subscription) => {
              const exists = subscriptionBase.some((item) => item.url === subscription.url || item.id === subscription.id);
              return (
                <article key={subscription.id} className="rounded-lg border border-outline-variant/14 bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                      {subscription.siteUrl ? (
                        <img alt={subscription.title} className="h-7 w-7 rounded-md object-cover" src={faviconUrl(subscription.siteUrl)} />
                      ) : (
                        <Rss className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-bold text-on-surface">{subscription.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">{subscription.description || subscription.url}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="truncate text-[11px] text-on-surface-variant/70">{subscription.url}</span>
                    <button
                      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${
                        exists
                          ? 'border border-outline-variant/16 text-on-surface-variant'
                          : 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary'
                      }`}
                      disabled={exists}
                      onClick={() => {
                        mergeSubscriptions([...subscriptionBase, subscription]);
                        setFeedHint(`已加入 ${subscription.title}。`);
                      }}
                      type="button"
                    >
                      {exists ? '已存在' : '加入'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="mt-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {categoryOrder.map((category) => (
            <button
              key={category}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                activeCategory === category
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-outline-variant/16 bg-surface-container-lowest text-on-surface-variant hover:border-primary/20 hover:text-primary'
              }`}
              onClick={() => setActiveCategory(category)}
              type="button"
            >
              {labelForCategory(category)}
            </button>
          ))}

          <button
            className="rounded-lg border border-outline-variant/16 bg-surface-container-lowest px-3 py-2 text-sm font-bold text-on-surface-variant transition hover:border-primary/20 hover:text-primary"
            onClick={() => setEditingCategories((editing) => !editing)}
            type="button"
          >
            {editingCategories ? '收起分组名' : '编辑分组名'}
          </button>

          <label className="relative ml-auto block min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
            <input
              className="w-full rounded-lg border border-outline-variant/16 bg-surface-container-lowest px-10 py-2.5 text-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="检索标题或来源"
              value={searchTerm}
            />
          </label>
        </div>

        {editingCategories ? (
          <div className="mb-5 rounded-xl border border-outline-variant/14 bg-surface-container-lowest p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative block min-w-0 flex-1">
                <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
                <input
                  className="w-full rounded-lg border border-outline-variant/16 bg-surface-container-low px-10 py-2.5 text-sm font-bold text-on-surface outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/10"
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddCategory();
                    }
                  }}
                  placeholder="新增分组，例如：认知科学、设计、商业"
                  value={newCategoryName}
                />
              </label>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50"
                disabled={!newCategoryName.trim()}
                onClick={handleAddCategory}
                type="button"
              >
                <Plus className="h-4 w-4" />
                新增分组
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {categoryOrder.map((category) => (
                <label
                  key={category}
                  className="inline-flex items-center gap-2 rounded-full border border-outline-variant/14 bg-surface-container-low px-3 py-2"
                >
                  <input
                    aria-label={`编辑${labelForCategory(category)}分组名`}
                    className="w-[8.5rem] border-none bg-transparent p-0 text-sm font-bold text-on-surface outline-none focus:ring-0"
                    onChange={(event) =>
                      setCategoryLabels((current) => ({
                        ...current,
                        [category]: event.target.value.slice(0, 16),
                      }))
                    }
                    value={labelForCategory(category)}
                  />
                  {category.startsWith('custom-') ? (
                    <button
                      className="text-xs font-bold text-on-surface-variant hover:text-rose-600"
                      onClick={() => {
                        setCategoryLabels((current) => {
                          const next = { ...current };
                          delete next[category];
                          return next;
                        });
                        mergeSubscriptions(subscriptionBase.map((item) => (item.category === category ? { ...item, category: 'custom' } : item)));
                        if (activeCategory === category) {
                          setActiveCategory('all');
                        }
                        if (importCategory === category) {
                          setImportCategory('custom');
                        }
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleSubscriptions.map((subscription) => (
            <article key={subscription.id} className="overflow-hidden rounded-xl border border-outline-variant/14 bg-surface-container-lowest">
              <div className="relative h-40 w-full overflow-hidden bg-surface-container-low">
                {subscription.coverImageUrl ? (
                  <img
                    alt={subscription.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    src={subscription.coverImageUrl}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-primary)/12,transparent)]">
                    {subscription.siteUrl ? (
                      <img alt={subscription.title} className="h-20 w-20 rounded-2xl object-cover" src={faviconUrl(subscription.siteUrl)} />
                    ) : (
                      <Rss className="h-12 w-12 text-primary/70" />
                    )}
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-surface-container-lowest/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  {labelForCategory(subscription.category)}
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-on-surface">{subscription.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">{subscription.description || subscription.url}</p>
                  </div>
                  <button
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      subscription.enabled
                        ? 'border-primary/20 bg-primary/8 text-primary'
                        : 'border-outline-variant/16 bg-surface text-on-surface-variant'
                    }`}
                    onClick={() =>
                      mergeSubscriptions(
                        subscriptionBase.map((item) => (item.id === subscription.id ? { ...item, enabled: !item.enabled } : item))
                      )
                    }
                    type="button"
                  >
                    {subscription.enabled ? '已启用' : '已停用'}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
                  {subscription.siteUrl ? (
                    <a className="inline-flex items-center gap-1 hover:text-primary" href={subscription.siteUrl} rel="noreferrer" target="_blank">
                      打开站点 <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {subscription.lastError ? <span className="text-rose-600">{subscription.lastError}</span> : null}
                </div>

                <button
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-rose-600"
                  onClick={() => mergeSubscriptions(subscriptionBase.filter((item) => item.id !== subscription.id))}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  删除订阅
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-on-surface">最近更新</h2>
            <p className="mt-2 text-sm text-on-surface-variant">每个订阅默认抓 4 条最新内容，直接点“脱水这条”就会进入队列。</p>
          </div>
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-on-surface-variant">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              正在刷新 RSS...
            </div>
          ) : null}
        </div>

        <div className="columns-1 gap-5 md:columns-2 xl:columns-3 2xl:columns-4">
          {visibleItems.map((item) => {
            const excerpt = item.excerpt || '该订阅项没有提供摘要，建议直接脱水正文。';
            return (
              <article
                key={item.id}
                className="group mb-5 break-inside-avoid overflow-hidden rounded-lg border border-outline-variant/14 bg-surface-container-lowest shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(137,72,84,0.08)]"
              >
                {item.coverImageUrl ? (
                  <div className="relative max-h-56 overflow-hidden bg-surface-container-low">
                    <img alt={item.title} className="block h-auto w-full object-cover transition duration-500 group-hover:scale-[1.02]" referrerPolicy="no-referrer" src={item.coverImageUrl} />
                  </div>
                ) : null}

                <div className="p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-on-surface-variant">
                    {item.sourceSiteUrl ? <img alt="" className="h-4 w-4 rounded object-cover" src={faviconUrl(item.sourceSiteUrl)} /> : null}
                    <span className="truncate font-bold text-primary">{item.subscriptionTitle}</span>
                    <span className="shrink-0">{formatPublishedAt(item.publishedAt)}</span>
                  </div>
                  <h3 className="text-base font-bold leading-6 text-on-surface">{item.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-on-surface-variant">{excerpt}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/8 px-2.5 py-1 text-[10px] font-bold text-primary">{labelForCategory(item.subscriptionCategory)}</span>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-on-primary disabled:cursor-wait disabled:opacity-70"
                      disabled={dehydratingUrls.includes(item.url)}
                      onClick={async () => {
                        try {
                          setDehydratingUrls((current) => (current.includes(item.url) ? current : [...current, item.url]));
                          await onDehydrateUrl(item.url);
                        } finally {
                          setDehydratingUrls((current) => current.filter((url) => url !== item.url));
                        }
                      }}
                      type="button"
                    >
                      <Bolt className="h-3.5 w-3.5" />
                      {dehydratingUrls.includes(item.url) ? '排队' : '脱水'}
                    </button>

                    <a className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-primary" href={item.url} rel="noreferrer" target="_blank">
                      原文 <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant hover:text-primary"
                      onClick={() => onIgnoreItem(item.id)}
                      type="button"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                      忽略
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && !visibleItems.length ? (
            <div className="rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-16 text-center">
              <h3 className="text-2xl font-bold text-on-surface">当前没有可展示的更新</h3>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant">
                可能是订阅还没刷新完成，或者当前筛选条件太窄。你也可以直接上方粘贴新的 RSS 地址导入。
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
