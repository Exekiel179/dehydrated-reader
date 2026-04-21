import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LoaderCircle, Palette, Plus, Save, Trash2, UserRound, Wrench } from 'lucide-react';
import type {
  AccentPreset,
  AiProfile,
  ColorTheme,
  ConnectivityReport,
  FetchProvider,
  InterfaceMode,
  SocialCrawlerSettings,
  TrendMonitorSettings,
  TrendMonitorSource,
  User,
} from '@/src/types';
import { captureSocialAuth, captureWechatAuth, fetchTrendMonitorSettings, openSocialLogin, saveTrendMonitorSettings } from '@/src/lib/api';

interface SettingsViewProps {
  profiles: AiProfile[];
  activeProfileId: string | null;
  onSaveProfile: (profile: AiProfile) => void;
  onDeleteProfile: (profileId: string) => void;
  onActivateProfile: (profileId: string) => void;
  onCreateProfile: () => AiProfile;
  onTestProfile: (profile: AiProfile) => Promise<ConnectivityReport>;
  colorTheme: ColorTheme;
  onThemeChange: (theme: ColorTheme) => void;
  accentPreset: AccentPreset;
  onAccentPresetChange: (preset: AccentPreset) => void;
  userProfile: User;
  onSaveUserProfile: (user: User) => void;
  socialCrawlerSettings: SocialCrawlerSettings;
  onSaveSocialCrawlerSettings: (settings: SocialCrawlerSettings) => void;
}

const PAGE_STYLES: Array<{
  id: string;
  label: string;
  note: string;
  theme: ColorTheme;
  accent: AccentPreset;
  swatches: [string, string, string];
}> = [
  {
    id: 'paper-rose',
    label: '纸本玫瑰',
    note: '保留当前项目的暖纸感，适合阅读与提炼。',
    theme: 'rose',
    accent: 'berry',
    swatches: ['#894854', '#a6606c', '#fcf9f8'],
  },
  {
    id: 'workbench-blue',
    label: '冷静工作台',
    note: '偏工具界面，信息边界更清楚。',
    theme: 'blue',
    accent: 'cobalt',
    swatches: ['#3f67d7', '#6884de', '#f7f9ff'],
  },
  {
    id: 'archive-jade',
    label: '档案玉石',
    note: '更像配置台和资料库，适合后台管理。',
    theme: 'rose',
    accent: 'jade',
    swatches: ['#00685f', '#008378', '#f7fbfa'],
  },
  {
    id: 'editorial-copper',
    label: '铜版编辑',
    note: '更接近出版和策展语气，强调质感。',
    theme: 'rose',
    accent: 'copper',
    swatches: ['#924628', '#b05e3d', '#fffaf7'],
  },
];

function maskKey(apiKey: string) {
  if (!apiKey) {
    return '未填写';
  }
  if (apiKey.length <= 8) {
    return '••••••••';
  }
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function fetchProviderLabel(provider: FetchProvider) {
  switch (provider) {
    case 'crawl4ai':
      return 'Crawl4AI';
    case 'firecrawl':
      return 'Firecrawl';
    default:
      return 'Readability';
  }
}

function CrawlerModeCard({
  active,
  title,
  note,
  onClick,
}: {
  active: boolean;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg border px-4 py-4 text-left transition ${
        active
          ? 'border-primary bg-primary/6 text-on-surface shadow-[0_10px_20px_rgba(107,60,57,0.06)]'
          : 'border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-primary/30 hover:text-primary'
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs leading-6">{note}</p>
        </div>
        {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
      </div>
    </button>
  );
}

interface TrendSourceDraft extends TrendMonitorSource {
  draftKey: string;
}

function createTrendSourceDraft(source?: Partial<TrendMonitorSource>): TrendSourceDraft {
  return {
    draftKey: `trend-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    id: source?.id || '',
    name: source?.name || '',
    enabled: source?.enabled !== false,
  };
}

export function SettingsView({
  profiles,
  activeProfileId,
  onSaveProfile,
  onDeleteProfile,
  onActivateProfile,
  onCreateProfile,
  onTestProfile,
  colorTheme,
  onThemeChange,
  accentPreset,
  onAccentPresetChange,
  userProfile,
  onSaveUserProfile,
  socialCrawlerSettings,
  onSaveSocialCrawlerSettings,
}: SettingsViewProps) {
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) || profiles[0] || null,
    [activeProfileId, profiles]
  );

  const [draft, setDraft] = useState<AiProfile | null>(selectedProfile);
  const [showKey, setShowKey] = useState(false);
  const [showFirecrawlKey, setShowFirecrawlKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectivity, setConnectivity] = useState<ConnectivityReport | null>(null);
  const [userDraft, setUserDraft] = useState<User>(userProfile);
  const [socialDraft, setSocialDraft] = useState<SocialCrawlerSettings>(socialCrawlerSettings);
  const [authAction, setAuthAction] = useState<'xhs' | 'douyin' | 'douyin-live' | 'wechat' | null>(null);
  const [socialHint, setSocialHint] = useState<string | null>(null);
  const [trendSettings, setTrendSettings] = useState<TrendMonitorSettings | null>(null);
  const [trendSourcesDraft, setTrendSourcesDraft] = useState<TrendSourceDraft[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendSaving, setTrendSaving] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [trendHint, setTrendHint] = useState<string | null>(null);

  useEffect(() => {
    setDraft(selectedProfile);
    setShowKey(false);
    setShowFirecrawlKey(false);
    setConnectivity(null);
  }, [selectedProfile]);

  useEffect(() => {
    setUserDraft(userProfile);
  }, [userProfile]);

  useEffect(() => {
    setSocialDraft(socialCrawlerSettings);
  }, [socialCrawlerSettings]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrendSources() {
      setTrendLoading(true);
      setTrendError(null);
      try {
        const payload = await fetchTrendMonitorSettings();
        if (!cancelled) {
          setTrendSettings(payload);
          setTrendSourcesDraft(payload.sources.map((source) => createTrendSourceDraft(source)));
        }
      } catch (error) {
        if (!cancelled) {
          setTrendError(error instanceof Error ? error.message : '热点来源配置读取失败。');
        }
      } finally {
        if (!cancelled) {
          setTrendLoading(false);
        }
      }
    }

    void loadTrendSources();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = (field: keyof AiProfile, value: string) => {
    if (!draft) {
      return;
    }
    setDraft({ ...draft, [field]: value });
  };

  const activePageStyleId =
    PAGE_STYLES.find((style) => style.theme === colorTheme && style.accent === accentPreset)?.id ||
    (accentPreset === 'theme'
      ? PAGE_STYLES.find((style) => style.id === (colorTheme === 'blue' ? 'workbench-blue' : 'paper-rose'))?.id || null
      : null);

  const enabledTrendSources = trendSourcesDraft.filter((source) => source.enabled);
  const disabledTrendSources = trendSourcesDraft.filter((source) => !source.enabled);

  const reloadTrendSources = async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const payload = await fetchTrendMonitorSettings();
      setTrendSettings(payload);
      setTrendSourcesDraft(payload.sources.map((source) => createTrendSourceDraft(source)));
      setTrendHint('已从 TrendRadar 重新读取来源配置。');
    } catch (error) {
      setTrendError(error instanceof Error ? error.message : '热点来源配置读取失败。');
    } finally {
      setTrendLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-4 py-6 md:px-6 md:py-10 lg:px-10">
      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-on-surface-variant/55">配置台</p>
        <h1 className="font-headline text-[clamp(2.4rem,4vw,4rem)] font-extrabold tracking-tight text-on-surface">设置与配置</h1>
        <p className="max-w-3xl text-sm leading-7 text-on-surface-variant">
          在这里统一维护 AI 接口、抓取器路径、社媒凭据和页面风格。当前激活配置会直接用于网址脱水与结构可视化。
        </p>
      </section>

      <section className="grid gap-8 xl:grid-cols-[300px_minmax(0,1fr)]">
        <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border border-primary/15 bg-surface-container shadow-sm">
              <img alt={userDraft.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={userDraft.avatarUrl} />
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">当前用户</p>
            <h2 className="mt-2 font-headline text-3xl font-bold text-on-surface">{userDraft.name}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{userDraft.title}</p>
          </div>

          <div className="space-y-4">
            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">名称</span>
              <input
                className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                onChange={(event) => setUserDraft((current) => ({ ...current, name: event.target.value }))}
                value={userDraft.name}
              />
            </label>

            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">头衔</span>
              <input
                className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                onChange={(event) => setUserDraft((current) => ({ ...current, title: event.target.value }))}
                value={userDraft.title}
              />
            </label>

            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">头像 URL</span>
              <input
                className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                onChange={(event) => setUserDraft((current) => ({ ...current, avatarUrl: event.target.value }))}
                placeholder="https://..."
                value={userDraft.avatarUrl}
              />
            </label>

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-4 py-3 text-sm font-bold text-on-primary"
              onClick={() => onSaveUserProfile(userDraft)}
              type="button"
            >
              <Save className="h-4 w-4" />
              保存身份信息
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">AI 与抓取器配置</p>
              <h2 className="mt-1 font-headline text-3xl font-bold text-on-surface">可切换配置</h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/8 px-3 py-2 text-sm font-bold text-primary"
              onClick={() => {
                const profile = onCreateProfile();
                setDraft(profile);
              }}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新建配置
            </button>
          </div>

          <div className="space-y-3">
            {profiles.map((profile) => {
              const isActive = profile.id === activeProfileId;
              return (
                <button
                  key={profile.id}
                  className={`w-full rounded-lg px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-l-4 border-primary bg-surface-container-lowest shadow-[0_10px_20px_rgba(107,60,57,0.06)]'
                      : 'bg-surface-container-lowest/65 hover:bg-surface-container-lowest'
                  }`}
                  onClick={() => {
                    onActivateProfile(profile.id);
                    setDraft(profile);
                  }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-bold ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>{profile.name}</p>
                      <p className="mt-1 text-xs text-on-surface-variant/75">
                        {profile.interfaceMode} · {profile.model}
                      </p>
                    </div>
                    {isActive ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Active</span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-on-surface-variant/75">
                    <span className="rounded-full bg-surface-container px-2.5 py-1">{fetchProviderLabel(profile.fetchProvider)}</span>
                    <span className="rounded-full bg-surface-container px-2.5 py-1">{maskKey(profile.apiKey)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </section>

      <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
        <div className="mb-6 flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">页面风格</p>
            <h3 className="mt-1 font-headline text-3xl font-bold text-on-surface">页面风格</h3>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PAGE_STYLES.map((style) => {
            const active = style.id === activePageStyleId;
            return (
              <button
                key={style.id}
                className={`relative rounded-lg border p-4 text-left transition ${
                  active ? 'border-primary bg-surface-container-lowest shadow-[0_10px_20px_rgba(107,60,57,0.06)]' : 'border-outline-variant/20 bg-surface hover:border-primary/25'
                }`}
                onClick={() => {
                  onThemeChange(style.theme);
                  onAccentPresetChange(style.accent);
                }}
                type="button"
              >
                <div className="mb-4 flex h-12 overflow-hidden rounded-md border border-black/5">
                  {style.swatches.map((swatch) => (
                    <span key={swatch} className="h-full flex-1" style={{ backgroundColor: swatch }} />
                  ))}
                </div>
                <p className="text-sm font-bold text-on-surface">{style.label}</p>
                <p className="mt-2 text-xs leading-6 text-on-surface-variant">{style.note}</p>
                {active ? <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">热点监控</p>
            <h3 className="mt-1 font-headline text-3xl font-bold text-on-surface">热点监控来源</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-on-surface-variant">
              这里直接管理 TrendRadar 的监控来源，保存后会写回配置文件。新增来源时，`id` 需要和 TrendRadar 实际支持的平台标识一致，否则不会真正抓取。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
              onClick={() => {
                setTrendHint(null);
                setTrendSourcesDraft((current) => [...current, createTrendSourceDraft()]);
              }}
              type="button"
            >
              <Plus className="h-4 w-4" />
              新增来源
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
              disabled={trendLoading}
              onClick={() => {
                void reloadTrendSources();
              }}
              type="button"
            >
              {trendLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              重新读取
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">总来源</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{trendSourcesDraft.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">启用中</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{enabledTrendSources.length}</p>
          </div>
          <div className="rounded-xl border border-outline-variant/12 bg-surface px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">已停用</p>
            <p className="mt-2 font-headline text-3xl font-bold text-primary">{disabledTrendSources.length}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-outline-variant/16 bg-surface-container-lowest p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">TrendRadar 配置文件</p>
          <p className="mt-2 break-all text-sm leading-7 text-on-surface-variant">{trendSettings?.configPath || '读取中...'}</p>
        </div>

        {trendError ? <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{trendError}</div> : null}

        <div className="mt-6 space-y-3">
          {trendSourcesDraft.map((source) => (
            <div key={source.draftKey} className="rounded-lg border border-outline-variant/16 bg-surface-container-lowest p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto_auto] xl:items-end">
                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">显示名称</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) =>
                      setTrendSourcesDraft((current) =>
                        current.map((item) => (item.draftKey === source.draftKey ? { ...item, name: event.target.value } : item))
                      )
                    }
                    placeholder="例如：今日头条"
                    value={source.name}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">平台 ID</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) =>
                      setTrendSourcesDraft((current) =>
                        current.map((item) => (item.draftKey === source.draftKey ? { ...item, id: event.target.value } : item))
                      )
                    }
                    placeholder="例如：toutiao"
                    value={source.id}
                  />
                </label>

                <button
                  className={`rounded-lg border px-4 py-3 text-sm font-bold transition ${
                    source.enabled
                      ? 'border-primary/20 bg-primary/8 text-primary'
                      : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/25 hover:text-primary'
                  }`}
                  onClick={() =>
                    setTrendSourcesDraft((current) =>
                      current.map((item) => (item.draftKey === source.draftKey ? { ...item, enabled: !item.enabled } : item))
                    )
                  }
                  type="button"
                >
                  {source.enabled ? '已启用' : '已停用'}
                </button>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-rose-300 hover:text-rose-600"
                  onClick={() => setTrendSourcesDraft((current) => current.filter((item) => item.draftKey !== source.draftKey))}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </div>
          ))}

          {!trendSourcesDraft.length ? (
            <div className="rounded-lg border border-dashed border-outline-variant/24 bg-surface-container-lowest px-6 py-12 text-center text-sm text-on-surface-variant">
              还没有可编辑的监控来源，先新增一项。
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/16 pt-6">
          <p className="max-w-3xl text-sm leading-7 text-on-surface-variant">
            停用来源后会从 TrendRadar 的 `platforms` 列表移出，并沉淀到 `disabled_platforms` 中，后续仍可在这里重新启用。
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-5 py-3 text-sm font-bold text-on-primary"
            disabled={trendSaving}
            onClick={async () => {
              try {
                setTrendSaving(true);
                setTrendError(null);
                const payload = await saveTrendMonitorSettings({
                  configPath: trendSettings?.configPath || '',
                  sources: trendSourcesDraft.map(({ draftKey, ...source }) => source),
                });
                setTrendSettings(payload);
                setTrendSourcesDraft(payload.sources.map((source) => createTrendSourceDraft(source)));
                setTrendHint('已写回 TrendRadar 配置。');
              } catch (error) {
                setTrendError(error instanceof Error ? error.message : '热点来源配置保存失败。');
              } finally {
                setTrendSaving(false);
              }
            }}
            type="button"
          >
            {trendSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存热点来源
          </button>
        </div>
        {trendHint ? <p className="mt-4 text-sm leading-7 text-on-surface-variant">{trendHint}</p> : null}
      </section>

      <section className="rounded-lg border border-outline-variant/16 bg-surface-container-low p-6">
        <div className="mb-6 flex items-center gap-3">
          <Wrench className="h-5 w-5 text-primary" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">社媒抓取器</p>
            <h3 className="mt-1 font-headline text-3xl font-bold text-on-surface">社媒爬虫凭据</h3>
          </div>
        </div>

        <div className="grid gap-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Python 路径</span>
              <input
                className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                onChange={(event) => setSocialDraft((current) => ({ ...current, pythonPath: event.target.value }))}
                placeholder="留空则自动使用项目内运行时"
                value={socialDraft.pythonPath}
              />
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <section className="rounded-lg border border-outline-variant/16 bg-surface-container-lowest p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">Spider_XHS</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">根目录</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, xhsRoot: event.target.value }))}
                    value={socialDraft.xhsRoot}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">COOKIES</span>
                  <textarea
                    className="min-h-28 w-full rounded-lg border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, xhsCookies: event.target.value }))}
                    placeholder="粘贴登录后的小红书 cookie"
                    value={socialDraft.xhsCookies}
                  />
                  <p className="text-xs leading-6 text-on-surface-variant">
                    格式为 `key=value; key2=value2`。Spider_XHS 至少依赖 `a1`，实际登录态最好同时带上 `web_session`、`gid`、`webId` 等字段。
                  </p>
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'xhs'}
                    onClick={async () => {
                      try {
                        setAuthAction('xhs');
                        setSocialHint(null);
                        const payload = await captureSocialAuth('xhs');
                        const nextDraft = {
                          ...socialDraft,
                          xhsCookies: payload.cookieString || socialDraft.xhsCookies,
                        };
                        setSocialDraft(nextDraft);
                        onSaveSocialCrawlerSettings(nextDraft);
                        setSocialHint(payload.message);
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '小红书登录态捕获失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'xhs' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    登录并写回
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'xhs'}
                    onClick={async () => {
                      try {
                        setAuthAction('xhs');
                        setSocialHint(null);
                        await openSocialLogin('xhs');
                        setSocialHint('已打开小红书登录页。若要自动回填，请直接使用“登录并写回”。');
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '打开小红书登录页失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    打开登录页
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-outline-variant/16 bg-surface-container-lowest p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">DouYin_Spider</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">根目录</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, douyinRoot: event.target.value }))}
                    value={socialDraft.douyinRoot}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">DY_COOKIES</span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, douyinCookies: event.target.value }))}
                    placeholder="www.douyin.com 的登录 cookie"
                    value={socialDraft.douyinCookies}
                  />
                  <p className="text-xs leading-6 text-on-surface-variant">
                    格式为 `key=value; key2=value2`。DouYin_Spider 会直接读取 cookie 串，核心字段是 `s_v_web_id`；`msToken` 缺失时桥接层会自动补，但登录态 cookie 仍建议完整保留。
                  </p>
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">DY_LIVE_COOKIES</span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, douyinLiveCookies: event.target.value }))}
                    placeholder="live.douyin.com 的直播 cookie"
                    value={socialDraft.douyinLiveCookies}
                  />
                  <p className="text-xs leading-6 text-on-surface-variant">
                    同样使用 `key=value; key2=value2`。直播相关接口至少要有 `ttwid`，最好从直播页登录后整串回填。
                  </p>
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'douyin'}
                    onClick={async () => {
                      try {
                        setAuthAction('douyin');
                        setSocialHint(null);
                        const payload = await captureSocialAuth('douyin');
                        const nextDraft = {
                          ...socialDraft,
                          douyinCookies: payload.cookieString || socialDraft.douyinCookies,
                        };
                        setSocialDraft(nextDraft);
                        onSaveSocialCrawlerSettings(nextDraft);
                        setSocialHint(payload.message);
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '抖音网页登录态捕获失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'douyin' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    登录并写回
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'douyin'}
                    onClick={async () => {
                      try {
                        setAuthAction('douyin');
                        setSocialHint(null);
                        await openSocialLogin('douyin');
                        setSocialHint('已打开抖音网页登录页。登录后可继续补浏览器登录助手来自动回填。');
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '打开抖音登录页失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'douyin' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    打开网页登录
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'douyin-live'}
                    onClick={async () => {
                      try {
                        setAuthAction('douyin-live');
                        setSocialHint(null);
                        const payload = await captureSocialAuth('douyin-live');
                        const nextDraft = {
                          ...socialDraft,
                          douyinLiveCookies: payload.cookieString || socialDraft.douyinLiveCookies,
                        };
                        setSocialDraft(nextDraft);
                        onSaveSocialCrawlerSettings(nextDraft);
                        setSocialHint(payload.message);
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '抖音直播登录态捕获失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'douyin-live' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    直播登录并写回
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'douyin-live'}
                    onClick={async () => {
                      try {
                        setAuthAction('douyin-live');
                        setSocialHint(null);
                        await openSocialLogin('douyin-live');
                        setSocialHint('已打开抖音直播页，可用于补直播 cookie。');
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '打开抖音直播页失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'douyin-live' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    打开直播页
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-outline-variant/16 bg-surface-container-lowest p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">wechat_spider</p>
              <div className="mt-4 space-y-4">
                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">根目录</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, wechatRoot: event.target.value }))}
                    value={socialDraft.wechatRoot}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">缓存文件</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, wechatCacheFile: event.target.value }))}
                    value={socialDraft.wechatCacheFile}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">TOKEN</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, wechatToken: event.target.value }))}
                    placeholder="mp.weixin.qq.com 登录后的 token"
                    value={socialDraft.wechatToken}
                  />
                  <p className="text-xs leading-6 text-on-surface-variant">这里填公众号后台登录后 URL 里的纯数字 token。</p>
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">COOKIE</span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border border-outline-variant/20 bg-surface px-4 py-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                    onChange={(event) => setSocialDraft((current) => ({ ...current, wechatCookieString: event.target.value }))}
                    placeholder="公众号后台 cookie；不填时会回退到缓存文件"
                    value={socialDraft.wechatCookieString}
                  />
                  <p className="text-xs leading-6 text-on-surface-variant">
                    格式为 `key=value; key2=value2`。如果不手填，也可以直接扫码登录，程序会把 `token`、`cookie` 和 `wechat_cache.json` 一起写回。
                  </p>
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'wechat'}
                    onClick={async () => {
                      try {
                        setAuthAction('wechat');
                        setSocialHint(null);
                        const payload = await captureWechatAuth(socialDraft);
                        const nextDraft = {
                          ...socialDraft,
                          wechatToken: payload.token,
                          wechatCookieString: payload.cookieString,
                          wechatCacheFile: payload.cacheFile,
                        };
                        setSocialDraft(nextDraft);
                        onSaveSocialCrawlerSettings(nextDraft);
                        setSocialHint(payload.message);
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '公众号扫码登录失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    {authAction === 'wechat' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    扫码登录并写回
                  </button>
                  <button
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline-variant/20 px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                    disabled={authAction === 'wechat'}
                    onClick={async () => {
                      try {
                        setAuthAction('wechat');
                        setSocialHint(null);
                        await openSocialLogin('wechat');
                        setSocialHint('已打开公众号平台登录页。若想自动写回，请直接使用“扫码登录并写回”。');
                      } catch (error) {
                        setSocialHint(error instanceof Error ? error.message : '打开公众号登录页失败。');
                      } finally {
                        setAuthAction(null);
                      }
                    }}
                    type="button"
                  >
                    打开登录页
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/16 pt-6">
          <p className="max-w-3xl text-sm leading-7 text-on-surface-variant">
            小红书和抖音会优先使用这里填写的 cookie；公众号会优先使用这里填写的 token/cookie，再回退到 `wechat_cache.json`。另外，XHS / 抖音若缺少 Node 依赖，桥接层会尝试自动安装。
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-5 py-3 text-sm font-bold text-on-primary"
            onClick={() => onSaveSocialCrawlerSettings(socialDraft)}
            type="button"
          >
            <Save className="h-4 w-4" />
            保存社媒配置
          </button>
        </div>
        {socialHint ? <p className="mt-4 text-sm leading-7 text-on-surface-variant">{socialHint}</p> : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-outline-variant/16 bg-surface">
        {draft ? (
          <>
            <div className="flex flex-col gap-4 border-b border-outline-variant/16 bg-surface-container-high px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">Configuration Detail</p>
                <h3 className="mt-1 font-headline text-3xl font-bold text-on-surface">{draft.name}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {activeProfileId === draft.id ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Active Session</span>
                ) : null}
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/22 px-3 py-2 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                  onClick={() => onDeleteProfile(draft.id)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                  删除配置
                </button>
              </div>
            </div>

            <div className="space-y-8 px-6 py-6">
              <div className="grid gap-8 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">配置名称</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => updateDraft('name', event.target.value)}
                    value={draft.name}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">接口模式</span>
                  <select
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => updateDraft('interfaceMode', event.target.value as InterfaceMode)}
                    value={draft.interfaceMode}
                  >
                    <option value="anthropic-messages">anthropic-messages</option>
                  </select>
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">接口 URL</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => updateDraft('baseUrl', event.target.value)}
                    placeholder="https://api.anthropic.com/v1/messages"
                    value={draft.baseUrl}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">模型选择</span>
                  <input
                    className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                    onChange={(event) => updateDraft('model', event.target.value)}
                    placeholder="claude-3-5-sonnet-20241022"
                    value={draft.model}
                  />
                </label>

                <label className="space-y-2">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">API Key</span>
                  <div className="relative">
                    <input
                      className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 pr-10 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                      onChange={(event) => updateDraft('apiKey', event.target.value)}
                      placeholder="sk-ant-..."
                      type={showKey ? 'text' : 'password'}
                      value={draft.apiKey}
                    />
                    <button
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                      onClick={() => setShowKey((value) => !value)}
                      type="button"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <UserRound className="h-4 w-4 text-primary" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">抓取模式</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <CrawlerModeCard
                    active={draft.fetchProvider === 'crawl4ai'}
                    note="走本地动态抓取，适合复杂页面。"
                    onClick={() => updateDraft('fetchProvider', 'crawl4ai')}
                    title="Crawl4AI"
                  />
                  <CrawlerModeCard
                    active={draft.fetchProvider === 'firecrawl'}
                    note="走接口抓取，需要单独 Firecrawl Key。"
                    onClick={() => updateDraft('fetchProvider', 'firecrawl')}
                    title="Firecrawl"
                  />
                  <CrawlerModeCard
                    active={draft.fetchProvider === 'readability'}
                    note="轻量解析，适合公开静态页面。"
                    onClick={() => updateDraft('fetchProvider', 'readability')}
                    title="Readability"
                  />
                </div>
              </div>

              {draft.fetchProvider === 'firecrawl' ? (
                <div className="grid gap-8 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Firecrawl URL</span>
                    <input
                      className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                      onChange={(event) => updateDraft('firecrawlBaseUrl', event.target.value)}
                      placeholder="https://api.firecrawl.dev"
                      value={draft.firecrawlBaseUrl}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">Firecrawl Key</span>
                    <div className="relative">
                      <input
                        className="w-full border-0 border-b-2 border-outline-variant/28 bg-transparent px-0 py-2 pr-10 text-sm text-on-surface outline-none focus:border-primary focus:ring-0"
                        onChange={(event) => updateDraft('firecrawlApiKey', event.target.value)}
                        placeholder="fc-..."
                        type={showFirecrawlKey ? 'text' : 'password'}
                        value={draft.firecrawlApiKey}
                      />
                      <button
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
                        onClick={() => setShowFirecrawlKey((value) => !value)}
                        type="button"
                      >
                        {showFirecrawlKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-4 border-t border-outline-variant/16 pt-6">
                <button
                  className="text-sm font-bold text-on-surface-variant transition-colors hover:text-on-surface"
                  onClick={() => {
                    if (selectedProfile) {
                      setDraft(selectedProfile);
                    }
                  }}
                  type="button"
                >
                  取消
                </button>
                <button
                  className="rounded-lg border border-outline-variant/20 px-4 py-3 text-sm font-bold text-on-surface-variant hover:border-primary/25 hover:text-primary"
                  onClick={async () => {
                    try {
                      setIsTesting(true);
                      const result = await onTestProfile(draft);
                      setConnectivity(result);
                    } finally {
                      setIsTesting(false);
                    }
                  }}
                  type="button"
                >
                  <span className="inline-flex items-center gap-2">
                    {isTesting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    测试联通性
                  </span>
                </button>
                <button
                  className="rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-8 py-3 text-sm font-bold text-on-primary"
                  onClick={() => {
                    onSaveProfile(draft);
                    onActivateProfile(draft.id);
                  }}
                  type="button"
                >
                  保存配置
                </button>
              </div>

              {connectivity ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`rounded-lg border px-4 py-4 ${connectivity.ai.ok ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}>
                    <p className="text-sm font-bold text-on-surface">AI 接口</p>
                    <p className={`mt-2 text-sm ${connectivity.ai.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{connectivity.ai.message}</p>
                  </div>
                  <div className={`rounded-lg border px-4 py-4 ${connectivity.fetcher.ok ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'}`}>
                    <p className="text-sm font-bold text-on-surface">抓取器</p>
                    <p className={`mt-2 text-sm ${connectivity.fetcher.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{connectivity.fetcher.message}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="px-6 py-16 text-center text-on-surface-variant">还没有可编辑的配置，先新建一组接口设置。</div>
        )}
      </section>
    </div>
  );
}
