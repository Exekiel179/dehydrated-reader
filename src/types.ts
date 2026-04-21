export type ViewType = 'dashboard' | 'analysis' | 'output-studio' | 'knowledge-base' | 'knowledge-search' | 'rss-feed' | 'trend-tracker' | 'social-crawler' | 'settings';
export type ColorTheme = 'rose' | 'blue';
export type AccentPreset = 'theme' | 'jade' | 'berry' | 'cobalt' | 'copper';

export type InterfaceMode = 'anthropic-messages';
export type FetchProvider = 'crawl4ai' | 'firecrawl' | 'readability';
export type ProxyMode = 'off' | 'fixed' | 'pool';
export type ProxyScope = 'all' | 'wechat' | 'crawl4ai' | 'readability' | 'firecrawl';

export interface HydrationSnapshot {
  waterPercent: number;
  signalPercent: number;
  estimatedWaterChars: number;
  estimatedSignalChars: number;
  totalChars: number;
  densityScore: number;
  label: string;
}

export interface HydrationReport {
  before: HydrationSnapshot;
  after: HydrationSnapshot;
  waterDropPercent: number;
  compressionPercent: number;
  compressionRatio: number;
}

export interface AnalysisMetrics {
  sourceReadMinutes: number;
  summaryReadMinutes: number;
  timeSavedMinutes: number;
  keyInsights: number;
}

export interface Analysis {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  readTime: string;
  tags: string[];
  content: string;
  visualSynthesis: {
    prompt: string;
    description: string;
    imageUrl: string;
  }[];
  structureDiagram?: {
    mermaid: string;
    caption: string;
  };
  timestamp: string;
  status: 'ready' | 'unread' | 'essential';
  type: 'article' | 'video' | 'book' | 'web';
  logoUrl?: string;
  coverImageUrl?: string;
  hydration?: HydrationReport;
  dehydrationLevel?: number;
  metrics?: AnalysisMetrics;
}

export interface User {
  name: string;
  title: string;
  avatarUrl: string;
  proficiency: number;
  timeSaved: string;
  keyInsights: number;
}

export interface RandomAvatarResponse {
  avatarUrl: string;
  source: string;
}

export interface AiProfile {
  id: string;
  name: string;
  baseUrl: string;
  interfaceMode: InterfaceMode;
  model: string;
  apiKey: string;
  fetchProvider: FetchProvider;
  firecrawlBaseUrl: string;
  firecrawlApiKey: string;
}

export interface SocialCrawlerSettings {
  pythonPath: string;
  xhsRoot: string;
  xhsCookies: string;
  douyinRoot: string;
  douyinCookies: string;
  douyinLiveCookies: string;
  wechatRoot: string;
  wechatToken: string;
  wechatCookieString: string;
  wechatCacheFile: string;
  wechatManualVerify: boolean;
  wechatMaxPages: number;
  wechatRequestIntervalSeconds: number;
  crawlSubpages: boolean;
  crawlMaxDepth: number;
  crawlMaxPages: number;
  proxyMode: ProxyMode;
  proxyScope: ProxyScope;
  proxyUrl: string;
  proxyListUrl: string;
  proxyList: string;
  proxyStickySession: boolean;
}

export interface SocialCrawlOptions {
  xhsMode?: 'auto' | 'note' | 'user' | 'search';
  xhsSortTypeChoice?: number;
  xhsNoteType?: number;
  xhsNoteTime?: number;
  xhsNoteRange?: number;
  xhsPosDistance?: number;
  xhsGeoLatitude?: string;
  xhsGeoLongitude?: string;
  douyinMode?: 'auto' | 'work' | 'user' | 'search';
  douyinSortType?: string;
  douyinPublishTime?: string;
  douyinFilterDuration?: string;
  douyinSearchRange?: string;
  douyinContentType?: string;
  wechatMode?: 'auto' | 'article' | 'search' | 'account' | 'batch';
  wechatPages?: number;
  wechatDays?: number;
  wechatIncludeContent?: boolean;
  wechatInterval?: number;
  wechatKeywords?: string;
}

export interface PromptSettings {
  summaryPrompt: string;
  structurePrompt: string;
}

export interface DehydrateOptions {
  verifyWithSearch: boolean;
  saveToKnowledgeBase: boolean;
  dehydrationLevel: number;
}

export interface DehydrateRequest {
  url: string;
  options: DehydrateOptions;
  aiProfile?: AiProfile | null;
  socialCrawlerSettings?: SocialCrawlerSettings;
  promptSettings?: PromptSettings;
}

export interface SourceEstimateResponse {
  title: string;
  sourceUrl: string;
  type: Analysis['type'];
  readTime: string;
  hydration: HydrationSnapshot;
  fetchMethod: 'crawl4ai' | 'firecrawl' | 'readability' | 'yt-dlp' | 'wechat';
  coverImageUrl?: string;
  logoUrl?: string;
}

export interface DehydrateResponse {
  analysis: Analysis;
  meta: {
    fetchMethod: 'crawl4ai' | 'firecrawl' | 'readability' | 'yt-dlp' | 'wechat';
    chunkCount: number;
    verificationPerformed: boolean;
    verificationAvailable: boolean;
    knowledgeBaseSaved: boolean;
    orchestrationMode?: 'fixed' | 'agentic-rag';
    ragUsed?: boolean;
    knowledgeHits?: number;
    orchestrationTrace?: Array<{
      tool: string;
      status: 'planned' | 'completed' | 'skipped' | 'failed';
      reason: string;
    }>;
  };
}

export interface StructureDiagramResponse {
  structureDiagram: {
    mermaid: string;
    caption: string;
  };
}

export interface TrendTopic {
  id: string;
  title: string;
  snapshotUrl?: string;
  platformId: string;
  platformName: string;
  latestRank: number;
  occurrences: number;
  latestSnapshot: string;
  score: number;
  timeline: Array<{
    snapshot: string;
    platformName: string;
    rank: number;
  }>;
}

export interface TrendOverviewResponse {
  sourceFile: string;
  snapshotLabel: string;
  generatedAt: string;
  platformSummaries: Array<{
    id: string;
    name: string;
    itemCount: number;
  }>;
  latestItems: TrendTopic[];
  trackedTopics: TrendTopic[];
}

export interface TrendRefreshResponse {
  overview: TrendOverviewResponse;
  message: string;
  stdoutTail: string;
}

export interface TrendMonitorSource {
  id: string;
  name: string;
  enabled: boolean;
}

export interface TrendMonitorSettings {
  configPath: string;
  sources: TrendMonitorSource[];
}

export interface RSSSubscription {
  id: string;
  title: string;
  url: string;
  siteUrl?: string;
  category: 'psychology' | 'psychology-journal' | 'ai' | 'ai-product' | 'github' | 'custom';
  description?: string;
  coverImageUrl?: string;
  enabled: boolean;
  lastFetchedAt?: string;
  lastError?: string;
}

export interface RSSFeedItem {
  id: string;
  subscriptionId: string;
  subscriptionTitle: string;
  subscriptionCategory: RSSSubscription['category'];
  title: string;
  url: string;
  excerpt: string;
  publishedAt?: string;
  coverImageUrl?: string;
  sourceSiteUrl?: string;
}

export interface RSSImportResponse {
  subscription: RSSSubscription;
}

export interface RSSDiscoveryResponse {
  query: string;
  category: RSSSubscription['category'];
  subscriptions: RSSSubscription[];
  rejected: Array<{
    url: string;
    reason: string;
  }>;
  message: string;
}

export interface RSSFeedsResponse {
  subscriptions: RSSSubscription[];
  items: RSSFeedItem[];
  fetchedAt: string;
}

export interface SocialCrawlItem {
  id: string;
  title: string;
  url: string;
  provider: 'xhs' | 'douyin' | 'wechat';
  authorName: string;
  authorUrl?: string;
  summary: string;
  content?: string;
  coverImageUrl?: string;
  tags: string[];
  metrics: Record<string, string | number>;
  publishedAt?: string;
}

export interface SocialCrawlResponse {
  provider: 'xhs' | 'douyin' | 'wechat';
  query: string;
  items: SocialCrawlItem[];
  message: string;
}

export interface SocialAuthCaptureResponse {
  provider: 'xhs' | 'douyin' | 'douyin-live' | 'wechat';
  cookieString?: string;
  token?: string;
  cacheFile?: string;
  message: string;
}

export interface DeleteAnalysisResponse {
  ok: boolean;
  deletedId: string;
  knowledgeBaseDeleted: boolean;
}

export interface KnowledgeSearchHit {
  id: string;
  title: string;
  source: string;
  sourceUrl?: string;
  createdAt?: string;
  score: number;
  snippet: string;
  tags: string[];
  contentPreview: string;
}

export interface KnowledgeSearchResponse {
  query: string;
  hits: KnowledgeSearchHit[];
  total: number;
  message: string;
}

export interface ConnectivityReportItem {
  ok: boolean;
  message: string;
}

export interface ConnectivityReport {
  ai: ConnectivityReportItem;
  fetcher: ConnectivityReportItem;
}
