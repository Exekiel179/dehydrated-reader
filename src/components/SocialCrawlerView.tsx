import { useMemo, useState } from 'react';
import { ArrowRight, BookOpenText, Flame, LoaderCircle, MessageSquareText, Search, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import type { SocialCrawlOptions, SocialCrawlResponse, SocialCrawlerSettings } from '@/src/types';
import { crawlSocial } from '@/src/lib/api';

interface SocialCrawlerViewProps {
  onDehydrateUrl: (url: string) => Promise<void>;
  onOpenSettings: () => void;
  settings: SocialCrawlerSettings;
}

const PLATFORM_META = {
  xhs: {
    label: 'Spider_XHS',
    title: '小红书笔记采集',
    description: '采集图文笔记、封面、互动指标和创作者线索。',
    placeholder: '输入关键词、笔记链接或用户话题',
    icon: WandSparkles,
    accentClass: 'from-[#f7648b] to-[#ff9f8d]',
    queryHint: '优先抓图文笔记与封面图。',
    authHint: '需要小红书登录 cookie',
  },
  douyin: {
    label: 'DouYin_Spider',
    title: '抖音视频采集',
    description: '采集作品、封面、作者和热点视频素材。',
    placeholder: '输入关键词、作品链接或账号方向',
    icon: Flame,
    accentClass: 'from-[#111111] to-[#6f7cff]',
    queryHint: '会优先回传视频封面、作者和互动指标。',
    authHint: '需要网页 cookie，直播能力额外需要 live cookie',
  },
  wechat: {
    label: 'wechat_spider',
    title: '公众号文章采集',
    description: '搜索公众号、读取文章列表，并抓取正文与封面。',
    placeholder: '输入公众号名称或文章链接',
    icon: BookOpenText,
    accentClass: 'from-[#217346] to-[#64b862]',
    queryHint: '支持直接抓文章正文，也支持先搜号再取最近文章。',
    authHint: '可使用扫码缓存，也可直接填写 token/cookie',
  },
} as const;

type SocialProvider = keyof typeof PLATFORM_META;

const DEFAULT_SOCIAL_CRAWL_OPTIONS: SocialCrawlOptions = {
  xhsMode: 'auto',
  xhsSortTypeChoice: 0,
  xhsNoteType: 0,
  xhsNoteTime: 0,
  xhsNoteRange: 0,
  xhsPosDistance: 0,
  xhsGeoLatitude: '',
  xhsGeoLongitude: '',
  douyinMode: 'auto',
  douyinSortType: '0',
  douyinPublishTime: '0',
  douyinFilterDuration: '',
  douyinSearchRange: '0',
  douyinContentType: '0',
  wechatMode: 'auto',
  wechatPages: 3,
  wechatDays: 30,
  wechatIncludeContent: true,
  wechatInterval: 10,
  wechatKeywords: '',
};

function FieldLabel({ children }: { children: string }) {
  return <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">{children}</span>;
}

function OptionSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      <select
        className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
        onChange={(event) => {
          const nextValue = typeof value === 'number' ? Number(event.target.value) : event.target.value;
          onChange(nextValue as T);
        }}
        value={value}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function hasProviderAuth(provider: SocialProvider, settings: SocialCrawlerSettings) {
  switch (provider) {
    case 'xhs':
      return Boolean(settings.xhsCookies.trim());
    case 'douyin':
      return Boolean(settings.douyinCookies.trim());
    case 'wechat':
      return Boolean((settings.wechatToken.trim() && settings.wechatCookieString.trim()) || settings.wechatCacheFile.trim());
  }
}

export function SocialCrawlerView({ onDehydrateUrl, onOpenSettings, settings }: SocialCrawlerViewProps) {
  const [provider, setProvider] = useState<SocialProvider>('xhs');
  const [query, setQuery] = useState('');
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlResult, setCrawlResult] = useState<SocialCrawlResponse | null>(null);
  const [dehydratingUrls, setDehydratingUrls] = useState<string[]>([]);
  const [crawlLimit, setCrawlLimit] = useState(8);
  const [crawlOptions, setCrawlOptions] = useState<SocialCrawlOptions>(DEFAULT_SOCIAL_CRAWL_OPTIONS);

  const activeMeta = PLATFORM_META[provider];
  const authReady = useMemo(() => hasProviderAuth(provider, settings), [provider, settings]);
  const updateOption = <Key extends keyof SocialCrawlOptions>(key: Key, value: SocialCrawlOptions[Key]) => {
    setCrawlOptions((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6 md:py-10 lg:px-10">
      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-on-surface-variant/55">社媒抓取</p>
        <h1 className="font-headline text-[clamp(2.2rem,3.8vw,3.8rem)] font-extrabold tracking-tight text-on-surface">社媒采集器</h1>
        <p className="max-w-3xl text-sm leading-7 text-on-surface-variant">
          小红书、抖音、公众号分别独立工作。先选平台，再抓真实内容，确认后直接送去脱水。
        </p>
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-3">
        {(Object.keys(PLATFORM_META) as SocialProvider[]).map((item) => {
          const meta = PLATFORM_META[item];
          const Icon = meta.icon;
          const active = item === provider;
          const ready = hasProviderAuth(item, settings);

          return (
            <button
              key={item}
              className={`relative overflow-hidden rounded-lg border p-5 text-left transition ${
                active
                  ? 'border-primary bg-surface-container-lowest shadow-[0_12px_30px_rgba(107,60,57,0.08)]'
                  : 'border-outline-variant/18 bg-surface-container-low hover:border-primary/30'
              }`}
              onClick={() => {
                setProvider(item);
                setCrawlResult(null);
                setCrawlError(null);
              }}
              type="button"
            >
              <div className={`mb-5 flex h-14 items-center justify-between rounded-md bg-gradient-to-r ${meta.accentClass} px-4 text-white`}>
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-bold">{meta.label}</span>
                </div>
                {ready ? <ShieldCheck className="h-4 w-4" /> : null}
              </div>
              <h2 className="text-xl font-bold text-on-surface">{meta.title}</h2>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{meta.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
                <span className={`rounded-full px-2.5 py-1 font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {ready ? '认证就绪' : '等待认证'}
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 font-bold text-on-surface-variant">{meta.queryHint}</span>
              </div>
            </button>
          );
        })}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">{activeMeta.label}</p>
              <h2 className="mt-2 font-headline text-3xl font-bold text-on-surface">{activeMeta.title}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${authReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {authReady ? '已配置' : '待配置'}
            </span>
          </div>

          <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
            <p className="text-sm leading-7 text-on-surface-variant">{activeMeta.authHint}</p>
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-primary"
              onClick={onOpenSettings}
              type="button"
            >
              去配置认证
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
            <label className="space-y-2">
              <span className="text-sm font-bold text-on-surface">本次抓取数量</span>
              <input
                className="w-full rounded-lg border border-outline-variant/12 bg-surface px-4 py-3 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
                max={20}
                min={1}
                onChange={(event) => setCrawlLimit(Math.max(1, Math.min(20, Number(event.target.value) || 8)))}
                type="number"
                value={crawlLimit}
              />
            </label>
            {provider === 'wechat' ? (
              <div className="grid gap-2 text-xs leading-6 text-on-surface-variant">
                <p>默认文章列表页数：{settings.wechatMaxPages} 页</p>
                <p>默认请求间隔：{settings.wechatRequestIntervalSeconds} 秒</p>
                <p>本次任务可在下面覆盖，实际参数来自 wechat_spider。</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
            <div className="mb-4">
              <p className="text-sm font-bold text-on-surface">原始爬虫参数</p>
              <p className="mt-1 text-xs leading-6 text-on-surface-variant">这里只做统一入口，参数名和含义按原项目入口暴露的能力来。</p>
            </div>

            {provider === 'xhs' ? (
              <div className="grid gap-3">
                <OptionSelect label="采集模式" value={crawlOptions.xhsMode || 'auto'} onChange={(value) => updateOption('xhsMode', value)} options={[
                  { value: 'auto', label: '自动判断' },
                  { value: 'search', label: '搜索笔记 search_some_note' },
                  { value: 'note', label: '单篇笔记 get_note_info' },
                  { value: 'user', label: '用户主页 get_user_all_notes' },
                ]} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <OptionSelect label="排序" value={crawlOptions.xhsSortTypeChoice ?? 0} onChange={(value) => updateOption('xhsSortTypeChoice', value)} options={[
                    { value: 0, label: '综合排序' },
                    { value: 1, label: '最新' },
                    { value: 2, label: '最多点赞' },
                    { value: 3, label: '最多评论' },
                    { value: 4, label: '最多收藏' },
                  ]} />
                  <OptionSelect label="笔记类型" value={crawlOptions.xhsNoteType ?? 0} onChange={(value) => updateOption('xhsNoteType', value)} options={[
                    { value: 0, label: '不限' },
                    { value: 1, label: '视频笔记' },
                    { value: 2, label: '普通笔记' },
                  ]} />
                  <OptionSelect label="发布时间" value={crawlOptions.xhsNoteTime ?? 0} onChange={(value) => updateOption('xhsNoteTime', value)} options={[
                    { value: 0, label: '不限' },
                    { value: 1, label: '一天内' },
                    { value: 2, label: '一周内' },
                    { value: 3, label: '半年内' },
                  ]} />
                  <OptionSelect label="搜索范围" value={crawlOptions.xhsNoteRange ?? 0} onChange={(value) => updateOption('xhsNoteRange', value)} options={[
                    { value: 0, label: '不限' },
                    { value: 1, label: '已看过' },
                    { value: 2, label: '未看过' },
                    { value: 3, label: '已关注' },
                  ]} />
                  <OptionSelect label="位置距离" value={crawlOptions.xhsPosDistance ?? 0} onChange={(value) => updateOption('xhsPosDistance', value)} options={[
                    { value: 0, label: '不限' },
                    { value: 1, label: '同城' },
                    { value: 2, label: '附近' },
                  ]} />
                </div>
                {(crawlOptions.xhsPosDistance || 0) > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <FieldLabel>纬度 latitude</FieldLabel>
                      <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" onChange={(event) => updateOption('xhsGeoLatitude', event.target.value)} value={crawlOptions.xhsGeoLatitude || ''} />
                    </label>
                    <label className="space-y-2">
                      <FieldLabel>经度 longitude</FieldLabel>
                      <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" onChange={(event) => updateOption('xhsGeoLongitude', event.target.value)} value={crawlOptions.xhsGeoLongitude || ''} />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            {provider === 'douyin' ? (
              <div className="grid gap-3">
                <OptionSelect label="采集模式" value={crawlOptions.douyinMode || 'auto'} onChange={(value) => updateOption('douyinMode', value)} options={[
                  { value: 'auto', label: '自动判断' },
                  { value: 'search', label: '搜索作品 search_some_general_work' },
                  { value: 'work', label: '单个作品 get_work_info' },
                  { value: 'user', label: '用户主页 get_user_all_work_info' },
                ]} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <OptionSelect label="排序" value={crawlOptions.douyinSortType || '0'} onChange={(value) => updateOption('douyinSortType', value)} options={[
                    { value: '0', label: '综合排序' },
                    { value: '1', label: '最多点赞' },
                    { value: '2', label: '最新发布' },
                  ]} />
                  <OptionSelect label="发布时间" value={crawlOptions.douyinPublishTime || '0'} onChange={(value) => updateOption('douyinPublishTime', value)} options={[
                    { value: '0', label: '不限' },
                    { value: '1', label: '一天内' },
                    { value: '7', label: '一周内' },
                    { value: '180', label: '半年内' },
                  ]} />
                  <OptionSelect label="视频时长" value={crawlOptions.douyinFilterDuration || ''} onChange={(value) => updateOption('douyinFilterDuration', value)} options={[
                    { value: '', label: '不限' },
                    { value: '0-1', label: '1 分钟内' },
                    { value: '1-5', label: '1-5 分钟' },
                    { value: '5-10000', label: '5 分钟以上' },
                  ]} />
                  <OptionSelect label="搜索范围" value={crawlOptions.douyinSearchRange || '0'} onChange={(value) => updateOption('douyinSearchRange', value)} options={[
                    { value: '0', label: '不限' },
                    { value: '1', label: '最近看过' },
                    { value: '2', label: '还未看过' },
                    { value: '3', label: '关注的人' },
                  ]} />
                  <OptionSelect label="内容形式" value={crawlOptions.douyinContentType || '0'} onChange={(value) => updateOption('douyinContentType', value)} options={[
                    { value: '0', label: '不限' },
                    { value: '1', label: '视频' },
                    { value: '2', label: '图文' },
                  ]} />
                </div>
              </div>
            ) : null}

            {provider === 'wechat' ? (
              <div className="grid gap-3">
                <OptionSelect label="采集模式" value={crawlOptions.wechatMode || 'auto'} onChange={(value) => updateOption('wechatMode', value)} options={[
                  { value: 'auto', label: '自动判断' },
                  { value: 'article', label: '单篇文章链接' },
                  { value: 'search', label: '只搜索公众号' },
                  { value: 'account', label: '爬取单个公众号' },
                  { value: 'batch', label: '批量公众号' },
                ]} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <FieldLabel>页数 pages</FieldLabel>
                    <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" max={10} min={1} onChange={(event) => updateOption('wechatPages', Number(event.target.value))} type="number" value={crawlOptions.wechatPages ?? 3} />
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>天数 days</FieldLabel>
                    <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" min={0} onChange={(event) => updateOption('wechatDays', Number(event.target.value))} type="number" value={crawlOptions.wechatDays ?? 30} />
                  </label>
                  <label className="space-y-2">
                    <FieldLabel>间隔 interval</FieldLabel>
                    <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" min={2} onChange={(event) => updateOption('wechatInterval', Number(event.target.value))} type="number" value={crawlOptions.wechatInterval ?? 10} />
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5">
                    <input checked={crawlOptions.wechatIncludeContent !== false} className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary" onChange={(event) => updateOption('wechatIncludeContent', event.target.checked)} type="checkbox" />
                    <span className="text-sm font-bold text-on-surface">获取正文 content</span>
                  </label>
                </div>
                <label className="space-y-2">
                  <FieldLabel>关键词过滤 keywords</FieldLabel>
                  <input className="w-full rounded-lg border border-outline-variant/12 bg-surface px-3 py-2.5 text-sm outline-none" onChange={(event) => updateOption('wechatKeywords', event.target.value)} placeholder="多个关键词用逗号分隔" value={crawlOptions.wechatKeywords || ''} />
                </label>
              </div>
            ) : null}
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!query.trim()) {
                setCrawlError('请输入关键词或链接。');
                return;
              }

              setCrawlLoading(true);
              setCrawlError(null);
              try {
                const result = await crawlSocial({ provider, query: query.trim(), limit: crawlLimit, settings, options: crawlOptions });
                setCrawlResult(result);
              } catch (error) {
                setCrawlResult(null);
                setCrawlError(error instanceof Error ? error.message : '社媒爬虫执行失败。');
              } finally {
                setCrawlLoading(false);
              }
            }}
          >
            <label className="space-y-2">
              <span className="text-sm font-bold text-on-surface">关键词或链接</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant/45" />
                <input
                  className="w-full rounded-lg border border-outline-variant/12 bg-surface px-10 py-3 text-sm outline-none transition focus:border-primary/18 focus:ring-2 focus:ring-primary/10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeMeta.placeholder}
                  type="text"
                  value={query}
                />
              </div>
            </label>

            <div className="grid gap-3 text-[11px] text-on-surface-variant">
              <div className="rounded-lg border border-outline-variant/12 bg-surface-container-lowest px-3 py-3">
                <p className="font-bold text-on-surface">平台提示</p>
                <p className="mt-1 leading-6">{activeMeta.queryHint}</p>
              </div>
              <div className="rounded-lg border border-outline-variant/12 bg-surface-container-lowest px-3 py-3">
                <p className="font-bold text-on-surface">推荐输入</p>
                <p className="mt-1 leading-6">
                  {provider === 'xhs' ? '品牌词、选题词、笔记链接。' : provider === 'douyin' ? '热视频方向、作品链接、达人线索。' : '公众号名、文章链接、栏目名。'}
                </p>
              </div>
            </div>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-70"
              disabled={crawlLoading}
              type="submit"
            >
              {crawlLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {crawlLoading ? '抓取中...' : `开始抓取 ${activeMeta.title}`}
            </button>

            {crawlError ? <p className="text-sm text-rose-700">{crawlError}</p> : null}
          </form>
        </section>

        <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">结果区</p>
              <h2 className="mt-2 font-headline text-3xl font-bold text-on-surface">
                {crawlResult ? `${activeMeta.title}结果` : '等待抓取'}
              </h2>
            </div>
            {crawlResult ? (
              <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">
                {crawlResult.items.length} 条
              </span>
            ) : null}
          </div>

          <div className="space-y-4">
            {crawlResult?.items?.map((item) => (
              <article key={`${item.provider}-${item.id}`} className="overflow-hidden rounded-lg border border-outline-variant/12 bg-surface-container-lowest">
                {item.coverImageUrl ? (
                  <div className="h-48 w-full overflow-hidden bg-surface-container">
                    <img alt={item.title} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={item.coverImageUrl} />
                  </div>
                ) : null}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">{item.provider}</p>
                      <h3 className="mt-2 text-lg font-bold leading-7 text-on-surface">{item.title}</h3>
                      <p className="mt-2 text-sm text-on-surface-variant">{item.authorName}</p>
                    </div>
                    <button
                      className="shrink-0 rounded-lg border border-outline-variant/14 bg-surface px-3 py-2 text-sm font-bold text-primary"
                      disabled={dehydratingUrls.includes(item.url)}
                      onClick={async () => {
                        if (!item.url) {
                          return;
                        }
                        try {
                          setDehydratingUrls((current) => (current.includes(item.url) ? current : [...current, item.url]));
                          await onDehydrateUrl(item.url);
                        } finally {
                          setDehydratingUrls((current) => current.filter((url) => url !== item.url));
                        }
                      }}
                      type="button"
                    >
                      {dehydratingUrls.includes(item.url) ? '排队中...' : '送去脱水'}
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-7 text-on-surface-variant">{item.summary}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                    {Object.entries(item.metrics).slice(0, 4).map(([key, value]) => (
                      <span key={key} className="rounded-full bg-surface-container-low px-2.5 py-1">
                        {key}: {String(value)}
                      </span>
                    ))}
                    {item.url ? (
                      <a className="font-bold text-primary" href={item.url} rel="noreferrer" target="_blank">
                        打开原文
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}

            {!crawlResult && !crawlLoading ? (
              <div className="grid min-h-[420px] place-items-center rounded-lg border border-dashed border-outline-variant/20 bg-surface-container-lowest px-6 py-14 text-center">
                <div className="max-w-md space-y-3">
                  <MessageSquareText className="mx-auto h-10 w-10 text-primary/55" />
                  <p className="text-lg font-bold text-on-surface">还没有抓取结果</p>
                  <p className="text-sm leading-7 text-on-surface-variant">
                    选中一个平台，输入关键词或链接后开始抓取。这里会只显示真实返回的数据和封面。
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
