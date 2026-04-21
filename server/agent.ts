import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import type {
  AiProfile,
  Analysis,
  AnalysisMetrics,
  DehydrateRequest,
  DehydrateResponse,
  HydrationReport,
  HydrationSnapshot,
  SocialCrawlerSettings,
  SourceEstimateResponse,
} from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_CRAWL4AI_ROOT = 'F:\\Projects\\crawl4ai-local';
const PROJECT_CRAWL4AI_ROOT = path.join(PROJECT_ROOT, '.runtime', 'crawl4ai');
const KNOWLEDGE_DB_PATH = process.env.KNOWLEDGE_DB_PATH || path.join(PROJECT_ROOT, 'data', 'knowledge-base.sqlite');
const LEGACY_KNOWLEDGE_BASE_PATH = process.env.KNOWLEDGE_BASE_PATH || path.join(PROJECT_ROOT, 'data', 'knowledge-base.jsonl');
const EMBEDDING_CACHE_DIR = path.join(PROJECT_ROOT, '.runtime', 'hf-cache');
const DEFAULT_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DEFAULT_EMBEDDING_DTYPE = process.env.EMBEDDING_DTYPE || 'q8';
const DEFAULT_RERANKER_MODEL = process.env.RERANKER_MODEL || 'Xenova/bge-reranker-base';
const DEFAULT_RERANKER_DTYPE = process.env.RERANKER_DTYPE || 'q8';
const EMBEDDING_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 8000);
const SOURCE_CACHE_TTL_MS = Number(process.env.SOURCE_CACHE_TTL_MS || 5 * 60 * 1000);
const DEFAULT_WECHAT_CACHE_FILE = process.env.WECHAT_CACHE_FILE || 'F:\\Projects\\公众号文章爬虫\\wechat_spider\\wechat_spider\\wechat_cache.json';

type FetchMethod = DehydrateResponse['meta']['fetchMethod'];

interface SourceDocument {
  url: string;
  title: string;
  markdown: string;
  excerpt: string;
  fetchMethod: FetchMethod;
  sourceType: Analysis['type'];
  coverImageUrl?: string;
  logoUrl?: string;
}

interface ChunkDigest {
  section: string;
  bullets: string[];
  facts: string[];
}

interface FinalDigest {
  title: string;
  tags: string[];
  summaryMarkdown: string;
  keyClaims: string[];
  diagramMermaid?: string;
  diagramCaption?: string;
  visualSynthesis: Analysis['visualSynthesis'];
}

interface StructureDiagramSpec {
  nodes?: Array<{ id?: string; label?: string; type?: 'section' | 'claim' | 'evidence' | 'turn' | 'result' }>;
  edges?: Array<{ from?: string; to?: string; label?: string }>;
  caption?: string;
}

interface KnowledgeBaseEntry {
  id?: string;
  title?: string;
  source?: string;
  sourceUrl?: string;
  createdAt?: string;
  tags?: string[];
  content?: string;
  chunks?: string[];
}

interface KnowledgeHit {
  title: string;
  source: string;
  score: number;
  snippet: string;
  tags: string[];
}

interface VectorIndexEntry {
  key: string;
  vector: number[];
  updatedAt: string;
  title: string;
}

interface AgentPlanStep {
  tool: 'retrieve_knowledge' | 'summarize_source' | 'verify_web' | 'store_knowledge';
  reason: string;
}

interface AgentPlan {
  mode: 'agentic-rag';
  retrievalQuery: string;
  verificationQuery: string;
  steps: AgentPlanStep[];
}

interface AgentTraceItem {
  tool: string;
  status: 'planned' | 'completed' | 'skipped' | 'failed';
  reason: string;
}

const sourceDocumentCache = new Map<string, { source: SourceDocument; expiresAt: number }>();
const HYDRATION_FILLER_PATTERNS = [
  /需要注意的是/gu,
  /值得一提的是/gu,
  /总的来说/gu,
  /总而言之/gu,
  /换句话说/gu,
  /简单来说/gu,
  /某种程度上/gu,
  /我们可以看到/gu,
  /不难发现/gu,
  /显而易见/gu,
  /本质上/gu,
  /事实上/gu,
  /说白了/gu,
  /in other words/gi,
  /it is worth noting/gi,
  /generally speaking/gi,
  /overall/gi,
  /in summary/gi,
  /basically/gi,
];

function getAnthropicConfig(profile?: AiProfile | null) {
  return {
    baseUrl: (profile?.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, ''),
    apiKey: profile?.apiKey || process.env.ANTHROPIC_API_KEY || '',
    model: profile?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
    authMode: process.env.ANTHROPIC_AUTH_MODE || 'x-api-key',
  };
}

function getFirecrawlConfig(profile?: AiProfile | null) {
  return {
    baseUrl: (profile?.firecrawlBaseUrl || process.env.FIRECRAWL_BASE_URL || 'https://api.firecrawl.dev').replace(/\/$/, ''),
    apiKey: profile?.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || '',
  };
}

function inferTypeFromUrl(url: string): Analysis['type'] {
  const value = url.toLowerCase();
  if (/(youtube|youtu\.be|bilibili|vimeo)/.test(value)) {
    return 'video';
  }
  if (/\.(pdf|epub|mobi|txt)$/i.test(value) || /(arxiv|ssrn|paper|ebook)/.test(value)) {
    return 'book';
  }
  if (/(medium|substack|newsletter|article|blog)/.test(value)) {
    return 'article';
  }
  return 'web';
}

function isWeChatArticleUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'mp.weixin.qq.com' || parsed.hostname.endsWith('.mp.weixin.qq.com');
  } catch {
    return false;
  }
}

function resolveAssetUrl(baseUrl: string, candidate?: string | null) {
  if (!candidate) {
    return undefined;
  }

  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function extractDocumentArtwork(document: Document, url: string) {
  const meta = (selector: string) =>
    document.querySelector(selector)?.getAttribute('content')?.trim() ||
    document.querySelector(selector)?.getAttribute('href')?.trim() ||
    '';

  const ogImage =
    meta('meta[property="og:image"]') ||
    meta('meta[name="twitter:image"]') ||
    document.querySelector('article img, main img, img')?.getAttribute('src')?.trim() ||
    '';
  const favicon =
    meta('link[rel="icon"]') ||
    meta('link[rel="shortcut icon"]') ||
    meta('link[rel="apple-touch-icon"]') ||
    '';

  return {
    coverImageUrl: resolveAssetUrl(url, ogImage),
    logoUrl: resolveAssetUrl(url, favicon) || resolveAssetUrl(url, ogImage),
  };
}

function stripMarkdownNoise(markdown: string) {
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[[^\]]+\]\((javascript:[^)]+)\)/gi, '')
    .trim();
}

function tokenize(text: string) {
  const normalized = text.toLowerCase();
  const latin = normalized.match(/[a-z0-9]{3,}/g) || [];
  const chinesePhrases = normalized.match(/[\p{Script=Han}]{2,}/gu) || [];
  const chineseBigrams = chinesePhrases.flatMap((phrase) => {
    if (phrase.length <= 2) {
      return [phrase];
    }
    const terms: string[] = [phrase];
    for (let index = 0; index < phrase.length - 1; index += 1) {
      terms.push(phrase.slice(index, index + 2));
    }
    return terms;
  });

  return Array.from(new Set([...latin, ...chineseBigrams]));
}

function deriveQueryFromSource(source: SourceDocument) {
  return [source.title, source.excerpt, source.sourceType].filter(Boolean).join(' ');
}

function getKnowledgeEntryText(entry: KnowledgeBaseEntry) {
  return [
    entry.title || '',
    (entry.tags || []).join(' '),
    entry.content || '',
    (entry.chunks || []).join('\n'),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function getKnowledgeEntryKey(entry: KnowledgeBaseEntry) {
  if (entry.id) {
    return entry.id;
  }
  const hash = crypto
    .createHash('sha1')
    .update(`${entry.id || ''}\n${entry.title || ''}\n${getKnowledgeEntryText(entry)}`)
    .digest('hex');
  return hash;
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} 超时`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildSourceCacheKey(url: string, profile?: AiProfile | null, methodHint = '') {
  return `${methodHint || profile?.fetchProvider || 'crawl4ai'}::${url.trim()}`;
}

function readCachedSourceDocument(url: string, profile?: AiProfile | null, methodHint = '') {
  const key = buildSourceCacheKey(url, profile, methodHint);
  const cached = sourceDocumentCache.get(key);
  if (!cached) {
    return null;
  }
  if (cached.expiresAt <= Date.now()) {
    sourceDocumentCache.delete(key);
    return null;
  }
  return cached.source;
}

function writeCachedSourceDocument(source: SourceDocument, profile?: AiProfile | null, methodHint = '') {
  const key = buildSourceCacheKey(source.url, profile, methodHint);
  sourceDocumentCache.set(key, {
    source,
    expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
  });
}

function getSentenceUnits(text: string) {
  return text
    .split(/[。！？!?；;\n]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getHydrationTokens(text: string) {
  const normalized = text.toLowerCase();
  const latin = normalized.match(/[a-z0-9]{2,}/g) || [];
  const hanSegments = normalized.match(/[\p{Script=Han}]{2,}/gu) || [];
  const hanBigrams = hanSegments.flatMap((segment) => {
    if (segment.length <= 2) {
      return [segment];
    }
    return Array.from({ length: segment.length - 1 }, (_, index) => segment.slice(index, index + 2));
  });

  return [...latin, ...hanBigrams];
}

function estimateHydration(markdown: string): HydrationSnapshot {
  const normalized = markdown.replace(/\r/g, '').trim();
  const compact = normalized.replace(/\s+/g, '');
  const totalChars = Math.max(1, compact.length);
  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((part) => part.replace(/^#+\s*/gm, '').trim())
    .filter(Boolean);
  const sentences = getSentenceUnits(normalized);
  const tokens = getHydrationTokens(normalized);
  const uniqueRatio = tokens.length ? new Set(tokens).size / tokens.length : 0.72;
  const repeatedSentenceRatio = sentences.length
    ? 1 - new Set(sentences.map((sentence) => sentence.toLowerCase())).size / sentences.length
    : 0;
  const headingCount = (normalized.match(/^#{1,6}\s+/gm) || []).length;
  const bulletCount = (normalized.match(/^(?:\s*[-*+]|\s*\d+\.)\s+/gm) || []).length;
  const markdownLinkCount = (normalized.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const digitsCount = (compact.match(/\d/g) || []).length;
  const punctuationCount = (compact.match(/[，。！？；：,.!?;:、]/g) || []).length;
  const fillerHits = HYDRATION_FILLER_PATTERNS.reduce((count, pattern) => count + (normalized.match(pattern)?.length || 0), 0);
  const shortParagraphRatio = paragraphs.length
    ? paragraphs.filter((paragraph) => paragraph.replace(/\s+/g, '').length < 42).length / paragraphs.length
    : 0;
  const averageSentenceLength = totalChars / Math.max(1, sentences.length);
  const repetitionScore = clamp((1 - uniqueRatio) * 1.35 + repeatedSentenceRatio * 0.35, 0, 1);
  const verbosityScore = clamp((averageSentenceLength - 34) / 56, 0, 1);
  const fillerScore = clamp(fillerHits / Math.max(1, sentences.length * 0.24), 0, 1);
  const noiseScore = clamp((markdownLinkCount * 16 + punctuationCount * 0.3) / totalChars, 0, 1);
  const structureCredit = clamp((headingCount * 1.3 + bulletCount) / Math.max(1, paragraphs.length * 2.4), 0, 1);
  const dataCredit = clamp(digitsCount / Math.max(1, totalChars * 0.04), 0, 1);
  const waterScore = clamp(
    0.2
      + repetitionScore * 0.28
      + verbosityScore * 0.18
      + fillerScore * 0.24
      + shortParagraphRatio * 0.08
      + noiseScore * 0.12
      - structureCredit * 0.16
      - dataCredit * 0.08,
    0.06,
    0.92
  );
  const waterPercent = Math.round(waterScore * 100);
  const signalPercent = 100 - waterPercent;
  const densityScore = Math.round((1 - waterScore) * 100);
  const estimatedWaterChars = Math.round(totalChars * waterScore);
  const estimatedSignalChars = Math.max(0, totalChars - estimatedWaterChars);

  return {
    waterPercent,
    signalPercent,
    estimatedWaterChars,
    estimatedSignalChars,
    totalChars,
    densityScore,
    label:
      waterPercent >= 70
        ? '高含水'
        : waterPercent >= 50
          ? '偏湿'
          : waterPercent >= 30
            ? '可脱水'
            : '高密度',
  };
}

function buildHydrationReport(sourceMarkdown: string, summaryMarkdown: string): HydrationReport {
  const before = estimateHydration(sourceMarkdown);
  const after = estimateHydration(summaryMarkdown);
  const compressionRatio = clamp(after.totalChars / Math.max(1, before.totalChars), 0, 1);

  return {
    before,
    after,
    waterDropPercent: Math.max(0, before.waterPercent - after.waterPercent),
    compressionPercent: Math.max(0, Math.round((1 - compressionRatio) * 100)),
    compressionRatio,
  };
}

function splitIntoChunks(markdown: string, maxChars = 2200) {
  const paragraphs = markdown
    .split(/\n(?=#|\* |-|\d+\.)|\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      for (let index = 0; index < paragraph.length; index += maxChars) {
        chunks.push(paragraph.slice(index, index + maxChars));
      }
      continue;
    }

    if ((current + '\n\n' + paragraph).trim().length > maxChars) {
      if (current) {
        chunks.push(current.trim());
      }
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : [markdown];
}

function estimateReadTime(markdown: string, type: Analysis['type']) {
  const minutes = Math.max(1, Math.round(estimateReadingMinutes(markdown)));
  if (type === 'video') {
    return `估算内容约 ${minutes} 分钟`;
  }
  if (type === 'book') {
    return `估算原文约 ${minutes} 分钟`;
  }
  return `阅读约 ${minutes} 分钟`;
}

function estimateReadingMinutes(markdown: string) {
  const normalized = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const hanChars = (normalized.match(/\p{Script=Han}/gu) || []).length;
  const latinWords = (normalized.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const minuteEstimate = hanChars / 320 + latinWords / 220;
  return Math.max(0.25, Number(minuteEstimate.toFixed(2)));
}

function buildAnalysisMetrics(sourceMarkdown: string, summaryMarkdown: string, keyClaims: string[]): AnalysisMetrics {
  const sourceReadMinutes = estimateReadingMinutes(sourceMarkdown);
  const summaryReadMinutes = estimateReadingMinutes(summaryMarkdown);
  const timeSavedMinutes = Math.max(0, Number((sourceReadMinutes - summaryReadMinutes).toFixed(2)));

  return {
    sourceReadMinutes,
    summaryReadMinutes,
    timeSavedMinutes,
    keyInsights: keyClaims.length,
  };
}

function normalizeDehydrationLevel(value: number | undefined) {
  return clamp(Math.round(value ?? 60), 0, 100);
}

function getDehydrationPreset(level: number) {
  const normalized = normalizeDehydrationLevel(level);

  if (normalized >= 85) {
    return {
      normalized,
      title: '极限脱水',
      targetChars: '180-280',
      coreBullets: '1-2',
      structureBullets: '1-2',
      actionBullets: '0-1',
      keyClaims: '2-3',
      fallbackSections: 2,
      fallbackBulletLength: 88,
    };
  }

  if (normalized >= 65) {
    return {
      normalized,
      title: '高强脱水',
      targetChars: '280-480',
      coreBullets: '2-3',
      structureBullets: '2-3',
      actionBullets: '0-2',
      keyClaims: '3-4',
      fallbackSections: 3,
      fallbackBulletLength: 108,
    };
  }

  if (normalized >= 35) {
    return {
      normalized,
      title: '平衡脱水',
      targetChars: '480-820',
      coreBullets: '3-4',
      structureBullets: '3-4',
      actionBullets: '1-2',
      keyClaims: '3-5',
      fallbackSections: 4,
      fallbackBulletLength: 126,
    };
  }

  return {
    normalized,
    title: '轻度脱水',
    targetChars: '820-1400',
    coreBullets: '4-6',
    structureBullets: '4-6',
    actionBullets: '1-3',
    keyClaims: '4-6',
    fallbackSections: 5,
    fallbackBulletLength: 156,
  };
}

function buildFallbackDigest(source: SourceDocument, chunks: string[], dehydrationLevel = 60): FinalDigest {
  const preset = getDehydrationPreset(dehydrationLevel);
  const bullets = chunks
    .slice(0, preset.fallbackSections)
    .map((chunk) => chunk.replace(/\s+/g, ' ').slice(0, preset.fallbackBulletLength))
    .filter(Boolean);

  return {
    title: source.title,
    tags: [source.sourceType === 'video' ? '视频' : source.sourceType === 'book' ? '文档' : '网页', '自动脱水'],
    summaryMarkdown: `# 核心摘要\n\n${bullets.map((bullet) => `- ${bullet}`).join('\n')}\n\n# 结构拆解\n\n- 依据正文顺序提取了前 ${bullets.length} 个高密度片段。\n\n# 行动项\n\n- 无`,
    keyClaims: bullets,
    visualSynthesis: [
      { prompt: '结构主线', description: '用图示表示内容的主线结构与章节递进关系。', imageUrl: '' },
      { prompt: '概念节点', description: '突出文中最重要的概念、实体与相互关系。', imageUrl: '' },
    ],
  };
}

function sanitizeNodeLabel(input: string) {
  return input
    .replace(/\\[nr]/g, ' ')
    .replace(/[`]+/g, ' ')
    .replace(/["'<>[\]{}()（）]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 28) || '节点';
}

function buildFallbackDiagram(title: string, chunks: string[]) {
  const labels = [
    sanitizeNodeLabel(title),
    ...chunks.slice(0, 4).map((chunk) => {
      const line = chunk
        .split(/\n/)
        .map((part) => part.replace(/^#+\s*/, '').trim())
        .find(Boolean) || chunk;
      return sanitizeNodeLabel(line);
    }),
  ];

  const lines = ['flowchart TD', `A["${labels[0]}"]`];
  labels.slice(1).forEach((label, index) => {
    const nodeId = `N${index + 1}`;
    lines.push(`${nodeId}["${label}"]`);
    lines.push(index === 0 ? `A --> ${nodeId}` : `N${index} --> ${nodeId}`);
  });
  return lines.join('\n');
}

function safeNodeId(input: string, index: number) {
  const cleaned = input.replace(/[^A-Za-z0-9_]/g, '').trim();
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(cleaned)) {
    return cleaned.slice(0, 18);
  }
  return `N${index + 1}`;
}

function buildMermaidFromSpec(spec: StructureDiagramSpec, fallback: string) {
  const rawNodes = Array.isArray(spec.nodes) ? spec.nodes.slice(0, 8) : [];
  const rawEdges = Array.isArray(spec.edges) ? spec.edges.slice(0, 12) : [];
  const usedIds = new Set<string>();
  const nodes = rawNodes
    .map((node, index) => {
      const originalId = String(node.id || `node_${index + 1}`);
      let id = safeNodeId(originalId, index);
      if (usedIds.has(id)) {
        id = `N${index + 1}`;
      }
      usedIds.add(id);
      return {
        originalId,
        id,
        label: sanitizeNodeLabel(String(node.label || `节点 ${index + 1}`)),
      };
    })
    .filter((node) => node.label);

  if (nodes.length < 2) {
    return fallback;
  }

  const idMap = new Map<string, string>();
  nodes.forEach((node) => {
    idMap.set(node.originalId, node.id);
    idMap.set(node.id, node.id);
  });

  const lines = ['flowchart TD'];
  nodes.forEach((node) => {
    lines.push(`${node.id}["${node.label}"]`);
  });

  let edgeCount = 0;
  rawEdges.forEach((edge) => {
    const from = idMap.get(String(edge.from || ''));
    const to = idMap.get(String(edge.to || ''));
    if (!from || !to || from === to) {
      return;
    }
    const label = sanitizeNodeLabel(String(edge.label || '')).replace(/^节点$/, '');
    lines.push(label ? `${from} -->|${label}| ${to}` : `${from} --> ${to}`);
    edgeCount += 1;
  });

  if (edgeCount === 0) {
    nodes.slice(1).forEach((node, index) => {
      lines.push(`${nodes[index].id} --> ${node.id}`);
    });
  }

  return lines.join('\n');
}

function sanitizeSummary(summaryMarkdown: string) {
  return summaryMarkdown
    .replace(/当前未连接大模型[^\n]*/g, '')
    .replace(/返回的是基于抓取正文生成的保底脱水结果[^\n]*/g, '')
    .replace(/建议配置 Anthropic 兼容接口后再生成正式摘要[^\n]*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeMermaid(raw: string, fallback: string) {
  const fenced = raw.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || raw)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!candidate.startsWith('flowchart') && !candidate.startsWith('graph')) {
    return fallback;
  }

  const lines = candidate.split('\n');
  const firstLine = lines[0].replace(/^graph\b/i, 'flowchart').replace(/\b(LR|RL|BT)\b/i, 'TD');
  const normalizedLines = [firstLine.startsWith('flowchart') ? firstLine : 'flowchart TD'];
  let edgeCount = 0;
  const seenNodeLines = new Set<string>();

  const normalizeNodeLabel = (label: string) =>
    sanitizeNodeLabel(label)
      .replace(/[|]/g, ' ')
      .slice(0, 34);

  const quoteNodeLabel = (line: string) =>
    line
      .replace(/\b([A-Za-z][\w-]*)\s*\[\s*"?([^\]"]+)"?\s*\]/g, (_match, id: string, label: string) => {
        return `${id}["${normalizeNodeLabel(label)}"]`;
      })
      .replace(/\b([A-Za-z][\w-]*)\s*\(\s*"?([^()"]+)"?\s*\)/g, (_match, id: string, label: string) => {
        return `${id}["${normalizeNodeLabel(label)}"]`;
      })
      .replace(/\b([A-Za-z][\w-]*)\s*\{\s*"?([^{}"]+)"?\s*\}/g, (_match, id: string, label: string) => {
        return `${id}["${normalizeNodeLabel(label)}"]`;
      });

  for (const rawLine of lines.slice(1, 42)) {
    if (
      /^```/.test(rawLine) ||
      /^classDef\b/.test(rawLine) ||
      /^class\b/.test(rawLine) ||
      /^style\b/.test(rawLine) ||
      /^linkStyle\b/.test(rawLine)
    ) {
      continue;
    }

    const line = quoteNodeLabel(rawLine.replace(/；/g, ';'));
    const nodeOnlyMatch = line.match(/^([A-Za-z][A-Za-z0-9_]*)\["([^"]+)"\]$/);
    if (nodeOnlyMatch) {
      seenNodeLines.add(`${nodeOnlyMatch[1]}["${normalizeNodeLabel(nodeOnlyMatch[2])}"]`);
      continue;
    }

    if (!/^[A-Za-z][\w-]*(?:\["[^"]+"\])?\s*(?:[-.=]+>|-->|---|-\.-)\s*[A-Za-z][\w-]*(?:\["[^"]+"\])?/.test(line)) {
      continue;
    }

    edgeCount += 1;
    normalizedLines.push(line);
  }

  return edgeCount > 0 ? [...normalizedLines, ...seenNodeLines].join('\n') : fallback;
}

function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('模型没有返回可解析的 JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

async function callAnthropic(profile: AiProfile | null | undefined, system: string, prompt: string, maxTokens = 1800) {
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
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic 接口调用失败: ${response.status} ${errorText}`);
  }

  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> };
  return (payload.content || [])
    .filter((part) => part.type === 'text' && part.text)
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function buildHeuristicPlan(source: SourceDocument, input: DehydrateRequest): AgentPlan {
  const steps: AgentPlanStep[] = [
    {
      tool: 'retrieve_knowledge',
      reason: '先查本地知识库，判断当前内容是否与既有条目相关。',
    },
    {
      tool: 'summarize_source',
      reason: '基于正文和补充上下文生成脱水摘要与结构图。',
    },
  ];

  if (input.options.verifyWithSearch) {
    steps.push({
      tool: 'verify_web',
      reason: '用户启用了搜索核验，需要补充外部验证。',
    });
  }

  if (input.options.saveToKnowledgeBase) {
    steps.push({
      tool: 'store_knowledge',
      reason: '用户启用了知识库写入，需要把结果回灌本地库。',
    });
  }

  return {
    mode: 'agentic-rag',
    retrievalQuery: deriveQueryFromSource(source),
    verificationQuery: source.title,
    steps,
  };
}

function normalizePlan(raw: Partial<AgentPlan> | null | undefined, fallback: AgentPlan): AgentPlan {
  const allowedTools: AgentPlanStep['tool'][] = ['retrieve_knowledge', 'summarize_source', 'verify_web', 'store_knowledge'];
  const normalizedSteps = (raw?.steps || [])
    .filter((step): step is AgentPlanStep => Boolean(step?.tool && allowedTools.includes(step.tool)))
    .map((step) => ({
      tool: step.tool,
      reason: step.reason || fallback.steps.find((fallbackStep) => fallbackStep.tool === step.tool)?.reason || '代理选择该工具。',
    }));

  const uniqueSteps = normalizedSteps.filter((step, index, steps) => steps.findIndex((item) => item.tool === step.tool) === index);
  const hasSummary = uniqueSteps.some((step) => step.tool === 'summarize_source');

  return {
    mode: 'agentic-rag',
    retrievalQuery: raw?.retrievalQuery?.trim() || fallback.retrievalQuery,
    verificationQuery: raw?.verificationQuery?.trim() || fallback.verificationQuery,
    steps: hasSummary ? uniqueSteps : fallback.steps,
  };
}

async function buildAgentPlan(profile: AiProfile | null | undefined, input: DehydrateRequest, source: SourceDocument): Promise<AgentPlan> {
  const fallback = buildHeuristicPlan(source, input);
  const text = await callAnthropic(
    profile,
    '你是脱水阅读器的流程代理。你不负责写摘要，只负责决定本次任务应该调用哪些工具。只返回 JSON。',
    `为这次任务输出严格 JSON：{"mode":"agentic-rag","retrievalQuery":"知识库检索查询","verificationQuery":"搜索验证查询","steps":[{"tool":"retrieve_knowledge|summarize_source|verify_web|store_knowledge","reason":"一句原因"}]}\n\n规则：\n1. summarize_source 必须出现。\n2. 如果内容可能和既有知识相关，优先加入 retrieve_knowledge。\n3. 只有在用户启用 verifyWithSearch 时才能加入 verify_web。\n4. 只有在用户启用 saveToKnowledgeBase 时才能加入 store_knowledge。\n5. 不要输出任何解释文字。\n\n输入：\n- 标题：${source.title}\n- 类型：${source.sourceType}\n- 摘要引子：${source.excerpt}\n- verifyWithSearch：${input.options.verifyWithSearch ? 'true' : 'false'}\n- saveToKnowledgeBase：${input.options.saveToKnowledgeBase ? 'true' : 'false'}`,
    420
  );

  if (!text) {
    return fallback;
  }

  try {
    return normalizePlan(extractJson<AgentPlan>(text), fallback);
  } catch {
    return fallback;
  }
}

async function summarizeChunks(profile: AiProfile | null | undefined, source: SourceDocument, chunks: string[]) {
  const digests: ChunkDigest[] = [];
  const limitedChunks = chunks.slice(0, 8);

  for (const [index, chunk] of limitedChunks.entries()) {
    const text = await callAnthropic(
      profile,
      '你是一个中文“脱水智能体”。你的任务是把长内容切分后逐块提炼，保留核心事实、结构和行动线索。只返回 JSON。',
      `请读取第 ${index + 1} 段内容，并返回严格 JSON：{"section":"一句话标题","bullets":["3-5条要点"],"facts":["2-4条可核查事实"]}\n\n来源标题：${source.title}\n内容类型：${source.sourceType}\n\n内容如下：\n${chunk}`,
      900
    );

    if (!text) {
      digests.push({
        section: `片段 ${index + 1}`,
        bullets: [chunk.slice(0, 120)],
        facts: [],
      });
      continue;
    }

    try {
      digests.push(extractJson<ChunkDigest>(text));
    } catch {
      digests.push({
        section: `片段 ${index + 1}`,
        bullets: [text.slice(0, 180)],
        facts: [],
      });
    }
  }

  return digests;
}

async function buildFinalDigest(
  profile: AiProfile | null | undefined,
  source: SourceDocument,
  chunks: string[],
  options?: {
    knowledgeContext?: string;
    dehydrationLevel?: number;
  }
) {
  const preset = getDehydrationPreset(options?.dehydrationLevel);
  const digests = await summarizeChunks(profile, source, chunks);
  const serializedDigests = JSON.stringify(digests, null, 2);
  const knowledgeContext = options?.knowledgeContext?.trim() || '';

  const text = await callAnthropic(
    profile,
    '你是中文“脱水阅读器”的核心摘要代理。只保留信息，不写套话，不写过程说明，不写自我解释。输出必须紧凑、可入库、可复用。',
    `请根据来源信息和分块提要，输出严格 JSON：{"title":"中文标题","tags":["3-6个中文标签"],"summaryMarkdown":"Markdown 格式摘要，必须只包含 # 核心摘要 / # 结构拆解 / # 行动项 三个部分","keyClaims":["${preset.keyClaims} 条核心判断"],"visualSynthesis":[]}\n\n脱水强度：${preset.normalized}/100（${preset.title}）\n\n长度要求：\n1. 全文目标长度控制在 ${preset.targetChars} 个中文字符左右。\n2. # 核心摘要 保留 ${preset.coreBullets} 条最高信息密度要点。\n3. # 结构拆解 保留 ${preset.structureBullets} 条结构节点，只写层级、转折、因果、论证推进。\n4. # 行动项 最多 ${preset.actionBullets} 条，没有就写“- 无”。\n5. 脱水强度越高，越要删掉解释性修辞、背景铺垫、重复表述。\n\n通用要求：\n1. 标签要能支撑检索，优先提取主题、对象、方法、场景四类信息。\n2. 摘要里禁止出现“本文”“这篇文章主要讲”“当前”“建议配置”“处理说明”“已执行”等废话。\n3. 不要复述题目，不要写开场白，不要写总结句套话。\n4. 如果提供了知识库上下文，只把它作为背景对照，用来补充概念关系或避免重复，不要把旧条目硬塞进摘要。\n5. 输出必须能直接入库和二次检索。\n\n来源信息：\n- 标题：${source.title}\n- URL：${source.url}\n- 类型：${source.sourceType}\n- 摘要引子：${source.excerpt}\n\n知识库上下文：\n${knowledgeContext || '无'}\n\n分块提要：\n${serializedDigests}`,
    1800
  );

  if (!text) {
    return buildFallbackDigest(source, chunks, preset.normalized);
  }

  try {
    const parsed = extractJson<FinalDigest>(text);
    return {
      ...parsed,
      summaryMarkdown: sanitizeSummary(parsed.summaryMarkdown),
      visualSynthesis: [],
    };
  } catch {
    return {
      ...buildFallbackDigest(source, chunks, preset.normalized),
      summaryMarkdown: sanitizeSummary(text),
    };
  }
}

async function verifyWithSearch(summary: FinalDigest, overrideQuery?: string) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return {
      performed: false,
      available: false,
      notes: '未配置搜索验证提供方，已跳过外部核验。',
    };
  }

  const endpoint = process.env.TAVILY_API_URL || 'https://api.tavily.com/search';
  const query = overrideQuery?.trim() || summary.keyClaims.slice(0, 3).join(' ; ');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      search_depth: 'advanced',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      performed: false,
      available: true,
      notes: `搜索验证调用失败：${errorText}`,
    };
  }

  const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
  const results = (payload.results || []).slice(0, 3);

  if (!results.length) {
    return {
      performed: true,
      available: true,
      notes: '搜索验证已执行，但没有拿到可用外部结果。',
    };
  }

  const notes = results
    .map((item, index) => `- 结果 ${index + 1}：${item.title || item.url}\n  ${item.url || ''}\n  ${(item.content || '').slice(0, 120)}`)
    .join('\n');

  return {
    performed: true,
    available: true,
    notes,
  };
}

export async function generateStructureDiagramForAnalysis(
  analysis: Pick<Analysis, 'title' | 'content' | 'source' | 'sourceUrl' | 'type'>,
  profile?: AiProfile | null
) {
  const fallback = {
    structureDiagram: {
      mermaid: buildFallbackDiagram(analysis.title, splitIntoChunks(analysis.content, 520)),
      caption: '按条目中的结构线索生成。',
    },
  };

  const text = await callAnthropic(
    profile,
    '你是一个文章结构解析代理。只输出 JSON，不解释。不要输出 Mermaid 代码。',
    `请把下面这篇条目的结构关系解析成节点和连线。输出严格 JSON：{"nodes":[{"id":"n1","label":"短标签","type":"section|claim|evidence|turn|result"}],"edges":[{"from":"n1","to":"n2","label":"关系词"}],"caption":"一句话说明结构图如何对应原文"}\n\n要求：\n1. 只输出 JSON，禁止 Markdown，禁止 Mermaid，禁止代码块。\n2. nodes 保留 4-8 个节点，必须来自原文结构，不能只写“原文/摘要/结论”。\n3. id 只能使用 n1、n2、n3 这种 ASCII 标识；edges 必须引用已有 id。\n4. label 控制在 4-14 个中文字符，去掉括号、冒号、引号、斜杠等符号。\n5. edges 表达章节推进、因果、转折、证据支撑或结论收束，label 控制在 2-6 个中文字符。\n6. 如果原文是并列结构，用同一上游节点分叉；如果是论证结构，用“问题→机制→证据→结果”的推进。\n\n条目信息：\n- 标题：${analysis.title}\n- 来源：${analysis.source}\n- 类型：${analysis.type}\n- URL：${analysis.sourceUrl || '无'}\n\n摘要正文：\n${analysis.content}`,
    900
  );

  if (!text) {
    return fallback;
  }

  try {
    const parsed = extractJson<StructureDiagramSpec & { mermaid?: string }>(text);
    const mermaid = parsed.nodes?.length
      ? buildMermaidFromSpec(parsed, fallback.structureDiagram.mermaid)
      : sanitizeMermaid(parsed.mermaid || '', fallback.structureDiagram.mermaid);
    return {
      structureDiagram: {
        mermaid,
        caption: parsed.caption?.trim() || fallback.structureDiagram.caption,
      },
    };
  } catch {
    return fallback;
  }
}

async function ensureKnowledgeBaseDir() {
  await fs.mkdir(path.dirname(KNOWLEDGE_DB_PATH), { recursive: true });
}

let knowledgeDb: Database.Database | null = null;
let knowledgeDbReadyPromise: Promise<Database.Database> | null = null;

async function getKnowledgeDb() {
  if (knowledgeDb) {
    return knowledgeDb;
  }

  if (!knowledgeDbReadyPromise) {
    knowledgeDbReadyPromise = (async () => {
      await ensureKnowledgeBaseDir();
      const db = new Database(KNOWLEDGE_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          source TEXT,
          source_url TEXT,
          created_at TEXT,
          tags_json TEXT NOT NULL,
          content TEXT NOT NULL,
          chunks_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS knowledge_vectors (
          document_id TEXT PRIMARY KEY,
          vector_json TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at);
      `);

      knowledgeDb = db;
      await migrateLegacyJsonlToSqlite(db);
      return db;
    })();
  }

  return knowledgeDbReadyPromise;
}

let embeddingExtractorPromise: Promise<(texts: string[]) => Promise<number[][]>> | null = null;
let rerankerPromise: Promise<(pairs: string[]) => Promise<number[]>> | null = null;

async function getEmbeddingExtractor() {
  if (!embeddingExtractorPromise) {
    embeddingExtractorPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.cacheDir = EMBEDDING_CACHE_DIR;
      await fs.mkdir(EMBEDDING_CACHE_DIR, { recursive: true });

      const extractor = await pipeline('feature-extraction', DEFAULT_EMBEDDING_MODEL, {
        dtype: DEFAULT_EMBEDDING_DTYPE as 'q8' | 'q4' | 'fp32' | 'fp16',
      });

      return async (texts: string[]) => {
        const output = await extractor(texts, { pooling: 'mean', normalize: true });
        const rows = output.tolist() as number[] | number[][];
        return Array.isArray(rows[0]) ? (rows as number[][]) : [rows as number[]];
      };
    })();
  }

  return embeddingExtractorPromise;
}

async function embedTexts(texts: string[]) {
  const extractor = await getEmbeddingExtractor();
  return extractor(texts);
}

async function getReranker() {
  if (!rerankerPromise) {
    rerankerPromise = (async () => {
      const { env, pipeline } = await import('@huggingface/transformers');
      env.cacheDir = EMBEDDING_CACHE_DIR;
      await fs.mkdir(EMBEDDING_CACHE_DIR, { recursive: true });

      const classifier = await pipeline('text-classification', DEFAULT_RERANKER_MODEL, {
        dtype: DEFAULT_RERANKER_DTYPE as 'q8' | 'q4' | 'fp32' | 'fp16',
      });

      return async (pairs: string[]) => {
        const result = await classifier(pairs, { top_k: 1 });
        const rows = Array.isArray(result) ? result : [result];
        return rows.map((row: unknown) => {
          const item = Array.isArray(row) ? row[0] : row;
          if (item && typeof item === 'object' && 'score' in item) {
            return Number((item as { score: number }).score) || 0;
          }
          return 0;
        });
      };
    })();
  }

  return rerankerPromise;
}

async function rerankCandidates(query: string, candidates: Array<{ entry: KnowledgeBaseEntry; score: number }>) {
  if (!candidates.length) {
    return candidates;
  }

  try {
    const reranker = await withTimeout(getReranker(), EMBEDDING_TIMEOUT_MS, 'reranker 初始化');
    const pairs = candidates.map(({ entry }) => `${query} [SEP] ${getKnowledgeEntryText(entry).slice(0, 1200)}`);
    const scores = await withTimeout(reranker(pairs), EMBEDDING_TIMEOUT_MS, 'reranker 评分');
    return candidates
      .map((candidate, index) => ({
        ...candidate,
        score: candidate.score + (scores[index] || 0) * 100,
      }))
      .sort((left, right) => right.score - left.score);
  } catch {
    return candidates;
  }
}

async function readKnowledgeBaseEntries() {
  const db = await getKnowledgeDb();
  const rows = db.prepare(`
    SELECT id, title, source, source_url, created_at, tags_json, content, chunks_json
    FROM knowledge_documents
    ORDER BY created_at DESC
  `).all() as Array<{
    id: string;
    title: string;
    source: string | null;
    source_url: string | null;
    created_at: string | null;
    tags_json: string;
    content: string;
    chunks_json: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    source: row.source || undefined,
    sourceUrl: row.source_url || undefined,
    createdAt: row.created_at || undefined,
    tags: JSON.parse(row.tags_json) as string[],
    content: row.content,
    chunks: JSON.parse(row.chunks_json) as string[],
  }));
}

async function readLegacyKnowledgeBaseEntries() {
  try {
    const raw = await fs.readFile(LEGACY_KNOWLEDGE_BASE_PATH, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as KnowledgeBaseEntry);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return [] as KnowledgeBaseEntry[];
    }
    throw error;
  }
}

async function upsertKnowledgeEntry(entry: KnowledgeBaseEntry) {
  const db = await getKnowledgeDb();
  const now = entry.createdAt || new Date().toISOString();
  const id = entry.id || `kb-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO knowledge_documents (id, title, source, source_url, created_at, tags_json, content, chunks_json)
    VALUES (@id, @title, @source, @source_url, @created_at, @tags_json, @content, @chunks_json)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source = excluded.source,
      source_url = excluded.source_url,
      created_at = excluded.created_at,
      tags_json = excluded.tags_json,
      content = excluded.content,
      chunks_json = excluded.chunks_json
  `).run({
    id,
    title: entry.title || '未命名条目',
    source: entry.source || null,
    source_url: entry.sourceUrl || null,
    created_at: now,
    tags_json: JSON.stringify(entry.tags || []),
    content: entry.content || '',
    chunks_json: JSON.stringify(entry.chunks || []),
  });

  return { ...entry, id, createdAt: now };
}

async function syncKnowledgeVectorIndex(entries: KnowledgeBaseEntry[]) {
  if (!entries.length) {
    return [] as VectorIndexEntry[];
  }

  const db = await getKnowledgeDb();
  const select = db.prepare(`
    SELECT document_id, vector_json, updated_at
    FROM knowledge_vectors
    WHERE document_id = ?
  `);
  const upsert = db.prepare(`
    INSERT INTO knowledge_vectors (document_id, vector_json, updated_at)
    VALUES (@document_id, @vector_json, @updated_at)
    ON CONFLICT(document_id) DO UPDATE SET
      vector_json = excluded.vector_json,
      updated_at = excluded.updated_at
  `);

  const toEmbed = entries
    .map((entry) => {
      const id = entry.id || '';
      const text = getKnowledgeEntryText(entry);
      return {
        id,
        title: entry.title || '未命名条目',
        text,
        existing: id ? (select.get(id) as { document_id: string; vector_json: string; updated_at: string } | undefined) : undefined,
      };
    })
    .filter((entry) => entry.id && entry.text);

  const missing = toEmbed.filter((entry) => !entry.existing);
  if (missing.length) {
    const vectors = await embedTexts(missing.map((entry) => entry.text));
    const now = new Date().toISOString();
    missing.forEach((entry, index) => {
      upsert.run({
        document_id: entry.id,
        vector_json: JSON.stringify(vectors[index]),
        updated_at: now,
      });
    });
  }

  return toEmbed
    .map((entry) => {
      const row = entry.existing || (select.get(entry.id) as { document_id: string; vector_json: string; updated_at: string } | undefined);
      if (!row) {
        return null;
      }
      return {
        key: row.document_id,
        title: entry.title,
        vector: JSON.parse(row.vector_json) as number[],
        updatedAt: row.updated_at,
      } satisfies VectorIndexEntry;
    })
    .filter(Boolean) as VectorIndexEntry[];
}

async function migrateLegacyJsonlToSqlite(db: Database.Database) {
  const row = db.prepare('SELECT COUNT(1) as count FROM knowledge_documents').get() as { count: number };
  if (row.count > 0) {
    return;
  }

  const legacyEntries = await readLegacyKnowledgeBaseEntries();
  if (!legacyEntries.length) {
    return;
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO knowledge_documents (id, title, source, source_url, created_at, tags_json, content, chunks_json)
    VALUES (@id, @title, @source, @source_url, @created_at, @tags_json, @content, @chunks_json)
  `);

  const tx = db.transaction((entries: KnowledgeBaseEntry[]) => {
    for (const entry of entries) {
      insert.run({
        id: entry.id || `kb-${crypto.randomUUID()}`,
        title: entry.title || '未命名条目',
        source: entry.source || null,
        source_url: entry.sourceUrl || null,
        created_at: entry.createdAt || new Date().toISOString(),
        tags_json: JSON.stringify(entry.tags || []),
        content: entry.content || '',
        chunks_json: JSON.stringify(entry.chunks || []),
      });
    }
  });

  tx(legacyEntries);
}

async function deleteLegacyKnowledgeEntry(id: string) {
  try {
    const raw = await fs.readFile(LEGACY_KNOWLEDGE_BASE_PATH, 'utf8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const filtered = lines.filter((line) => {
      try {
        const parsed = JSON.parse(line) as KnowledgeBaseEntry;
        return parsed.id !== id;
      } catch {
        return true;
      }
    });
    await fs.writeFile(LEGACY_KNOWLEDGE_BASE_PATH, filtered.join('\n') + (filtered.length ? '\n' : ''), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function scoreKnowledgeEntry(queryTokens: string[], entry: KnowledgeBaseEntry) {
  const haystack = [
    entry.title || '',
    entry.source || '',
    (entry.tags || []).join(' '),
    entry.content || '',
    (entry.chunks || []).join(' '),
  ].join('\n');

  if (!haystack.trim()) {
    return 0;
  }

  const target = haystack.toLowerCase();
  return queryTokens.reduce((score, token) => {
    if (!target.includes(token)) {
      return score;
    }

    if ((entry.title || '').toLowerCase().includes(token)) {
      return score + 5;
    }

    if ((entry.tags || []).some((tag) => tag.toLowerCase().includes(token))) {
      return score + 3;
    }

    return score + 1;
  }, 0);
}

function extractSnippet(entry: KnowledgeBaseEntry, queryTokens: string[]) {
  const text = (entry.content || (entry.chunks || []).join('\n')).replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }

  const firstHit = queryTokens.find((token) => text.toLowerCase().includes(token));
  if (!firstHit) {
    return text.slice(0, 180);
  }

  const index = text.toLowerCase().indexOf(firstHit);
  const start = Math.max(0, index - 60);
  return text.slice(start, start + 180);
}

async function retrieveKnowledgeHits(query: string, limit = 3): Promise<KnowledgeHit[]> {
  const entries = await readKnowledgeBaseEntries();
  if (!entries.length) {
    return [];
  }

  const queryTokens = tokenize(query);
  if (!queryTokens.length) {
    return [];
  }

  const lexicalScores = new Map<string, number>();
  entries.forEach((entry) => {
    lexicalScores.set(getKnowledgeEntryKey(entry), scoreKnowledgeEntry(queryTokens, entry));
  });

  let vectorScores = new Map<string, number>();
  try {
    const index = await withTimeout(syncKnowledgeVectorIndex(entries), EMBEDDING_TIMEOUT_MS, '知识库向量索引');
    const queryVector = (await withTimeout(embedTexts([query]), EMBEDDING_TIMEOUT_MS, '查询向量生成'))[0];
    vectorScores = new Map(index.map((entry) => [entry.key, cosineSimilarity(queryVector, entry.vector)]));
  } catch {
    vectorScores = new Map();
  }

  const ranked = entries
    .map((entry) => {
      const key = getKnowledgeEntryKey(entry);
      const lexical = lexicalScores.get(key) || 0;
      const vector = vectorScores.get(key) || 0;
      const score = vector * 100 + lexical;
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const reranked = await rerankCandidates(query, ranked.slice(0, Math.max(limit * 3, 6)));

  return reranked
    .slice(0, limit)
    .map(({ entry, score }) => ({
      title: entry.title || '未命名条目',
      source: entry.source || entry.sourceUrl || '知识库',
      score,
      snippet: extractSnippet(entry, queryTokens),
      tags: entry.tags || [],
    }));
}

function serializeKnowledgeHits(hits: KnowledgeHit[]) {
  if (!hits.length) {
    return '';
  }

  return hits
    .map((hit, index) => [
      `- 条目 ${index + 1}: ${hit.title}`,
      `  来源: ${hit.source}`,
      hit.tags.length ? `  标签: ${hit.tags.join(' / ')}` : '',
      `  相关片段: ${hit.snippet}`,
    ].filter(Boolean).join('\n'))
    .join('\n');
}

async function fetchWithReadability(url: string): Promise<SourceDocument> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`抓取页面失败：${response.status}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const turndownService = new TurndownService({ headingStyle: 'atx' });
  const artwork = extractDocumentArtwork(dom.window.document, url);

  const title = article?.title || dom.window.document.title || url;
  const contentHtml = article?.content || dom.window.document.body.innerHTML;
  const markdown = stripMarkdownNoise(turndownService.turndown(contentHtml));
  const excerpt = article?.excerpt || markdown.slice(0, 180);

  return {
    url,
    title,
    markdown,
    excerpt,
    fetchMethod: 'readability',
    sourceType: inferTypeFromUrl(url),
    coverImageUrl: artwork.coverImageUrl,
    logoUrl: artwork.logoUrl,
  };
}

async function readWechatCookieFromCache(cacheFile?: string) {
  const candidates = [
    cacheFile,
    process.env.SOCIAL_BRIDGE_WECHAT_CACHE_FILE,
    DEFAULT_WECHAT_CACHE_FILE,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const payload = JSON.parse(raw) as { cookies?: Record<string, string>; cookie?: string; cookieString?: string };
      if (payload.cookieString || payload.cookie) {
        return payload.cookieString || payload.cookie || '';
      }
      if (payload.cookies && typeof payload.cookies === 'object') {
        return Object.entries(payload.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
      }
    } catch {
      continue;
    }
  }

  return '';
}

async function getWechatCookie(settings?: SocialCrawlerSettings) {
  return (
    settings?.wechatCookieString?.trim() ||
    process.env.SOCIAL_BRIDGE_WECHAT_COOKIE?.trim() ||
    process.env.WECHAT_COOKIE?.trim() ||
    (await readWechatCookieFromCache(settings?.wechatCacheFile))
  );
}

function buildWechatRequestHeaders(cookieString: string) {
  const headers: Record<string, string> = {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 MicroMessenger/8.0.49',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.7',
    referer: 'https://mp.weixin.qq.com/',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'upgrade-insecure-requests': '1',
  };

  if (cookieString) {
    headers.cookie = cookieString;
  }

  return headers;
}

function extractWechatPublishTime(html: string) {
  const patterns = [
    /var\s+publish_time\s*=\s*["']([^"']+)["']/,
    /publish_time\s*:\s*["']([^"']+)["']/,
    /ct\s*=\s*["']?(\d{10})["']?/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const value = match[1];
      if (/^\d{10}$/.test(value)) {
        return new Date(Number(value) * 1000).toLocaleString('zh-CN');
      }
      return value;
    }
  }

  return '';
}

async function fetchWithWeChat(url: string, settings?: SocialCrawlerSettings): Promise<SourceDocument> {
  const cookieString = await getWechatCookie(settings);
  const response = await fetch(url, {
    redirect: 'follow',
    headers: buildWechatRequestHeaders(cookieString),
  });

  if (!response.ok) {
    throw new Error(`公众号文章抓取失败：${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const restricted =
    /访问过于频繁|环境异常|请在微信客户端打开|该内容已被发布者删除|当前页面无法访问/.test(html);
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  const contentNode = document.querySelector('#js_content') || document.querySelector('.rich_media_content');
  const title =
    document.querySelector('#activity-name')?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    document.title?.trim() ||
    '公众号文章';
  const author =
    document.querySelector('#js_name')?.textContent?.trim() ||
    document.querySelector('.profile_nickname')?.textContent?.trim() ||
    document.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ||
    '';
  const artwork = extractDocumentArtwork(document, url);
  const turndownService = new TurndownService({ headingStyle: 'atx' });
  const contentHtml = contentNode?.innerHTML || '';
  const markdown = stripMarkdownNoise(
    [
      `# ${title}`,
      author ? `来源：${author}` : '',
      extractWechatPublishTime(html) ? `发布时间：${extractWechatPublishTime(html)}` : '',
      contentHtml ? turndownService.turndown(contentHtml) : '',
    ]
      .filter(Boolean)
      .join('\n\n')
  );

  if (restricted || !contentNode || markdown.replace(/\s+/g, '').length < 80) {
    throw new Error(
      cookieString
        ? '公众号文章仍然访问受限：当前 cookie 可能已失效，请在设置页重新扫码登录公众号。'
        : '公众号文章访问受限：请先在设置页完成公众号扫码登录，写回 token/cookie 后再试。'
    );
  }

  return {
    url,
    title,
    markdown,
    excerpt: markdown.slice(0, 180),
    fetchMethod: 'wechat',
    sourceType: 'article',
    coverImageUrl: artwork.coverImageUrl,
    logoUrl: artwork.logoUrl,
  };
}

async function fetchWithCrawl4AI(url: string): Promise<SourceDocument | null> {
  const scriptPath = path.join(PROJECT_ROOT, 'server', 'crawl4ai_fetch.py');
  const pythonCandidates = [
    process.env.CRAWL4AI_PYTHON,
    path.join(PROJECT_CRAWL4AI_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(PROJECT_CRAWL4AI_ROOT, '.venv311', 'Scripts', 'python.exe'),
    path.join(process.env.CRAWL4AI_ROOT || DEFAULT_CRAWL4AI_ROOT, '.venv', 'Scripts', 'python.exe'),
    path.join(process.env.CRAWL4AI_ROOT || DEFAULT_CRAWL4AI_ROOT, '.venv311', 'Scripts', 'python.exe'),
  ].filter(Boolean) as string[];

  let pythonPath: string | null = null;

  try {
    await fs.access(scriptPath);
  } catch {
    return null;
  }

  for (const candidate of pythonCandidates) {
    try {
      await fs.access(candidate);
      pythonPath = candidate;
      break;
    } catch {
      continue;
    }
  }

  if (!pythonPath) {
    return null;
  }

  let stdout = '';
  try {
    stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonPath, [scriptPath, url], { cwd: PROJECT_ROOT });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        errorOutput += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(errorOutput || `crawl4ai 退出码 ${code}`));
          return;
        }
        resolve(output);
      });
    });
  } catch {
    return null;
  }

  const jsonLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse()
    .find((line) => line.startsWith('{') && line.endsWith('}'));

  if (!jsonLine) {
    return null;
  }

  const payload = JSON.parse(jsonLine) as {
    title?: string;
    markdown?: string;
    excerpt?: string;
    coverImageUrl?: string;
    logoUrl?: string;
    metadata?: Record<string, unknown>;
  };
  if (!payload.markdown) {
    return null;
  }

  return {
    url,
    title: payload.title || url,
    markdown: stripMarkdownNoise(payload.markdown),
    excerpt: payload.excerpt || payload.markdown.slice(0, 180),
    fetchMethod: 'crawl4ai',
    sourceType: inferTypeFromUrl(url),
    coverImageUrl: resolveAssetUrl(url, payload.coverImageUrl),
    logoUrl: resolveAssetUrl(url, payload.logoUrl),
  };
}

async function fetchWithFirecrawl(url: string, profile?: AiProfile | null): Promise<SourceDocument> {
  const config = getFirecrawlConfig(profile);
  if (!config.apiKey) {
    throw new Error('Firecrawl Key 未填写。');
  }

  const response = await fetch(`${config.baseUrl}/v2/scrape`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Firecrawl 抓取失败：${response.status} ${errorText}`);
  }

  const payload = await response.json() as {
    data?: {
      markdown?: string;
      metadata?: {
        title?: string;
        description?: string;
        image?: string;
        ogImage?: string;
        favicon?: string;
      };
    };
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      image?: string;
      ogImage?: string;
      favicon?: string;
    };
  };
  const markdown = stripMarkdownNoise(payload.data?.markdown || payload.markdown || '');
  if (!markdown) {
    throw new Error('Firecrawl 没有返回可用正文。');
  }

  return {
    url,
    title: payload.data?.metadata?.title || payload.metadata?.title || url,
    markdown,
    excerpt: payload.data?.metadata?.description || payload.metadata?.description || markdown.slice(0, 180),
    fetchMethod: 'firecrawl',
    sourceType: inferTypeFromUrl(url),
    coverImageUrl: resolveAssetUrl(url, payload.data?.metadata?.ogImage || payload.data?.metadata?.image || payload.metadata?.ogImage || payload.metadata?.image),
    logoUrl: resolveAssetUrl(url, payload.data?.metadata?.favicon || payload.metadata?.favicon),
  };
}

async function fetchSourceDocument(url: string, profile?: AiProfile | null, socialCrawlerSettings?: SocialCrawlerSettings) {
  const methodHint = isWeChatArticleUrl(url) ? 'wechat' : '';
  const cached = readCachedSourceDocument(url, profile, methodHint);
  if (cached) {
    return cached;
  }

  const provider = profile?.fetchProvider || 'crawl4ai';
  let source: SourceDocument;

  if (isWeChatArticleUrl(url)) {
    source = await fetchWithWeChat(url, socialCrawlerSettings);
    writeCachedSourceDocument(source, profile, 'wechat');
    return source;
  }

  if (provider === 'firecrawl') {
    source = await fetchWithFirecrawl(url, profile);
    writeCachedSourceDocument(source, profile);
    return source;
  }

  if (provider === 'readability') {
    source = await fetchWithReadability(url);
    writeCachedSourceDocument(source, profile);
    return source;
  }

  const crawl4aiResult = await fetchWithCrawl4AI(url);
  if (crawl4aiResult?.markdown) {
    writeCachedSourceDocument(crawl4aiResult, profile);
    return crawl4aiResult;
  }

  source = await fetchWithReadability(url);
  writeCachedSourceDocument(source, profile);
  return source;
}

function buildAnalysis(
  source: SourceDocument,
  digest: FinalDigest,
  verificationNotes: string,
  hydration: HydrationReport,
  dehydrationLevel: number
) {
  const summaryMarkdown = verificationNotes
    ? `${digest.summaryMarkdown}\n\n# 搜索验证\n\n${verificationNotes}`
    : digest.summaryMarkdown;
  const metrics = buildAnalysisMetrics(source.markdown, summaryMarkdown, digest.keyClaims || []);

  return {
    id: `analysis-${Date.now()}`,
    title: digest.title || source.title,
    source: source.title,
    sourceUrl: source.url,
    readTime: estimateReadTime(source.markdown, source.sourceType),
    tags: digest.tags?.length ? digest.tags.slice(0, 4) : ['自动脱水'],
    content: summaryMarkdown,
    visualSynthesis: [],
    structureDiagram: digest.diagramMermaid
      ? {
          mermaid: digest.diagramMermaid,
          caption: digest.diagramCaption || '结构图按原文层级生成。',
        }
      : undefined,
    timestamp: '刚刚',
    status: 'ready' as const,
    type: source.sourceType,
    coverImageUrl: source.coverImageUrl,
    logoUrl: source.logoUrl,
    hydration,
    dehydrationLevel,
    metrics,
  } satisfies Analysis;
}

export async function estimateSourceHydration(
  url: string,
  profile?: AiProfile | null,
  socialCrawlerSettings?: SocialCrawlerSettings
): Promise<SourceEstimateResponse> {
  const source = await fetchSourceDocument(url, profile, socialCrawlerSettings);

  return {
    title: source.title,
    sourceUrl: source.url,
    type: source.sourceType,
    readTime: estimateReadTime(source.markdown, source.sourceType),
    hydration: estimateHydration(source.markdown),
    fetchMethod: source.fetchMethod,
    coverImageUrl: source.coverImageUrl,
    logoUrl: source.logoUrl,
  };
}

export async function dehydrateUrl(input: DehydrateRequest): Promise<DehydrateResponse> {
  const source = await fetchSourceDocument(input.url, input.aiProfile, input.socialCrawlerSettings);
  const chunks = splitIntoChunks(source.markdown);
  const dehydrationLevel = normalizeDehydrationLevel(input.options?.dehydrationLevel);
  const plan = await buildAgentPlan(input.aiProfile, input, source);
  const trace: AgentTraceItem[] = plan.steps.map((step) => ({
    tool: step.tool,
    status: 'planned',
    reason: step.reason,
  }));

  let knowledgeHits: KnowledgeHit[] = [];
  let digest: FinalDigest | null = null;
  let verification = { performed: false, available: false, notes: '' };

  for (const step of plan.steps) {
    const traceItem = trace.find((item) => item.tool === step.tool);

    try {
      if (step.tool === 'retrieve_knowledge') {
        knowledgeHits = await retrieveKnowledgeHits(plan.retrievalQuery || deriveQueryFromSource(source));
        if (traceItem) {
          traceItem.status = knowledgeHits.length ? 'completed' : 'skipped';
          traceItem.reason = knowledgeHits.length
            ? `${step.reason} 命中 ${knowledgeHits.length} 条相关条目。`
            : `${step.reason} 没有命中相关条目。`;
        }
        continue;
      }

      if (step.tool === 'summarize_source') {
        digest = await buildFinalDigest(input.aiProfile, source, chunks, {
          knowledgeContext: serializeKnowledgeHits(knowledgeHits),
          dehydrationLevel,
        });
        if (traceItem) {
          traceItem.status = 'completed';
        }
        continue;
      }

      if (step.tool === 'verify_web') {
        if (!digest) {
          if (traceItem) {
            traceItem.status = 'skipped';
            traceItem.reason = '摘要尚未生成，跳过搜索验证。';
          }
          continue;
        }
        verification = await verifyWithSearch(digest, plan.verificationQuery);
        if (traceItem) {
          traceItem.status = verification.performed ? 'completed' : 'skipped';
          traceItem.reason = verification.notes || step.reason;
        }
        continue;
      }

      if (step.tool === 'store_knowledge') {
        if (traceItem) {
          traceItem.status = 'planned';
        }
      }
    } catch (error) {
      if (traceItem) {
        traceItem.status = 'failed';
        traceItem.reason = error instanceof Error ? error.message : step.reason;
      }
    }
  }

  const finalDigest = digest || await buildFinalDigest(input.aiProfile, source, chunks, {
    knowledgeContext: serializeKnowledgeHits(knowledgeHits),
    dehydrationLevel,
  });
  const hydration = buildHydrationReport(
    source.markdown,
    verification.notes ? `${finalDigest.summaryMarkdown}\n\n${verification.notes}` : finalDigest.summaryMarkdown
  );
  const analysis = buildAnalysis(source, finalDigest, verification.notes, hydration, dehydrationLevel);

  const shouldStoreKnowledge = plan.steps.some((step) => step.tool === 'store_knowledge') && input.options.saveToKnowledgeBase;
  if (shouldStoreKnowledge) {
    const kbEntry = await upsertKnowledgeEntry({
      id: analysis.id,
      title: analysis.title,
      source: analysis.source,
      sourceUrl: analysis.sourceUrl,
      createdAt: new Date().toISOString(),
      tags: analysis.tags,
      content: analysis.content,
      chunks,
    });

    try {
      await withTimeout(syncKnowledgeVectorIndex([kbEntry]), EMBEDDING_TIMEOUT_MS, '知识库存储后索引');
    } catch {
      // 向量索引失败不阻断主流程，下次检索时会再次尝试。
    }

    const storeTrace = trace.find((item) => item.tool === 'store_knowledge');
    if (storeTrace) {
      storeTrace.status = 'completed';
    }
  }

  return {
    analysis,
    meta: {
      fetchMethod: source.fetchMethod,
      chunkCount: chunks.length,
      verificationPerformed: verification.performed,
      verificationAvailable: verification.available,
      knowledgeBaseSaved: shouldStoreKnowledge,
      orchestrationMode: 'agentic-rag',
      ragUsed: knowledgeHits.length > 0,
      knowledgeHits: knowledgeHits.length,
      orchestrationTrace: trace,
    },
  };
}

export async function removeAnalysisFromKnowledgeBase(id: string) {
  const db = await getKnowledgeDb();
  const result = db.prepare('DELETE FROM knowledge_documents WHERE id = ?').run(id);
  await deleteLegacyKnowledgeEntry(id);

  return {
    ok: true,
    deletedId: id,
    knowledgeBaseDeleted: result.changes > 0,
  };
}

export async function testProfileConnectivity(profile: AiProfile) {
  const aiReport = async () => {
    if (!profile.apiKey) {
      return { ok: false, message: 'AI Key 未填写，无法测试模型接口。' };
    }

    try {
      const text = await callAnthropic(
        profile,
        '你是一个联通性测试助手，只回复 ok。',
        '请只回复 ok',
        12
      );

      if (!text) {
        return { ok: false, message: 'AI 接口已连通，但没有返回文本。' };
      }

      return { ok: true, message: `AI 接口可用，模型返回：${text.slice(0, 40)}` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'AI 接口测试失败。',
      };
    }
  };

  const fetcherReport = async () => {
    try {
      if (profile.fetchProvider === 'firecrawl') {
        if (!profile.firecrawlApiKey) {
          return { ok: false, message: 'Firecrawl Key 未填写。' };
        }
        const result = await fetchWithFirecrawl('https://example.com', profile);
        return { ok: true, message: `Firecrawl 可用，已抓取：${result.title}` };
      }

      if (profile.fetchProvider === 'readability') {
        const result = await fetchWithReadability('https://example.com');
        return { ok: true, message: `Readability 可用，已解析：${result.title}` };
      }

      const result = await fetchWithCrawl4AI('https://example.com');
      if (!result?.markdown) {
        return { ok: false, message: 'Crawl4AI 未就绪，请先运行 npm run setup:crawl4ai 或检查 CRAWL4AI_PYTHON。' };
      }

      return { ok: true, message: `Crawl4AI 可用，已抓取：${result.title}` };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '抓取器测试失败。',
      };
    }
  };

  const [ai, fetcher] = await Promise.all([aiReport(), fetcherReport()]);
  return { ai, fetcher };
}
