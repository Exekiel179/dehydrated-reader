import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { TopAppBar } from './components/TopAppBar';
import { ViewType, Analysis, AiProfile, ColorTheme, AccentPreset, RSSSubscription, SocialCrawlerSettings, PromptSettings } from './types';
import { currentUser, mockAnalyses } from './mockData';
import { DashboardView } from './components/DashboardView';
import { AnalysisView } from './components/AnalysisView';
import { OutputStudioView } from './components/OutputStudioView';
import { PointerParticlesEffect } from './components/PointerParticlesEffect';
import { RSSFeedView } from './components/RSSFeedView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { TrendTrackerView } from './components/TrendTrackerView';
import { SocialCrawlerView } from './components/SocialCrawlerView';
import { deleteAnalysis, estimateSource, generateStructureDiagram, requestDehydration, testProfileConnectivity } from './lib/api';
import { DEFAULT_RSS_SUBSCRIPTIONS } from './rssPresets';
import {
  ACCENT_PRESET_STORAGE_KEY,
  applyColorTheme,
  COLOR_THEME_STORAGE_KEY,
  resolveStoredAccentPreset,
  resolveStoredColorTheme,
} from './lib/theme';
import { SettingsView } from './components/SettingsView';

const ANALYSES_STORAGE_KEY = 'dehydrated-reader-analyses';
const AI_PROFILES_STORAGE_KEY = 'dehydrated-reader-ai-profiles';
const ACTIVE_PROFILE_STORAGE_KEY = 'dehydrated-reader-active-ai-profile';
const IGNORED_FEED_ITEMS_STORAGE_KEY = 'dehydrated-reader-ignored-feed-items';
const IGNORED_TREND_ITEMS_STORAGE_KEY = 'dehydrated-reader-ignored-trend-items';
const USER_PROFILE_STORAGE_KEY = 'dehydrated-reader-user-profile';
const SOCIAL_CRAWLER_SETTINGS_STORAGE_KEY = 'dehydrated-reader-social-crawler-settings';
const RSS_SUBSCRIPTIONS_STORAGE_KEY = 'dehydrated-reader-rss-subscriptions';
const PROMPT_SETTINGS_STORAGE_KEY = 'dehydrated-reader-prompt-settings';

const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  summaryPrompt:
    '只保留信息密度高的事实、判断、结构和行动线索。删除套话、过渡句、空泛形容、重复背景。摘要必须适合回看、标注和写入知识库。',
  structurePrompt:
    '结构图必须表达文章自身的论证推进、层级关系、因果链或并列关系。不要画“原文到摘要”的通用流程图，节点必须来自当前条目的真实内容。',
};

const DEFAULT_SOCIAL_CRAWLER_SETTINGS: SocialCrawlerSettings = {
  pythonPath: '',
  xhsRoot: 'F:\\Projects\\媒体信息投放\\cv-cat\\Spider_XHS',
  xhsCookies: '',
  douyinRoot: 'F:\\Projects\\媒体信息投放\\cv-cat\\DouYin_Spider',
  douyinCookies: '',
  douyinLiveCookies: '',
  wechatRoot: 'F:\\Projects\\公众号文章爬虫\\wechat_spider\\wechat_spider',
  wechatToken: '',
  wechatCookieString: '',
  wechatCacheFile: 'F:\\Projects\\公众号文章爬虫\\wechat_spider\\wechat_spider\\wechat_cache.json',
  wechatManualVerify: true,
  crawlSubpages: false,
  crawlMaxDepth: 1,
  crawlMaxPages: 6,
};

function normalizeUserProfile(user: Partial<typeof currentUser> | null | undefined) {
  return {
    ...currentUser,
    ...user,
    name: user?.name || currentUser.name,
    title: user?.title || currentUser.title,
    avatarUrl: user?.avatarUrl || currentUser.avatarUrl,
  };
}

function normalizeSocialCrawlerSettings(settings: Partial<SocialCrawlerSettings> | null | undefined): SocialCrawlerSettings {
  return {
    pythonPath: settings?.pythonPath || DEFAULT_SOCIAL_CRAWLER_SETTINGS.pythonPath,
    xhsRoot: settings?.xhsRoot || DEFAULT_SOCIAL_CRAWLER_SETTINGS.xhsRoot,
    xhsCookies: settings?.xhsCookies || '',
    douyinRoot: settings?.douyinRoot || DEFAULT_SOCIAL_CRAWLER_SETTINGS.douyinRoot,
    douyinCookies: settings?.douyinCookies || '',
    douyinLiveCookies: settings?.douyinLiveCookies || '',
    wechatRoot: settings?.wechatRoot || DEFAULT_SOCIAL_CRAWLER_SETTINGS.wechatRoot,
    wechatToken: settings?.wechatToken || '',
    wechatCookieString: settings?.wechatCookieString || '',
    wechatCacheFile: settings?.wechatCacheFile || DEFAULT_SOCIAL_CRAWLER_SETTINGS.wechatCacheFile,
    wechatManualVerify: settings?.wechatManualVerify !== false,
    crawlSubpages: Boolean(settings?.crawlSubpages),
    crawlMaxDepth: Math.max(1, Math.min(3, Number(settings?.crawlMaxDepth || DEFAULT_SOCIAL_CRAWLER_SETTINGS.crawlMaxDepth))),
    crawlMaxPages: Math.max(1, Math.min(24, Number(settings?.crawlMaxPages || DEFAULT_SOCIAL_CRAWLER_SETTINGS.crawlMaxPages))),
  };
}

function normalizePromptSettings(settings: Partial<PromptSettings> | null | undefined): PromptSettings {
  return {
    summaryPrompt: String(settings?.summaryPrompt || DEFAULT_PROMPT_SETTINGS.summaryPrompt),
    structurePrompt: String(settings?.structurePrompt || DEFAULT_PROMPT_SETTINGS.structurePrompt),
  };
}

function normalizeRssSubscription(subscription: Partial<RSSSubscription> | null | undefined): RSSSubscription {
  const url = String(subscription?.url || '').trim();
  const baseId = url || String(Date.now());
  return {
    id: String(subscription?.id || `rss-${baseId}`),
    title: String(subscription?.title || url || '未命名 RSS'),
    url,
    siteUrl: subscription?.siteUrl || undefined,
    category: subscription?.category || 'custom',
    description: subscription?.description || undefined,
    coverImageUrl: subscription?.coverImageUrl || undefined,
    enabled: subscription?.enabled !== false,
    lastFetchedAt: subscription?.lastFetchedAt,
    lastError: subscription?.lastError,
  };
}

interface DehydrateQueueSnapshot {
  id: string;
  source: string;
  status: 'queued' | 'processing';
}

interface DehydrateQueueJob {
  id: string;
  source: string;
  options: { verifyWithSearch: boolean; saveToKnowledgeBase: boolean; dehydrationLevel: number };
  aiProfile: AiProfile | null;
  socialCrawlerSettings: SocialCrawlerSettings;
  promptSettings: PromptSettings;
  resolve: (analysis: Analysis) => void;
  reject: (error: unknown) => void;
}

function estimateReadingMinutesFromText(markdown: string) {
  const normalized = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const hanChars = (normalized.match(/\p{Script=Han}/gu) || []).length;
  const latinWords = (normalized.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  return Math.max(0.25, Number((hanChars / 320 + latinWords / 220).toFixed(2)));
}

function parseReadMinutes(readTime: string) {
  const match = readTime.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

function countInsightBullets(content: string) {
  const lines = content.split('\n');
  let inCoreSection = false;
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#\s*核心摘要/.test(trimmed)) {
      inCoreSection = true;
      continue;
    }
    if (inCoreSection && /^#\s+/.test(trimmed)) {
      break;
    }
    if (inCoreSection && /^-\s+/.test(trimmed)) {
      count += 1;
    }
  }

  return count;
}

function getAnalysisMetrics(analysis: Analysis) {
  const sourceReadMinutes = analysis.metrics?.sourceReadMinutes ?? parseReadMinutes(analysis.readTime);
  const summaryReadMinutes = analysis.metrics?.summaryReadMinutes ?? estimateReadingMinutesFromText(analysis.content);
  const timeSavedMinutes = analysis.metrics?.timeSavedMinutes ?? Math.max(0, Number((sourceReadMinutes - summaryReadMinutes).toFixed(2)));
  const keyInsights = analysis.metrics?.keyInsights ?? countInsightBullets(analysis.content);

  return {
    sourceReadMinutes,
    summaryReadMinutes,
    timeSavedMinutes,
    keyInsights,
  };
}

function isLegacySeedAnalysis(analysis: Analysis) {
  const legacyTitles = new Set(['集体专注的结构逻辑', '量子霸权与加密时代的裂缝', '书信沟通的失落艺术']);
  return legacyTitles.has(analysis.title) || /^([123])$/.test(analysis.id);
}

function createBlankProfile(): AiProfile {
  return {
    id: `profile-${Date.now()}`,
    name: '新配置',
    baseUrl: 'https://api.anthropic.com',
    interfaceMode: 'anthropic-messages',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: '',
    fetchProvider: 'crawl4ai',
    firecrawlBaseUrl: 'https://api.firecrawl.dev',
    firecrawlApiKey: '',
  };
}

function normalizeProfile(profile: Partial<AiProfile> | null | undefined): AiProfile {
  const fallback = createBlankProfile();
  return {
    id: profile?.id || fallback.id,
    name: profile?.name || fallback.name,
    baseUrl: profile?.baseUrl || fallback.baseUrl,
    interfaceMode: profile?.interfaceMode || fallback.interfaceMode,
    model: profile?.model || fallback.model,
    apiKey: profile?.apiKey || '',
    fetchProvider: profile?.fetchProvider || fallback.fetchProvider,
    firecrawlBaseUrl: profile?.firecrawlBaseUrl || fallback.firecrawlBaseUrl,
    firecrawlApiKey: profile?.firecrawlApiKey || '',
  };
}

function inferType(source: string): Analysis['type'] {
  const value = source.toLowerCase();
  if (/(youtube|youtu\.be|bilibili|vimeo)/.test(value)) {
    return 'video';
  }
  if (/\.(pdf|epub|mobi|txt)$/i.test(value) || /(arxiv|ssrn|paper|ebook)/.test(value)) {
    return 'book';
  }
  if (/(medium|substack|newsletter|blog|article)/.test(value)) {
    return 'article';
  }
  return 'web';
}

function inferTitle(source: string, type: Analysis['type']) {
  try {
    const parsed = new URL(source);
    const slug = parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname;
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    const clean = source.split(/[\\/]/).pop() || source;
    const base = clean.replace(/\.[a-z0-9]+$/i, '');
    return base || `未命名${type === 'video' ? '视频' : type === 'book' ? '文档' : '来源'}`;
  }
}

function buildAnalysis(source: string, index: number, dehydrationLevel = 60): Analysis {
  const type = inferType(source);
  const title = inferTitle(source, type);
  let domainLabel = '本地上传';

  if (source.includes('://')) {
    try {
      domainLabel = new URL(source).hostname.replace(/^www\./, '');
    } catch {
      domainLabel = '自定义来源';
    }
  }

  return {
    id: `generated-${Date.now()}-${index}`,
    title,
    source: domainLabel,
    readTime: type === 'video' ? '等待处理' : type === 'book' ? '等待处理' : '等待处理',
    tags: [
      type === 'video' ? '视频' : type === 'book' ? '文档' : '网页',
    ],
    content: `# 核心摘要\n\n- 尚未开始抓取。\n\n# 结构拆解\n\n- 等待处理。\n\n# 行动项\n\n- 无`,
    visualSynthesis: [],
    timestamp: '刚刚',
    status: 'ready',
    type,
    dehydrationLevel,
    metrics: {
      sourceReadMinutes: 0,
      summaryReadMinutes: 0,
      timeSavedMinutes: 0,
      keyInsights: 0,
    },
  };
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>(() => {
    if (typeof window === 'undefined') {
      return mockAnalyses;
    }

    const savedAnalyses = window.localStorage.getItem(ANALYSES_STORAGE_KEY);
    if (!savedAnalyses) {
      return mockAnalyses;
    }

    try {
      const parsed = JSON.parse(savedAnalyses);
      if (!Array.isArray(parsed)) {
        return mockAnalyses;
      }
      const filtered = parsed.filter((analysis): analysis is Analysis => analysis && typeof analysis.id === 'string' && !isLegacySeedAnalysis(analysis));
      return filtered.length > 0 ? filtered : mockAnalyses;
    } catch {
      return mockAnalyses;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiProfiles, setAiProfiles] = useState<AiProfile[]>(() => {
    if (typeof window === 'undefined') {
      return [createBlankProfile()];
    }

    const savedProfiles = window.localStorage.getItem(AI_PROFILES_STORAGE_KEY);
    if (!savedProfiles) {
      return [createBlankProfile()];
    }

    try {
      const parsed = JSON.parse(savedProfiles);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed.map((profile) => normalizeProfile(profile))
        : [createBlankProfile()];
    } catch {
      return [createBlankProfile()];
    }
  });
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
  });
  const [ignoredFeedItemIds, setIgnoredFeedItemIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(IGNORED_FEED_ITEMS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [ignoredTrendItemIds, setIgnoredTrendItemIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(IGNORED_TREND_ITEMS_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  });
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    if (typeof window === 'undefined') {
      return 'rose';
    }
    return resolveStoredColorTheme(window.localStorage);
  });
  const [accentPreset, setAccentPreset] = useState<AccentPreset>(() => {
    if (typeof window === 'undefined') {
      return 'theme';
    }
    return resolveStoredAccentPreset(window.localStorage);
  });
  const [userProfile, setUserProfile] = useState(() => {
    if (typeof window === 'undefined') {
      return currentUser;
    }

    try {
      const saved = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      return saved ? normalizeUserProfile(JSON.parse(saved)) : currentUser;
    } catch {
      return currentUser;
    }
  });
  const [socialCrawlerSettings, setSocialCrawlerSettings] = useState<SocialCrawlerSettings>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_SOCIAL_CRAWLER_SETTINGS;
    }

    try {
      const saved = window.localStorage.getItem(SOCIAL_CRAWLER_SETTINGS_STORAGE_KEY);
      return saved ? normalizeSocialCrawlerSettings(JSON.parse(saved)) : DEFAULT_SOCIAL_CRAWLER_SETTINGS;
    } catch {
      return DEFAULT_SOCIAL_CRAWLER_SETTINGS;
    }
  });
  const [promptSettings, setPromptSettings] = useState<PromptSettings>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_PROMPT_SETTINGS;
    }

    try {
      const saved = window.localStorage.getItem(PROMPT_SETTINGS_STORAGE_KEY);
      return saved ? normalizePromptSettings(JSON.parse(saved)) : DEFAULT_PROMPT_SETTINGS;
    } catch {
      return DEFAULT_PROMPT_SETTINGS;
    }
  });
  const [rssSubscriptions, setRssSubscriptions] = useState<RSSSubscription[]>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_RSS_SUBSCRIPTIONS;
    }

    try {
      const saved = window.localStorage.getItem(RSS_SUBSCRIPTIONS_STORAGE_KEY);
      if (!saved) {
        return DEFAULT_RSS_SUBSCRIPTIONS.map((subscription) => normalizeRssSubscription(subscription));
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed.map((subscription) => normalizeRssSubscription(subscription))
        : DEFAULT_RSS_SUBSCRIPTIONS.map((subscription) => normalizeRssSubscription(subscription));
    } catch {
      return DEFAULT_RSS_SUBSCRIPTIONS.map((subscription) => normalizeRssSubscription(subscription));
    }
  });
  const [dehydrateQueue, setDehydrateQueue] = useState<DehydrateQueueSnapshot[]>([]);
  const dehydrateQueueRef = useRef<DehydrateQueueJob[]>([]);
  const isQueueRunningRef = useRef(false);

  const selectedAnalysis = analyses.find((analysis) => analysis.id === selectedAnalysisId) || analyses[0] || null;
  const activeProfile = aiProfiles.find((profile) => profile.id === activeProfileId) || aiProfiles[0] || null;

  const handleSelectAnalysis = (id: string) => {
    setSelectedAnalysisId(id);
    setCurrentView('analysis');
    setSidebarOpen(false);
  };

  const runDehydrateQueue = useCallback(async () => {
    if (isQueueRunningRef.current) {
      return;
    }

    isQueueRunningRef.current = true;
    try {
      while (dehydrateQueueRef.current.length > 0) {
        const job = dehydrateQueueRef.current.shift();
        if (!job) {
          continue;
        }

        setDehydrateQueue((previous) =>
          previous.map((item) => (item.id === job.id ? { ...item, status: 'processing' } : item))
        );

        try {
          const shouldUseRealPipeline = /^https?:\/\//i.test(job.source.trim());
          const entry = shouldUseRealPipeline
            ? (await requestDehydration({
                url: job.source.trim(),
                options: job.options,
                aiProfile: job.aiProfile,
                socialCrawlerSettings: job.socialCrawlerSettings,
                promptSettings: job.promptSettings,
              })).analysis
            : buildAnalysis(job.source, Date.now(), job.options.dehydrationLevel);

          setAnalyses((previous) => [entry, ...previous]);
          job.resolve(entry);
        } catch (error) {
          job.reject(error);
        } finally {
          setDehydrateQueue((previous) => previous.filter((item) => item.id !== job.id));
        }
      }
    } finally {
      isQueueRunningRef.current = false;
    }
  }, []);

  const handleCreateAnalysis = useCallback(
    ({
      source,
      options,
    }: {
      source: string;
      options: { verifyWithSearch: boolean; saveToKnowledgeBase: boolean; dehydrationLevel: number };
    }) =>
      new Promise<Analysis>((resolve, reject) => {
        const id = `queue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const job: DehydrateQueueJob = {
          id,
          source,
          options,
          aiProfile: activeProfile || null,
          socialCrawlerSettings,
          promptSettings,
          resolve,
          reject,
        };

        dehydrateQueueRef.current.push(job);
        setDehydrateQueue((previous) => [...previous, { id, source, status: 'queued' }]);
        void runDehydrateQueue();
      }),
    [activeProfile, promptSettings, runDehydrateQueue, socialCrawlerSettings]
  );

  const handleEstimateSource = async (url: string) => estimateSource(url, activeProfile, socialCrawlerSettings);

  const handleGenerateStructure = async (id: string) => {
    const target = analyses.find((analysis) => analysis.id === id);
    if (!target) {
      throw new Error('条目不存在。');
    }

    const result = await generateStructureDiagram(target, activeProfile, promptSettings);
    setAnalyses((previous) =>
      previous.map((analysis) =>
        analysis.id === id
          ? {
              ...analysis,
              structureDiagram: result.structureDiagram,
            }
          : analysis
      )
    );
  };

  const handleDeleteAnalysis = async (id: string) => {
    await deleteAnalysis(id);
    setAnalyses((previous) => {
      const next = previous.filter((analysis) => analysis.id !== id);
      if (selectedAnalysisId === id) {
        setSelectedAnalysisId(next[0]?.id || null);
        setCurrentView(next.length ? 'analysis' : 'dashboard');
      }
      return next;
    });
  };

  const derivedUser = useMemo(() => {
    const totals = analyses.reduce(
      (accumulator, analysis) => {
        const metrics = getAnalysisMetrics(analysis);
        accumulator.timeSavedMinutes += metrics.timeSavedMinutes;
        accumulator.keyInsights += metrics.keyInsights;
        return accumulator;
      },
      { timeSavedMinutes: 0, keyInsights: 0 }
    );

    return {
      ...userProfile,
      proficiency: Math.min(97, currentUser.proficiency + Math.max(0, analyses.length - mockAnalyses.length) * 2),
      keyInsights: totals.keyInsights,
      timeSaved: `${(totals.timeSavedMinutes / 60).toFixed(1)}h`,
    };
  }, [analyses, userProfile]);

  useEffect(() => {
    window.localStorage.setItem(ANALYSES_STORAGE_KEY, JSON.stringify(analyses));
  }, [analyses]);

  useEffect(() => {
    window.localStorage.setItem(AI_PROFILES_STORAGE_KEY, JSON.stringify(aiProfiles));
  }, [aiProfiles]);

  useEffect(() => {
    if (activeProfileId) {
      window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
      return;
    }

    window.localStorage.removeItem(ACTIVE_PROFILE_STORAGE_KEY);
  }, [activeProfileId]);

  useEffect(() => {
    window.localStorage.setItem(IGNORED_FEED_ITEMS_STORAGE_KEY, JSON.stringify(ignoredFeedItemIds));
  }, [ignoredFeedItemIds]);

  useEffect(() => {
    window.localStorage.setItem(IGNORED_TREND_ITEMS_STORAGE_KEY, JSON.stringify(ignoredTrendItemIds));
  }, [ignoredTrendItemIds]);

  useEffect(() => {
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify({
      name: userProfile.name,
      title: userProfile.title,
      avatarUrl: userProfile.avatarUrl,
    }));
  }, [userProfile]);

  useEffect(() => {
    window.localStorage.setItem(SOCIAL_CRAWLER_SETTINGS_STORAGE_KEY, JSON.stringify(socialCrawlerSettings));
  }, [socialCrawlerSettings]);

  useEffect(() => {
    window.localStorage.setItem(PROMPT_SETTINGS_STORAGE_KEY, JSON.stringify(promptSettings));
  }, [promptSettings]);

  useEffect(() => {
    window.localStorage.setItem(RSS_SUBSCRIPTIONS_STORAGE_KEY, JSON.stringify(rssSubscriptions));
  }, [rssSubscriptions]);

  useLayoutEffect(() => {
    applyColorTheme(colorTheme, accentPreset);
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    window.localStorage.setItem(ACCENT_PRESET_STORAGE_KEY, accentPreset);
  }, [accentPreset, colorTheme]);

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    if (view !== 'analysis') {
      setSelectedAnalysisId(null);
    }
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            user={derivedUser}
            recentAnalyses={analyses}
            onEstimateSource={handleEstimateSource}
            onSelectAnalysis={handleSelectAnalysis}
            onCreateAnalysis={handleCreateAnalysis}
            queueItems={dehydrateQueue}
          />
        );
      case 'analysis':
        return <AnalysisView analysis={selectedAnalysis} onDelete={handleDeleteAnalysis} onGenerateStructure={handleGenerateStructure} />;
      case 'output-studio':
        return <OutputStudioView analyses={analyses} onSelect={handleSelectAnalysis} />;
      case 'rss-feed':
        return (
          <RSSFeedView
            activeProfile={activeProfile}
            ignoredItemIds={ignoredFeedItemIds}
            onDehydrateUrl={(url) =>
              handleCreateAnalysis({
                source: url,
                options: {
                  verifyWithSearch: false,
                  saveToKnowledgeBase: true,
                  dehydrationLevel: 70,
                },
              }).then(() => undefined)
            }
            onIgnoreItem={(id) => {
              setIgnoredFeedItemIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
            }}
            onSaveSubscriptions={(subscriptions) => setRssSubscriptions(subscriptions.map((subscription) => normalizeRssSubscription(subscription)))}
            subscriptions={rssSubscriptions}
          />
        );
      case 'knowledge-base':
        return <KnowledgeBaseView analyses={analyses} onSelect={handleSelectAnalysis} onDelete={handleDeleteAnalysis} />;
      case 'trend-tracker':
        return (
          <TrendTrackerView
            ignoredTopicIds={ignoredTrendItemIds}
            onDehydrateUrl={(url) =>
              handleCreateAnalysis({
                source: url,
                options: {
                  verifyWithSearch: false,
                  saveToKnowledgeBase: true,
                  dehydrationLevel: 70,
                },
              }).then(() => undefined)
            }
            onIgnoreTopic={(id) => {
              setIgnoredTrendItemIds((previous) => (previous.includes(id) ? previous : [...previous, id]));
            }}
          />
        );
      case 'social-crawler':
        return (
          <SocialCrawlerView
            onDehydrateUrl={(url) =>
              handleCreateAnalysis({
                source: url,
                options: {
                  verifyWithSearch: false,
                  saveToKnowledgeBase: true,
                  dehydrationLevel: 70,
                },
              }).then(() => undefined)
            }
            onOpenSettings={() => setCurrentView('settings')}
            settings={socialCrawlerSettings}
          />
        );
      case 'settings':
        return (
          <SettingsView
            profiles={aiProfiles}
            activeProfileId={activeProfile?.id || null}
            onSaveProfile={(profile) => {
              const normalized = normalizeProfile(profile);
              setAiProfiles((previous) => {
                const exists = previous.some((item) => item.id === normalized.id);
                return exists
                  ? previous.map((item) => (item.id === normalized.id ? normalized : item))
                  : [normalized, ...previous];
              });
            }}
            onDeleteProfile={(profileId) => {
              setAiProfiles((previous) => {
                const filtered = previous.filter((profile) => profile.id !== profileId);
                const nextProfiles = filtered.length > 0 ? filtered : [createBlankProfile()];
                if (activeProfileId === profileId) {
                  setActiveProfileId(nextProfiles[0]?.id || null);
                }
                return nextProfiles;
              });
            }}
            onActivateProfile={(profileId) => {
              setActiveProfileId(profileId);
            }}
            onCreateProfile={() => {
              const profile = createBlankProfile();
              setAiProfiles((previous) => [profile, ...previous]);
              setActiveProfileId(profile.id);
              return profile;
            }}
            onTestProfile={(profile) => testProfileConnectivity(normalizeProfile(profile))}
            colorTheme={colorTheme}
            onThemeChange={setColorTheme}
            accentPreset={accentPreset}
            onAccentPresetChange={setAccentPreset}
            userProfile={userProfile}
            onSaveUserProfile={(user) => setUserProfile(normalizeUserProfile(user))}
            socialCrawlerSettings={socialCrawlerSettings}
            onSaveSocialCrawlerSettings={(settings) => setSocialCrawlerSettings(normalizeSocialCrawlerSettings(settings))}
            promptSettings={promptSettings}
            onSavePromptSettings={(settings) => setPromptSettings(normalizePromptSettings(settings))}
          />
        );
      default:
        return (
          <DashboardView
            user={derivedUser}
            recentAnalyses={analyses}
            onEstimateSource={handleEstimateSource}
            onSelectAnalysis={handleSelectAnalysis}
            onCreateAnalysis={handleCreateAnalysis}
            queueItems={dehydrateQueue}
          />
        );
    }
  };

  return (
    <div className="relative isolate min-h-screen bg-background text-on-surface">
      <PointerParticlesEffect />

      <Sidebar
        currentView={currentView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewAnalysis={() => {
          setCurrentView('dashboard');
          setSelectedAnalysisId(null);
          setSidebarOpen(false);
        }}
        onViewChange={handleViewChange}
      />

      <div className="flex min-h-screen flex-col lg:ml-64">
        <TopAppBar
          user={derivedUser}
          currentView={currentView}
          onMenuToggle={() => setSidebarOpen((open) => !open)}
          activeProfileName={activeProfile?.name || '未配置'}
          onSettingsClick={() => {
            setCurrentView('settings');
            setSidebarOpen(false);
          }}
        />

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView + (selectedAnalysisId || '')}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {sidebarOpen ? (
        <button
          aria-label="关闭导航"
          className="fixed inset-0 z-40 bg-[color:rgba(34,25,27,0.36)] backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}
    </div>
  );
}
