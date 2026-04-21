import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  Flame,
  LoaderCircle,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import type { SocialCrawlOptions, SocialCrawlResponse, SocialCrawlerSettings } from '@/src/types';
import { crawlSocial } from '@/src/lib/api';

interface SocialCrawlerViewProps {
  onDehydrateUrl: (url: string) => Promise<void>;
  onOpenSettings: () => void;
  settings: SocialCrawlerSettings;
}

const PLATFORM_META = {
  xhs: {
    label: '小红书',
    engineName: 'Spider_XHS',
    title: '笔记与图文素材',
    description: '采集笔记正文、图片、封面、作者和互动指标。',
    placeholder: '输入关键词、笔记链接或用户话题',
    icon: WandSparkles,
    accentClass: 'from-[#f85b86] to-[#f59687]',
    softClass: 'bg-[#fff3f5] text-[#9a354d]',
    borderClass: 'border-[#c96a7a]/35',
    queryHint: '适合找消费心理、产品话术、图文封面和评论线索。',
    authHint: '需要小红书登录 cookie',
  },
  douyin: {
    label: '抖音',
    engineName: 'DouYin_Spider',
    title: '短视频与达人素材',
    description: '采集视频作品、封面、作者、发布时间和热度指标。',
    placeholder: '输入关键词、作品链接或账号方向',
    icon: Flame,
    accentClass: 'from-[#19191f] to-[#7467da]',
    softClass: 'bg-[#f0efff] text-[#3f397a]',
    borderClass: 'border-[#7467da]/28',
    queryHint: '适合找短视频选题、爆款结构、达人线索和素材封面。',
    authHint: '需要网页 cookie，直播能力额外需要 live cookie',
  },
  wechat: {
    label: '公众号',
    engineName: 'wechat_spider',
    title: '长文与账号文章',
    description: '搜索公众号、读取文章列表，并抓取正文、摘要和封面。',
    placeholder: '输入公众号名称或文章链接',
    icon: BookOpenText,
    accentClass: 'from-[#267141] to-[#67aa65]',
    softClass: 'bg-[#eef8ef] text-[#28613b]',
    borderClass: 'border-[#4b9656]/28',
    queryHint: '适合抓长文正文、账号近文、封面和可脱水文本。',
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
  const ActivePlatformIcon = activeMeta.icon;
  const authReady = useMemo(() => hasProviderAuth(provider, settings), [provider, settings]);
  const updateOption = <Key extends keyof SocialCrawlOptions>(key: Key, value: SocialCrawlOptions[Key]) => {
    setCrawlOptions((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6 md:py-10 lg:px-10">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-primary/70">Social Capture Desk</p>
          <h1 className="font-headline text-[clamp(2rem,3.2vw,3.35rem)] font-extrabold tracking-tight text-on-surface">社媒采集工作台</h1>
          <p className="max-w-3xl text-sm leading-7 text-on-surface-variant">
            三个爬虫保持独立参数，统一在这里发起采集、预览结果，再把值得保存的内容送去脱水。
          </p>
        </div>
        <button
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/18 bg-surface-container-lowest px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/6"
          onClick={onOpenSettings}
          type="button"
        >
          <SlidersHorizontal className="h-4 w-4" />
          认证与路径设置
        </button>
      </section>

      <section className="sticky top-16 z-30 mt-7 -mx-4 border-y border-outline-variant/12 bg-background/92 px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:-mx-10 lg:px-10">
        <div className="flex gap-2 overflow-x-auto">
          {(Object.keys(PLATFORM_META) as SocialProvider[]).map((item) => {
            const meta = PLATFORM_META[item];
            const Icon = meta.icon;
            const active = item === provider;
            const ready = hasProviderAuth(item, settings);

            return (
              <button
                key={item}
                className={`inline-flex shrink-0 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                  active
                    ? 'bg-primary text-on-primary shadow-[0_10px_20px_rgba(107,60,57,0.08)]'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => {
                  setProvider(item);
                  setCrawlResult(null);
                  setCrawlError(null);
                }}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {meta.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/18 text-on-primary' : ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {ready ? '已认证' : '待认证'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-outline-variant/16 bg-surface-container-lowest shadow-[0_12px_24px_rgba(107,60,57,0.035)]">
        <div className={`h-1.5 bg-gradient-to-r ${activeMeta.accentClass}`} />
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${activeMeta.accentClass} text-white shadow-[0_12px_24px_rgba(35,25,28,0.12)]`}>
              <ActivePlatformIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/48">{activeMeta.engineName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h2 className="font-headline text-2xl font-bold text-on-surface">{activeMeta.label}</h2>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${activeMeta.softClass}`}>{activeMeta.title}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{activeMeta.description}</p>
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-3 text-sm leading-6 text-on-surface-variant lg:max-w-md">
            {activeMeta.queryHint}
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="overflow-hidden rounded-lg border border-outline-variant/16 bg-surface-container-low shadow-[0_18px_34px_rgba(107,60,57,0.04)]">
          <div className={`h-1.5 bg-gradient-to-r ${activeMeta.accentClass}`} />
          <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">{activeMeta.engineName}</p>
              <h2 className="mt-2 font-headline text-3xl font-bold text-on-surface">{activeMeta.label}采集</h2>
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

          <details className="mt-4 rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
            <summary className="cursor-pointer text-sm font-bold text-on-surface">
              原始爬虫参数
              <span className="ml-2 text-xs font-normal text-on-surface-variant">需要细调排序、时间、范围时再展开</span>
            </summary>
            <p className="mt-2 text-xs leading-6 text-on-surface-variant">参数名和含义按原项目入口暴露的能力来，这里只做可视化收口。</p>
            <div className="mt-4">

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
          </details>

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
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6 shadow-[0_18px_34px_rgba(107,60,57,0.04)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">结果区</p>
              <h2 className="mt-2 font-headline text-3xl font-bold text-on-surface">
                {crawlResult ? `${activeMeta.label}结果` : '等待抓取'}
              </h2>
            </div>
            {crawlResult ? (
              <span className="rounded-full bg-primary/8 px-3 py-1 text-xs font-bold text-primary">
                {crawlResult.items.length} 条
              </span>
            ) : null}
          </div>

          <div className={crawlResult?.items?.length ? 'columns-1 gap-4 [column-fill:_balance] 2xl:columns-2' : 'space-y-4'}>
            {crawlResult?.items?.map((item) => (
              <article key={`${item.provider}-${item.id}`} className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-outline-variant/12 bg-surface-container-lowest shadow-[0_12px_24px_rgba(107,60,57,0.035)]">
                {item.coverImageUrl ? (
                  <div className="max-h-64 min-h-36 w-full overflow-hidden bg-surface-container">
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

                  {item.summary ? <p className="mt-3 line-clamp-4 text-sm leading-7 text-on-surface-variant">{item.summary}</p> : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
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
              <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(260px,0.8fr)]">
                  <div className="rounded-lg border border-dashed border-outline-variant/24 bg-surface px-5 py-8">
                    <MessageSquareText className="h-10 w-10 text-primary/55" />
                    <p className="mt-4 text-lg font-bold text-on-surface">等待第一批抓取结果</p>
                    <p className="mt-3 text-sm leading-7 text-on-surface-variant">
                      输入关键词或链接后，这里会展示真实返回的封面、标题、作者、标签和互动指标。没有结果时先显示采集路线，避免右侧变成空白墙。
                    </p>
                  </div>
                  <div className="space-y-3">
                    {[
                      '1. 读取平台登录态与任务参数',
                      '2. 调用对应本地爬虫并抽取封面',
                      '3. 选择条目后送入脱水队列',
                    ].map((step) => (
                      <div key={step} className="rounded-lg border border-outline-variant/12 bg-surface px-4 py-3 text-sm font-bold text-on-surface">
                        {step}
                      </div>
                    ))}
                    <div className="rounded-lg border border-primary/12 bg-primary/6 px-4 py-3 text-xs leading-6 text-on-surface-variant">
                      当前平台：{activeMeta.label}。建议先用 3-5 条小批量测试，确认封面和链接可用后再扩大抓取数量。
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </div>
  );
}
