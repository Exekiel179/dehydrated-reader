import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { parseDocument } from 'yaml';
import type {
  AiProfile,
  RSSFeedItem,
  RSSFeedsResponse,
  RSSDiscoveryResponse,
  RSSImportResponse,
  RSSSubscription,
  SocialCrawlResponse,
  SocialCrawlOptions,
  SocialCrawlerSettings,
  TrendMonitorSettings,
  TrendMonitorSource,
  TrendOverviewResponse,
  TrendRefreshResponse,
  TrendTopic,
} from '../src/types.ts';
import { capturePlatformAuth } from './auth_assistant.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const IS_WINDOWS = process.platform === 'win32';
const NPM_COMMAND = IS_WINDOWS ? 'npm.cmd' : 'npm';
const SOCIAL_BRIDGE_RUNTIME_ROOT = path.join(PROJECT_ROOT, '.runtime', 'social-bridge');
const SOCIAL_BRIDGE_VENV = path.join(SOCIAL_BRIDGE_RUNTIME_ROOT, '.venv');
const SOCIAL_BRIDGE_PYTHON = IS_WINDOWS
  ? path.join(SOCIAL_BRIDGE_VENV, 'Scripts', 'python.exe')
  : path.join(SOCIAL_BRIDGE_VENV, 'bin', 'python');
const DEFAULT_TRENDRADAR_ROOT = process.env.TRENDRADAR_ROOT || 'F:\\Projects\\媒体信息投放\\TrendRadar';
const DEFAULT_CV_CAT_ROOT = process.env.CV_CAT_ROOT || 'F:\\Projects\\媒体信息投放\\cv-cat';
const DEFAULT_WECHAT_SPIDER_ROOT = process.env.WECHAT_SPIDER_ROOT || 'F:\\Projects\\公众号文章爬虫\\wechat_spider\\wechat_spider';
const DEFAULT_TOUTIAO_LOG_FROM = process.env.TOUTIAO_LOG_FROM || 'fa83f35d112298_1776708856058';
const TREND_RADAR_PYTHON = IS_WINDOWS
  ? path.join(DEFAULT_TRENDRADAR_ROOT, '.venv', 'Scripts', 'python.exe')
  : path.join(DEFAULT_TRENDRADAR_ROOT, '.venv', 'bin', 'python');
const ensuredNodeDeps = new Map<string, Promise<void>>();
const rssParser = new Parser<unknown, {
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  contentEncoded?: string;
}>({
  timeout: 15000,
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

interface RssDiscoveryCandidate {
  title?: string;
  url?: string;
  siteUrl?: string;
  description?: string;
}

const RSS_DISCOVERY_SEEDS: Record<string, RssDiscoveryCandidate[]> = {
  psychology: [
    { title: 'Psychology Today', url: 'https://www.psychologytoday.com/us/rss', siteUrl: 'https://www.psychologytoday.com' },
    { title: 'BPS Research Digest', url: 'https://www.bps.org.uk/research-digest/rss.xml', siteUrl: 'https://www.bps.org.uk/research-digest' },
    { title: 'Mind Hacks', url: 'https://mindhacks.com/feed/', siteUrl: 'https://mindhacks.com' },
    { title: 'PsyPost', url: 'https://www.psypost.org/feed/', siteUrl: 'https://www.psypost.org' },
  ],
  'psychology-journal': [
    { title: 'APA PsycPORT', url: 'https://www.apa.org/news/psycport/psycport-rss.xml', siteUrl: 'https://www.apa.org/news/psycport' },
    { title: 'Frontiers in Psychology', url: 'https://www.frontiersin.org/journals/psychology/rss', siteUrl: 'https://www.frontiersin.org/journals/psychology' },
    { title: 'Nature Human Behaviour', url: 'https://www.nature.com/nathumbehav.rss', siteUrl: 'https://www.nature.com/nathumbehav' },
  ],
  ai: [
    { title: 'arXiv cs.AI', url: 'https://export.arxiv.org/rss/cs.AI', siteUrl: 'https://arxiv.org/list/cs.AI/recent' },
    { title: 'arXiv cs.CL', url: 'https://export.arxiv.org/rss/cs.CL', siteUrl: 'https://arxiv.org/list/cs.CL/recent' },
    { title: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', siteUrl: 'https://huggingface.co/blog' },
    { title: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', siteUrl: 'https://blog.google/technology/ai/' },
  ],
  'ai-product': [
    { title: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml', siteUrl: 'https://openai.com/news' },
    { title: 'Anthropic News', url: 'https://www.anthropic.com/news/rss.xml', siteUrl: 'https://www.anthropic.com/news' },
    { title: 'Product Hunt AI', url: 'https://www.producthunt.com/feed?category=artificial-intelligence', siteUrl: 'https://www.producthunt.com' },
  ],
  github: [
    { title: 'GitHub Blog', url: 'https://github.blog/feed/', siteUrl: 'https://github.blog' },
    { title: 'GitHub Changelog', url: 'https://github.blog/changelog/feed/', siteUrl: 'https://github.blog/changelog' },
    { title: 'Hacker News', url: 'https://hnrss.org/frontpage', siteUrl: 'https://news.ycombinator.com' },
  ],
  custom: [
    { title: 'Hacker News', url: 'https://hnrss.org/frontpage', siteUrl: 'https://news.ycombinator.com' },
    { title: 'GitHub Blog', url: 'https://github.blog/feed/', siteUrl: 'https://github.blog' },
    { title: 'arXiv cs.AI', url: 'https://export.arxiv.org/rss/cs.AI', siteUrl: 'https://arxiv.org/list/cs.AI/recent' },
  ],
};

interface ParsedTrendItem {
  title: string;
  url?: string;
  mobileUrl?: string;
  rank: number;
  platformId: string;
  platformName: string;
}

interface ParsedTrendSnapshot {
  label: string;
  filePath: string;
  items: ParsedTrendItem[];
  platformSummaries: TrendOverviewResponse['platformSummaries'];
}

function getTrendConfigPath(root = DEFAULT_TRENDRADAR_ROOT) {
  return path.join(root, 'config', 'config.yaml');
}

function normalizeTrendMonitorSource(source: Partial<TrendMonitorSource> | null | undefined): TrendMonitorSource | null {
  const id = String(source?.id || '').trim();
  const name = String(source?.name || '').trim();
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    enabled: source?.enabled !== false,
  };
}

function getAnthropicConfig(profile?: AiProfile | null) {
  return {
    baseUrl: (profile?.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    apiKey: profile?.apiKey || process.env.ANTHROPIC_API_KEY || '',
    model: profile?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
    authMode: process.env.ANTHROPIC_AUTH_MODE || 'x-api-key',
  };
}

async function callAnthropicForRssDiscovery(profile: AiProfile | null | undefined, prompt: string) {
  const config = getAnthropicConfig(profile);
  if (!config.apiKey) {
    return null;
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'anthropic-version': config.version,
  };

  if (config.authMode === 'bearer') {
    headers.authorization = `Bearer ${config.apiKey}`;
  } else {
    headers['x-api-key'] = config.apiKey;
  }

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1200,
      temperature: 0.2,
      system: '你是 RSS 订阅发现助手。只返回 JSON，不解释。',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI RSS 搜索失败：${response.status} ${errorText}`);
  }

  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  return (payload.content || [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function extractJsonObject<T>(raw: string): T {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('AI 没有返回可解析的 JSON。');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

function parseTrendSourceList(value: unknown, enabled: boolean): TrendMonitorSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      return normalizeTrendMonitorSource({
        id: String(record.id || ''),
        name: String(record.name || ''),
        enabled,
      });
    })
    .filter((item): item is TrendMonitorSource => Boolean(item));
}

function normalizeRssCategory(category: unknown): RSSSubscription['category'] {
  const normalized = String(category || 'custom')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'custom';
}

function stripHtml(value: string | undefined) {
  return (value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageFromHtml(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const match = value.match(/<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/i);
  return match?.[1];
}

function normalizeImageUrl(value: string | undefined, baseUrl?: string) {
  if (!value || /^data:/i.test(value)) {
    return undefined;
  }
  try {
    const normalized = baseUrl ? new URL(value, baseUrl).toString() : new URL(value).toString();
    if (/(favicon|apple-touch-icon|sprite|logo)\b/i.test(normalized)) {
      return undefined;
    }
    return normalized;
  } catch {
    return undefined;
  }
}

function normalizeUnknownMediaUrl(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return normalizeUnknownMediaUrl(value[0]);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      normalizeUnknownMediaUrl(record.url) ||
      normalizeUnknownMediaUrl(record['$']) ||
      normalizeUnknownMediaUrl(record.href)
    );
  }
  return undefined;
}

function buildFaviconUrl(siteUrl: string | undefined) {
  if (!siteUrl) {
    return undefined;
  }
  return `https://www.google.com/s2/favicons?sz=256&domain_url=${encodeURIComponent(siteUrl)}`;
}

function pickFeedImage(feed: { image?: { url?: string } | string; link?: string }) {
  if (typeof feed.image === 'string') {
    return feed.image;
  }
  return feed.image?.url || buildFaviconUrl(feed.link);
}

function pickItemImage(item: {
  enclosure?: { url?: string; type?: string };
  mediaContent?: unknown;
  mediaThumbnail?: unknown;
  content?: string;
  contentEncoded?: string;
}, baseUrl?: string) {
  if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
    return normalizeImageUrl(item.enclosure.url, baseUrl);
  }
  return (
    normalizeImageUrl(normalizeUnknownMediaUrl(item.mediaContent), baseUrl) ||
    normalizeImageUrl(normalizeUnknownMediaUrl(item.mediaThumbnail), baseUrl) ||
    normalizeImageUrl(extractImageFromHtml(item.contentEncoded), baseUrl) ||
    normalizeImageUrl(extractImageFromHtml(item.content), baseUrl)
  );
}

async function fetchArticleImage(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    return undefined;
  }
  try {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) {
      return undefined;
    }
    const html = await response.text();
    const metaPatterns = [
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];
    for (const pattern of metaPatterns) {
      const candidate = normalizeImageUrl(html.match(pattern)?.[1], url);
      if (candidate) {
        return candidate;
      }
    }
    return normalizeImageUrl(extractImageFromHtml(html), url);
  } catch {
    return undefined;
  }
}

function normalizeRssSubscription(input: Partial<RSSSubscription> & { url: string }): RSSSubscription {
  const url = String(input.url || '').trim();
  const fallbackId = normalizeTopicKey(url || String(Date.now()));
  return {
    id: String(input.id || `rss-${fallbackId}`),
    title: String(input.title || url),
    url,
    siteUrl: input.siteUrl?.trim() || undefined,
    category: normalizeRssCategory(input.category),
    description: input.description?.trim() || undefined,
    coverImageUrl: input.coverImageUrl?.trim() || undefined,
    enabled: input.enabled !== false,
    lastFetchedAt: input.lastFetchedAt,
    lastError: input.lastError,
  };
}

function normalizeTopicKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[“”"'`【】（）()《》<>]/g, '')
    .replace(/\s+/g, '');
}

function decodeTrendUrl(url: string | undefined) {
  return (url || '').replace(/&amp;/g, '&').trim();
}

function normalizeTrendUrl(platformId: string, url?: string, mobileUrl?: string) {
  const primary = decodeTrendUrl(mobileUrl || url);
  if (!primary) {
    return undefined;
  }

  try {
    const parsed = new URL(primary);
    if (platformId === 'toutiao' && parsed.hostname.includes('toutiao.com') && !parsed.searchParams.has('log_from')) {
      parsed.searchParams.set('log_from', DEFAULT_TOUTIAO_LOG_FROM);
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return primary;
  }
}

async function listTrendTxtFiles(root: string) {
  const outputDir = path.join(root, 'output');
  const dayDirs = await fs.readdir(outputDir, { withFileTypes: true });
  const files: string[] = [];

  for (const dayDir of dayDirs) {
    if (!dayDir.isDirectory()) {
      continue;
    }
    const txtDir = path.join(outputDir, dayDir.name, 'txt');
    try {
      const txtFiles = await fs.readdir(txtDir, { withFileTypes: true });
      txtFiles
        .filter((entry) => entry.isFile() && entry.name.endsWith('.txt'))
        .forEach((entry) => files.push(path.join(txtDir, entry.name)));
    } catch {
      continue;
    }
  }

  const stats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath),
    }))
  );

  return stats.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs).map((item) => item.filePath);
}

function parseTrendText(content: string, filePath: string): ParsedTrendSnapshot {
  const lines = content.split(/\r?\n/);
  let platformId = '';
  let platformName = '';
  const items: ParsedTrendItem[] = [];
  const platformCounts = new Map<string, { id: string; name: string; itemCount: number }>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const platformMatch = line.match(/^([a-z0-9-]+)\s+\|\s+(.+)$/i);
    if (platformMatch) {
      platformId = platformMatch[1];
      platformName = platformMatch[2];
      if (!platformCounts.has(platformId)) {
        platformCounts.set(platformId, { id: platformId, name: platformName, itemCount: 0 });
      }
      continue;
    }

    const itemMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s+\[URL:(https?:\/\/[^\]]+)\])(?:\s+\[MOBILE:(https?:\/\/[^\]]+)\])?$/);
    if (itemMatch && platformId && platformName) {
      const record = {
        title: itemMatch[2],
        url: itemMatch[3],
        mobileUrl: itemMatch[4],
        rank: Number(itemMatch[1]),
        platformId,
        platformName,
      } satisfies ParsedTrendItem;
      items.push(record);
      const existing = platformCounts.get(platformId);
      if (existing) {
        existing.itemCount += 1;
      }
    }
  }

  return {
    label: path.basename(filePath, '.txt'),
    filePath,
    items,
    platformSummaries: Array.from(platformCounts.values()),
  };
}

function buildTrendTopicFromSnapshot(item: ParsedTrendItem, snapshotLabel: string): TrendTopic {
  return {
    id: `${item.platformId}-${normalizeTopicKey(item.title)}`,
    title: item.title,
    snapshotUrl: normalizeTrendUrl(item.platformId, item.url, item.mobileUrl),
    platformId: item.platformId,
    platformName: item.platformName,
    latestRank: item.rank,
    occurrences: 1,
    latestSnapshot: snapshotLabel,
    score: Math.max(1, 101 - item.rank),
    timeline: [
      {
        snapshot: snapshotLabel,
        platformName: item.platformName,
        rank: item.rank,
      },
    ],
  };
}

async function runProcess(command: string, args: string[], cwd = PROJECT_ROOT) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${command} 执行失败`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function runTrendRadarProcess(command: string, args: string[], cwd = DEFAULT_TRENDRADAR_ROOT) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        DOCKER_CONTAINER: 'true',
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || 'TrendRadar 采集失败。'));
        return;
      }
      resolve(`${stdout}\n${stderr}`.trim());
    });
  });
}

async function ensureSocialBridgePython() {
  if (process.env.PYTHON_PATH?.trim()) {
    return process.env.PYTHON_PATH.trim();
  }

  try {
    await fs.access(SOCIAL_BRIDGE_PYTHON);
    return SOCIAL_BRIDGE_PYTHON;
  } catch {
    await fs.mkdir(SOCIAL_BRIDGE_RUNTIME_ROOT, { recursive: true });
    const bootstrapPython = process.env.PYTHON_BOOTSTRAP || 'python';
    const xhsRequirements = path.join(DEFAULT_CV_CAT_ROOT, 'Spider_XHS', 'requirements.txt');
    const douyinRequirements = path.join(DEFAULT_CV_CAT_ROOT, 'DouYin_Spider', 'requirements.txt');
    const wechatRequirements = path.join(DEFAULT_WECHAT_SPIDER_ROOT, 'requirements.txt');

    await runProcess(bootstrapPython, ['-m', 'venv', SOCIAL_BRIDGE_VENV]);
    await runProcess(SOCIAL_BRIDGE_PYTHON, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    await runProcess(SOCIAL_BRIDGE_PYTHON, ['-m', 'pip', 'install', '-r', xhsRequirements, '-r', douyinRequirements, '-r', wechatRequirements]);
    return SOCIAL_BRIDGE_PYTHON;
  }
}

async function ensureNodeDependencies(projectRoot: string, requiredPackages: string[]) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  try {
    await fs.access(packageJsonPath);
  } catch {
    return;
  }

  const missingPackages: string[] = [];
  for (const packageName of requiredPackages) {
    try {
      await fs.access(path.join(projectRoot, 'node_modules', packageName));
    } catch {
      missingPackages.push(packageName);
    }
  }

  if (!missingPackages.length) {
    return;
  }

  const cacheKey = `${projectRoot}:${missingPackages.sort().join(',')}`;
  if (!ensuredNodeDeps.has(cacheKey)) {
    ensuredNodeDeps.set(
      cacheKey,
      runProcess(NPM_COMMAND, ['install', '--no-fund', '--no-audit'], projectRoot).then(() => undefined)
    );
  }

  await ensuredNodeDeps.get(cacheKey);
}

export async function openSocialLoginPage(provider: 'xhs' | 'douyin' | 'douyin-live' | 'wechat') {
  const urlMap = {
    xhs: 'https://www.xiaohongshu.com/explore',
    douyin: 'https://www.douyin.com/',
    'douyin-live': 'https://live.douyin.com/',
    wechat: 'https://mp.weixin.qq.com/',
  } as const;

  const url = urlMap[provider];
  if (process.platform === 'win32') {
    await runProcess('powershell', ['-NoProfile', '-Command', `Start-Process "${url}"`]);
  } else if (process.platform === 'darwin') {
    await runProcess('open', [url]);
  } else {
    await runProcess('xdg-open', [url]);
  }

  return { ok: true, provider, url };
}

export async function captureBrowserAuth(provider: 'xhs' | 'douyin' | 'douyin-live') {
  return capturePlatformAuth(provider);
}

export async function captureWechatAuth(settings?: SocialCrawlerSettings) {
  const scriptPath = path.join(PROJECT_ROOT, 'server', 'social_bridge.py');
  const python = settings?.pythonPath?.trim() || (await ensureSocialBridgePython());
  const wechatRoot = settings?.wechatRoot?.trim() || DEFAULT_WECHAT_SPIDER_ROOT;
  const wechatCacheFile = settings?.wechatCacheFile?.trim() || '';

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      python,
      [
        scriptPath,
        '--auth-provider',
        'wechat',
        '--wechat-root',
        wechatRoot,
        ...(wechatCacheFile ? ['--wechat-cache-file', wechatCacheFile] : []),
      ],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
        },
      }
    );

    let output = '';
    let error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !output.trim()) {
        reject(new Error(error || '公众号登录捕获失败'));
        return;
      }
      resolve(output);
    });
  });

  const jsonLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.startsWith('{') && line.endsWith('}'));

  if (!jsonLine) {
    throw new Error('公众号登录没有返回可解析结果。');
  }

  const payload = JSON.parse(jsonLine) as { error?: boolean; message?: string };
  if (payload.error) {
    throw new Error(payload.message || '公众号登录捕获失败。');
  }

  return payload;
}

export async function getTrendMonitorSettings(): Promise<TrendMonitorSettings> {
  const configPath = getTrendConfigPath();
  const raw = await fs.readFile(configPath, 'utf8');
  const document = parseDocument(raw);
  const root = (document.toJS() || {}) as Record<string, unknown>;

  const activeSources = parseTrendSourceList(root.platforms, true);
  const disabledSources = parseTrendSourceList(root.disabled_platforms, false);
  const merged = new Map<string, TrendMonitorSource>();

  for (const source of [...activeSources, ...disabledSources]) {
    merged.set(source.id, source);
  }

  return {
    configPath,
    sources: Array.from(merged.values()),
  };
}

export async function saveTrendMonitorSettings(settings: TrendMonitorSettings): Promise<TrendMonitorSettings> {
  const configPath = getTrendConfigPath();
  const raw = await fs.readFile(configPath, 'utf8');
  const document = parseDocument(raw);
  const deduped = new Map<string, TrendMonitorSource>();

  for (const source of settings.sources || []) {
    const normalized = normalizeTrendMonitorSource(source);
    if (normalized) {
      deduped.set(normalized.id, normalized);
    }
  }

  const sources = Array.from(deduped.values());
  const activeSources = sources.filter((source) => source.enabled).map(({ id, name }) => ({ id, name }));
  const disabledSources = sources.filter((source) => !source.enabled).map(({ id, name }) => ({ id, name }));

  document.set('platforms', activeSources);
  if (disabledSources.length > 0) {
    document.set('disabled_platforms', disabledSources);
  } else {
    document.delete('disabled_platforms');
  }

  await fs.writeFile(configPath, document.toString(), 'utf8');

  return {
    configPath,
    sources,
  };
}

export async function importRssSubscription(url: string, category: RSSSubscription['category'] = 'custom'): Promise<RSSImportResponse> {
  const feed = await rssParser.parseURL(url.trim());
  const subscription = normalizeRssSubscription({
    id: `rss-${normalizeTopicKey(url)}`,
    title: feed.title || url,
    url,
    siteUrl: feed.link || undefined,
    category,
    description: feed.description || undefined,
    coverImageUrl: pickFeedImage(feed),
    enabled: true,
  });

  return { subscription };
}

export async function fetchRandomAvatar() {
  const endpoint = process.env.RANDOM_AVATAR_API_URL || 'https://v2.xxapi.cn/api/head?return=json';
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`随机头像接口失败：${response.status} ${response.statusText}`);
  }

  const payload = await response.json().catch(() => null) as { code?: number; data?: string; msg?: string } | null;
  const avatarUrl = payload?.data?.trim();
  if (!avatarUrl || !/^https?:\/\//i.test(avatarUrl)) {
    throw new Error(payload?.msg || '随机头像接口没有返回有效图片地址。');
  }

  return {
    avatarUrl,
    source: endpoint,
  };
}

function pushUniqueCandidate(candidates: RssDiscoveryCandidate[], candidate: RssDiscoveryCandidate) {
  const url = candidate.url?.trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    return;
  }
  if (candidates.some((item) => item.url === url)) {
    return;
  }
  candidates.push({
    ...candidate,
    url,
  });
}

function expandCommonFeedUrls(candidate: RssDiscoveryCandidate) {
  const expanded: RssDiscoveryCandidate[] = [];
  if (!candidate.url) {
    return expanded;
  }

  pushUniqueCandidate(expanded, candidate);

  try {
    const parsed = new URL(candidate.siteUrl || candidate.url);
    const origin = parsed.origin;
    ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/index.xml'].forEach((suffix) => {
      pushUniqueCandidate(expanded, {
        ...candidate,
        url: `${origin}${suffix}`,
        siteUrl: candidate.siteUrl || origin,
      });
    });
  } catch {
    // Ignore malformed candidates generated by AI.
  }

  return expanded;
}

async function discoverAlternateFeedUrls(candidate: RssDiscoveryCandidate) {
  const discovered: RssDiscoveryCandidate[] = [];
  const pageUrl = candidate.siteUrl || candidate.url;
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) {
    return discovered;
  }

  try {
    const response = await fetch(pageUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return discovered;
    }
    const html = await response.text();
    const linkPattern = /<link\b[^>]*(?:type=["']application\/(?:rss|atom)\+xml["']|rel=["']alternate["'])[^>]*>/gi;
    const hrefPattern = /\bhref=["']([^"']+)["']/i;
    for (const match of html.matchAll(linkPattern)) {
      const href = match[0].match(hrefPattern)?.[1];
      if (!href) {
        continue;
      }
      try {
        pushUniqueCandidate(discovered, {
          ...candidate,
          url: new URL(href, pageUrl).toString(),
          siteUrl: pageUrl,
        });
      } catch {
        continue;
      }
    }
  } catch {
    return discovered;
  }

  return discovered;
}

async function collectAiRssCandidates(query: string, category: RSSSubscription['category'], profile?: AiProfile | null) {
  const prompt = `请根据关键词寻找可能有 RSS/Atom 订阅的高质量信息源。输出严格 JSON：{"candidates":[{"title":"源名称","url":"RSS 或 Atom 地址","siteUrl":"站点主页","description":"一句话说明"}]}\n\n关键词：${query}\n分类：${category}\n\n要求：\n1. 返回 8-12 个候选，优先真实存在且长期维护的 RSS/Atom。\n2. 可以包含英文源和中文源，但必须和关键词相关。\n3. url 优先给 RSS/Atom 地址；如果不确定，url 可填站点主页，系统会自动尝试发现 feed。\n4. 不要输出 Markdown，不要解释。`;
  const text = await callAnthropicForRssDiscovery(profile, prompt);
  if (!text) {
    return [];
  }
  const parsed = extractJsonObject<{ candidates?: RssDiscoveryCandidate[] }>(text);
  return Array.isArray(parsed.candidates) ? parsed.candidates : [];
}

async function collectTavilyRssCandidates(query: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const response = await fetch(process.env.TAVILY_API_URL || 'https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} RSS feed OR Atom feed`,
        max_results: 8,
        search_depth: 'basic',
      }),
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (payload.results || []).map((result) => ({
      title: result.title,
      url: result.url,
      siteUrl: result.url,
      description: result.content?.slice(0, 140),
    }));
  } catch {
    return [];
  }
}

async function collectSearchPageRssCandidates(query: string) {
  const candidates: RssDiscoveryCandidate[] = [];
  const searchUrls = [
    `https://www.bing.com/search?q=${encodeURIComponent(`${query} RSS feed`)}`,
    `https://duckduckgo.com/html/?q=${encodeURIComponent(`${query} RSS feed`)}`,
  ];

  for (const searchUrl of searchUrls) {
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          accept: 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      const linkPattern = /\bhref=["'](https?:\/\/[^"']+)["']/gi;
      for (const match of html.matchAll(linkPattern)) {
        const rawUrl = match[1]
          .replace(/&amp;/g, '&')
          .replace(/^https?:\/\/www\.bing\.com\/ck\/a\?.*?&u=([^&]+).*$/i, (_, encoded: string) => {
            try {
              return Buffer.from(decodeURIComponent(encoded).replace(/^a1/i, ''), 'base64').toString('utf8');
            } catch {
              return '';
            }
          });
        if (!rawUrl || /bing\.com|duckduckgo\.com|microsoft\.com/.test(rawUrl)) {
          continue;
        }
        pushUniqueCandidate(candidates, {
          title: query,
          url: rawUrl,
          siteUrl: rawUrl,
          description: `搜索发现：${query}`,
        });
        if (candidates.length >= 10) {
          return candidates;
        }
      }
    } catch {
      continue;
    }
  }

  return candidates;
}

export async function discoverRssSubscriptions(
  query: string,
  category: RSSSubscription['category'] = 'custom',
  profile?: AiProfile | null
): Promise<RSSDiscoveryResponse> {
  const keyword = query.trim();
  if (!keyword) {
    throw new Error('请输入关键词。');
  }

  const baseCandidates: RssDiscoveryCandidate[] = [];
  const aiCandidates = await collectAiRssCandidates(keyword, category, profile);
  const tavilyCandidates = await collectTavilyRssCandidates(keyword);
  const searchCandidates = await collectSearchPageRssCandidates(keyword);
  const seedCandidates = [
    ...(RSS_DISCOVERY_SEEDS[category] || []),
    ...(category === 'custom' ? [] : RSS_DISCOVERY_SEEDS.custom),
  ];
  [...aiCandidates, ...tavilyCandidates, ...searchCandidates, ...seedCandidates].forEach((candidate) =>
    pushUniqueCandidate(baseCandidates, candidate)
  );

  if (!baseCandidates.length) {
    throw new Error('没有拿到候选 RSS 源。请换一个更具体的关键词。');
  }

  const expandedCandidates: RssDiscoveryCandidate[] = [];
  baseCandidates.slice(0, 14).forEach((candidate) => {
    expandCommonFeedUrls(candidate).forEach((expanded) => pushUniqueCandidate(expandedCandidates, expanded));
  });

  const alternateCandidates = await Promise.allSettled(
    baseCandidates.slice(0, 8).map((candidate) => discoverAlternateFeedUrls(candidate))
  );
  alternateCandidates.forEach((result) => {
    if (result.status === 'fulfilled') {
      result.value.forEach((candidate) => pushUniqueCandidate(expandedCandidates, candidate));
    }
  });

  const accepted = new Map<string, RSSSubscription>();
  const rejected: RSSDiscoveryResponse['rejected'] = [];
  const candidatesToValidate = expandedCandidates.slice(0, 40);

  for (const candidate of candidatesToValidate) {
    if (!candidate.url || accepted.has(candidate.url)) {
      continue;
    }
    try {
      const imported = await importRssSubscription(candidate.url, category);
      accepted.set(imported.subscription.url, {
        ...imported.subscription,
        title: imported.subscription.title || candidate.title || candidate.url,
        description: imported.subscription.description || candidate.description,
      });
      if (accepted.size >= 8) {
        break;
      }
    } catch (error) {
      rejected.push({
        url: candidate.url,
        reason: error instanceof Error ? error.message : '不可用',
      });
    }
  }

  return {
    query: keyword,
    category,
    subscriptions: Array.from(accepted.values()),
    rejected: rejected.slice(0, 12),
    message: accepted.size
      ? `找到 ${accepted.size} 个可用 RSS 源。`
      : `没有验证通过的 RSS 源，已排除 ${rejected.length} 个候选。`,
  };
}

export async function fetchRssFeeds(subscriptions: RSSSubscription[], perFeedLimit = 4): Promise<RSSFeedsResponse> {
  const enabledSubscriptions = subscriptions
    .map((subscription) => normalizeRssSubscription(subscription))
    .filter((subscription) => subscription.enabled && subscription.url);

  const settled = await Promise.allSettled(
    enabledSubscriptions.map(async (subscription) => {
      const feed = await rssParser.parseURL(subscription.url);
      const feedImage = pickFeedImage(feed);
      const nextSubscription: RSSSubscription = {
        ...subscription,
        title: feed.title || subscription.title,
        siteUrl: feed.link || subscription.siteUrl,
        description: feed.description || subscription.description,
        coverImageUrl: subscription.coverImageUrl || feedImage,
        lastFetchedAt: new Date().toISOString(),
        lastError: undefined,
      };

      const items: RSSFeedItem[] = (await Promise.all(
        (feed.items || []).slice(0, Math.max(1, perFeedLimit)).map(async (item, index) => {
          const itemUrl = item.link || item.guid || `${subscription.url}#${index}`;
          const itemImage = pickItemImage(item, itemUrl) || await fetchArticleImage(itemUrl);
          return {
            id: `${subscription.id}-${normalizeTopicKey(item.guid || itemUrl || item.title || String(index))}`,
            subscriptionId: subscription.id,
            subscriptionTitle: nextSubscription.title,
            subscriptionCategory: nextSubscription.category,
            title: item.title || '未命名条目',
            url: itemUrl,
            excerpt: stripHtml(item.contentSnippet || item.contentEncoded || item.content).slice(0, 220),
            publishedAt: item.isoDate || item.pubDate || undefined,
            coverImageUrl: itemImage,
            sourceSiteUrl: nextSubscription.siteUrl,
          };
        })
      )).filter((item) => Boolean(item.url));

      return { subscription: nextSubscription, items };
    })
  );

  const subscriptionMap = new Map(subscriptions.map((subscription) => [subscription.id, normalizeRssSubscription(subscription)]));
  const items: RSSFeedItem[] = [];

  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const sourceSubscription = enabledSubscriptions[index];
    if (result.status === 'fulfilled') {
      subscriptionMap.set(result.value.subscription.id, result.value.subscription);
      items.push(...result.value.items);
    } else {
      subscriptionMap.set(sourceSubscription.id, {
        ...sourceSubscription,
        lastFetchedAt: new Date().toISOString(),
        lastError: result.reason instanceof Error ? result.reason.message : 'RSS 抓取失败。',
      });
    }
  }

  return {
    subscriptions: subscriptions.map((subscription) => subscriptionMap.get(subscription.id) || normalizeRssSubscription(subscription)),
    items: items.sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    }),
    fetchedAt: new Date().toISOString(),
  };
}

export async function getTrendOverview(limit = 24): Promise<TrendOverviewResponse> {
  const txtFiles = await listTrendTxtFiles(DEFAULT_TRENDRADAR_ROOT);
  if (!txtFiles.length) {
    throw new Error('TrendRadar output 目录中没有可用的热点快照。');
  }

  const latestFile = txtFiles[0];
  const latestSnapshot = parseTrendText(await fs.readFile(latestFile, 'utf8'), latestFile);
  const recentSnapshots = await Promise.all(
    txtFiles.slice(0, 6).map(async (filePath) => parseTrendText(await fs.readFile(filePath, 'utf8'), filePath))
  );

  const topicMap = new Map<string, TrendTopic>();
  for (const snapshot of recentSnapshots) {
    for (const item of snapshot.items) {
      const key = `${item.platformId}:${normalizeTopicKey(item.title)}`;
      const existing = topicMap.get(key);
      if (!existing) {
        topicMap.set(key, buildTrendTopicFromSnapshot(item, snapshot.label));
        continue;
      }

      existing.occurrences += 1;
      existing.score += Math.max(1, 101 - item.rank);
      if (snapshot.filePath === latestFile || item.rank < existing.latestRank) {
        existing.latestRank = item.rank;
        existing.latestSnapshot = snapshot.label;
        existing.snapshotUrl = normalizeTrendUrl(item.platformId, item.url, item.mobileUrl) || existing.snapshotUrl;
      }
      existing.timeline.push({
        snapshot: snapshot.label,
        platformName: item.platformName,
        rank: item.rank,
      });
    }
  }

  const latestItems = latestSnapshot.items.map((item) => buildTrendTopicFromSnapshot(item, latestSnapshot.label));
  const trackedTopics = Array.from(topicMap.values())
    .map((topic) => ({
      ...topic,
      timeline: topic.timeline.sort((left, right) => left.snapshot.localeCompare(right.snapshot)),
    }))
    .sort((left, right) => {
      if (right.occurrences !== left.occurrences) {
        return right.occurrences - left.occurrences;
      }
      return right.score - left.score;
    })
    .slice(0, limit);

  return {
    sourceFile: latestFile,
    snapshotLabel: latestSnapshot.label,
    generatedAt: new Date().toISOString(),
    platformSummaries: latestSnapshot.platformSummaries,
    latestItems,
    trackedTopics,
  };
}

export async function refreshTrendRadarOverview(limit = 24): Promise<TrendRefreshResponse> {
  let python = process.env.TRENDRADAR_PYTHON || TREND_RADAR_PYTHON;
  try {
    await fs.access(python);
  } catch {
    python = process.env.PYTHON_BOOTSTRAP || 'python';
  }

  const stdout = await runTrendRadarProcess(python, ['main.py'], DEFAULT_TRENDRADAR_ROOT);
  const overview = await getTrendOverview(limit);
  const stdoutLines = stdout.split(/\r?\n/).filter(Boolean);

  return {
    overview,
    message: `TrendRadar 已重新采集，当前快照：${overview.snapshotLabel}。`,
    stdoutTail: stdoutLines.slice(-12).join('\n'),
  };
}

export async function crawlSocialProvider(
  provider: 'xhs' | 'douyin' | 'wechat',
  query: string,
  limit = 6,
  settings?: SocialCrawlerSettings,
  options?: SocialCrawlOptions
): Promise<SocialCrawlResponse> {
  const scriptPath = path.join(PROJECT_ROOT, 'server', 'social_bridge.py');
  const python = settings?.pythonPath?.trim() || (await ensureSocialBridgePython());
  const xhsRoot = settings?.xhsRoot?.trim() || path.join(DEFAULT_CV_CAT_ROOT, 'Spider_XHS');
  const douyinRoot = settings?.douyinRoot?.trim() || path.join(DEFAULT_CV_CAT_ROOT, 'DouYin_Spider');
  const wechatRoot = settings?.wechatRoot?.trim() || DEFAULT_WECHAT_SPIDER_ROOT;
  const xhsCookies = settings?.xhsCookies?.trim() || '';
  const douyinCookies = settings?.douyinCookies?.trim() || '';
  const douyinLiveCookies = settings?.douyinLiveCookies?.trim() || '';
  const wechatToken = settings?.wechatToken?.trim() || '';
  const wechatCookieString = settings?.wechatCookieString?.trim() || '';
  const wechatCacheFile = settings?.wechatCacheFile?.trim() || path.join(wechatRoot, 'wechat_cache.json');
  const wechatMaxPages = String(Math.max(1, Math.min(10, Number(settings?.wechatMaxPages || 2))));
  const wechatRequestIntervalSeconds = String(Math.max(2, Math.min(120, Number(settings?.wechatRequestIntervalSeconds || 8))));

  if (provider === 'xhs') {
    await ensureNodeDependencies(xhsRoot, ['crypto-js', 'jsdom']);
  }
  if (provider === 'douyin') {
    await ensureNodeDependencies(douyinRoot, ['canvas', 'jsdom', 'jsrsasign', 'sdenv']);
  }

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      python,
      [
        scriptPath,
        '--provider',
        provider,
        '--query',
        query,
        '--limit',
        String(limit),
        '--xhs-root',
        xhsRoot,
        '--douyin-root',
        douyinRoot,
        '--wechat-root',
        wechatRoot,
        '--options-json',
        JSON.stringify(options || {}),
      ],
      {
        cwd: PROJECT_ROOT,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          SOCIAL_BRIDGE_XHS_COOKIES: xhsCookies,
          DY_COOKIES: douyinCookies,
          DY_LIVE_COOKIES: douyinLiveCookies,
          SOCIAL_BRIDGE_WECHAT_TOKEN: wechatToken,
          SOCIAL_BRIDGE_WECHAT_COOKIE: wechatCookieString,
          SOCIAL_BRIDGE_WECHAT_CACHE_FILE: wechatCacheFile,
          SOCIAL_BRIDGE_WECHAT_MAX_PAGES: wechatMaxPages,
          SOCIAL_BRIDGE_WECHAT_REQUEST_INTERVAL: wechatRequestIntervalSeconds,
        },
      }
    );

    let output = '';
    let error = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !output.trim()) {
        reject(new Error(error || `${provider} 爬虫桥接失败`));
        return;
      }
      resolve(output);
    });
  });

  const jsonLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.startsWith('{') && line.endsWith('}'));

  if (!jsonLine) {
    throw new Error(`${provider} 爬虫桥接没有返回可解析结果。`);
  }

  const payload = JSON.parse(jsonLine) as SocialCrawlResponse & { error?: boolean };
  if ((payload as { error?: boolean }).error) {
    throw new Error(payload.message || `${provider} 爬虫桥接失败。`);
  }

  return payload;
}
