import type {
  Analysis,
  AiProfile,
  ConnectivityReport,
  DehydrateRequest,
  DehydrateResponse,
  DeleteAnalysisResponse,
  KnowledgeSearchResponse,
  RSSFeedsResponse,
  RSSDiscoveryResponse,
  RSSImportResponse,
  RSSSubscription,
  PromptSettings,
  RandomAvatarResponse,
  SocialAuthCaptureResponse,
  SocialCrawlerSettings,
  SocialCrawlResponse,
  SourceEstimateResponse,
  StructureDiagramResponse,
  TrendMonitorSettings,
  TrendOverviewResponse,
  TrendRefreshResponse,
} from '@/src/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function requestDehydration(payload: DehydrateRequest) {
  const response = await fetch(`${API_BASE}/api/dehydrate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '脱水失败。' })) as { error?: string };
    throw new Error(error.error || '脱水失败。');
  }

  return response.json() as Promise<DehydrateResponse>;
}

export async function estimateSource(url: string, aiProfile?: AiProfile | null, socialCrawlerSettings?: SocialCrawlerSettings) {
  const response = await fetch(`${API_BASE}/api/source-estimate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, aiProfile, socialCrawlerSettings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '预估失败。' })) as { error?: string };
    throw new Error(error.error || '预估失败。');
  }

  return response.json() as Promise<SourceEstimateResponse>;
}

export async function testProfileConnectivity(profile: AiProfile) {
  const response = await fetch(`${API_BASE}/api/test-profile`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ profile }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '联通性测试失败。' })) as { error?: string };
    throw new Error(error.error || '联通性测试失败。');
  }

  return response.json() as Promise<ConnectivityReport>;
}

export async function generateStructureDiagram(analysis: Analysis, aiProfile?: AiProfile | null, promptSettings?: PromptSettings) {
  const response = await fetch(`${API_BASE}/api/structure-diagram`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ analysis, aiProfile, promptSettings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '结构图生成失败。' })) as { error?: string };
    throw new Error(error.error || '结构图生成失败。');
  }

  return response.json() as Promise<StructureDiagramResponse>;
}

export async function deleteAnalysis(id: string) {
  const response = await fetch(`${API_BASE}/api/analyses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '删除失败。' })) as { error?: string };
    throw new Error(error.error || '删除失败。');
  }

  return response.json() as Promise<DeleteAnalysisResponse>;
}

export async function searchKnowledgeBase(payload: { query: string; limit?: number }) {
  const response = await fetch(`${API_BASE}/api/knowledge/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '知识搜索失败。' })) as { error?: string };
    throw new Error(error.error || '知识搜索失败。');
  }

  return response.json() as Promise<KnowledgeSearchResponse>;
}

export async function fetchRandomAvatar() {
  const response = await fetch(`${API_BASE}/api/avatar/random`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '随机头像获取失败。' })) as { error?: string };
    throw new Error(error.error || '随机头像获取失败。');
  }

  return response.json() as Promise<RandomAvatarResponse>;
}

export async function fetchTrendOverview(limit = 24) {
  const response = await fetch(`${API_BASE}/api/trends/overview?limit=${encodeURIComponent(String(limit))}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '热点追踪读取失败。' })) as { error?: string };
    throw new Error(error.error || '热点追踪读取失败。');
  }

  return response.json() as Promise<TrendOverviewResponse>;
}

export async function refreshTrendOverview() {
  const response = await fetch(`${API_BASE}/api/trends/refresh`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '热点采集刷新失败。' })) as { error?: string };
    throw new Error(error.error || '热点采集刷新失败。');
  }

  return response.json() as Promise<TrendRefreshResponse>;
}

export async function fetchTrendMonitorSettings() {
  const response = await fetch(`${API_BASE}/api/trends/settings`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '热点来源配置读取失败。' })) as { error?: string };
    throw new Error(error.error || '热点来源配置读取失败。');
  }

  return response.json() as Promise<TrendMonitorSettings>;
}

export async function saveTrendMonitorSettings(settings: TrendMonitorSettings) {
  const response = await fetch(`${API_BASE}/api/trends/settings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '热点来源配置保存失败。' })) as { error?: string };
    throw new Error(error.error || '热点来源配置保存失败。');
  }

  return response.json() as Promise<TrendMonitorSettings>;
}

export async function importRssSubscription(url: string, category: RSSSubscription['category'] = 'custom') {
  const response = await fetch(`${API_BASE}/api/rss/import`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url, category }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'RSS 导入失败。' })) as { error?: string };
    throw new Error(error.error || 'RSS 导入失败。');
  }

  return response.json() as Promise<RSSImportResponse>;
}

export async function discoverRssSubscriptions(payload: {
  query: string;
  category: RSSSubscription['category'];
  aiProfile?: AiProfile | null;
}) {
  const response = await fetch(`${API_BASE}/api/rss/discover`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'RSS 搜索失败。' })) as { error?: string };
    throw new Error(error.error || 'RSS 搜索失败。');
  }

  return response.json() as Promise<RSSDiscoveryResponse>;
}

export async function fetchRssFeeds(subscriptions: RSSSubscription[], perFeedLimit = 4) {
  const response = await fetch(`${API_BASE}/api/rss/feeds`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ subscriptions, perFeedLimit }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'RSS 抓取失败。' })) as { error?: string };
    throw new Error(error.error || 'RSS 抓取失败。');
  }

  return response.json() as Promise<RSSFeedsResponse>;
}

export async function crawlSocial(payload: {
  provider: 'xhs' | 'douyin' | 'wechat';
  query: string;
  limit: number;
  settings?: SocialCrawlerSettings;
}) {
  const response = await fetch(`${API_BASE}/api/social-crawl`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '社媒爬虫执行失败。' })) as { error?: string };
    throw new Error(error.error || '社媒爬虫执行失败。');
  }

  return response.json() as Promise<SocialCrawlResponse>;
}

export async function openSocialLogin(provider: 'xhs' | 'douyin' | 'douyin-live' | 'wechat') {
  const response = await fetch(`${API_BASE}/api/social-auth/open-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '打开登录页失败。' })) as { error?: string };
    throw new Error(error.error || '打开登录页失败。');
  }

  return response.json() as Promise<{ ok: boolean; provider: string; url: string }>;
}

export async function captureSocialAuth(provider: 'xhs' | 'douyin' | 'douyin-live') {
  const response = await fetch(`${API_BASE}/api/social-auth/capture-login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ provider }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '登录态捕获失败。' })) as { error?: string };
    throw new Error(error.error || '登录态捕获失败。');
  }

  return response.json() as Promise<SocialAuthCaptureResponse>;
}

export async function captureWechatAuth(settings?: SocialCrawlerSettings) {
  const response = await fetch(`${API_BASE}/api/social-auth/capture-wechat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ settings }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: '公众号登录捕获失败。' })) as { error?: string };
    throw new Error(error.error || '公众号登录捕获失败。');
  }

  return response.json() as Promise<SocialAuthCaptureResponse>;
}
