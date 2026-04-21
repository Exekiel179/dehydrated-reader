import express from 'express';
import {
  dehydrateUrl,
  estimateSourceHydration,
  generateStructureDiagramForAnalysis,
  removeAnalysisFromKnowledgeBase,
  testProfileConnectivity,
} from './agent.ts';
import {
  captureBrowserAuth,
  captureWechatAuth,
  crawlSocialProvider,
  fetchRssFeeds,
  getTrendMonitorSettings,
  getTrendOverview,
  importRssSubscription,
  openSocialLoginPage,
  refreshTrendRadarOverview,
  saveTrendMonitorSettings,
} from './integrations.ts';
import type { AiProfile, Analysis, DehydrateRequest, RSSSubscription, SocialCrawlerSettings, TrendMonitorSettings } from '../src/types.ts';

const app = express();
const port = Number(process.env.PORT || 4310);

app.use(express.json({ limit: '2mb' }));

app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  next();
});

app.options('*', (_, res) => {
  res.sendStatus(204);
});

app.get('/api/health', (_, res) => {
  res.json({
    ok: true,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    crawl4aiRoot: process.env.CRAWL4AI_ROOT || 'F:\\Projects\\crawl4ai-local',
  });
});

app.post('/api/dehydrate', async (req, res) => {
  const body = req.body as DehydrateRequest;
  if (!body?.url || typeof body.url !== 'string') {
    res.status(400).json({ error: '缺少有效网址。' });
    return;
  }

  try {
    const payload = await dehydrateUrl({
      url: body.url,
      options: {
        verifyWithSearch: Boolean(body.options?.verifyWithSearch),
        saveToKnowledgeBase: Boolean(body.options?.saveToKnowledgeBase),
        dehydrationLevel: Number(body.options?.dehydrationLevel ?? 60),
      },
      aiProfile: body.aiProfile || null,
      socialCrawlerSettings: body.socialCrawlerSettings,
    });

    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '脱水失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/source-estimate', async (req, res) => {
  const url = req.body?.url;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: '缺少有效网址。' });
    return;
  }

  try {
    const payload = await estimateSourceHydration(url, req.body?.aiProfile || null, req.body?.socialCrawlerSettings);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '预估失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/structure-diagram', async (req, res) => {
  const analysis = req.body?.analysis as Analysis | undefined;
  if (!analysis?.title || !analysis?.content) {
    res.status(400).json({ error: '缺少有效条目内容。' });
    return;
  }

  try {
    const payload = await generateStructureDiagramForAnalysis(analysis, req.body?.aiProfile || null);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '结构图生成失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/test-profile', async (req, res) => {
  const profile = req.body?.profile as AiProfile | undefined;
  if (!profile?.baseUrl || !profile?.model) {
    res.status(400).json({ error: '缺少有效的配置。' });
    return;
  }

  try {
    const payload = await testProfileConnectivity(profile);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '联通性测试失败。';
    res.status(500).json({ error: message });
  }
});

app.get('/api/trends/overview', async (req, res) => {
  const limit = Number(req.query.limit || 24);

  try {
    const payload = await getTrendOverview(Number.isFinite(limit) ? limit : 24);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '热点追踪读取失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/trends/refresh', async (req, res) => {
  const limit = Number(req.query.limit || 24);

  try {
    const payload = await refreshTrendRadarOverview(Number.isFinite(limit) ? limit : 24);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '热点采集刷新失败。';
    res.status(500).json({ error: message });
  }
});

app.get('/api/trends/settings', async (_, res) => {
  try {
    const payload = await getTrendMonitorSettings();
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '热点来源配置读取失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/trends/settings', async (req, res) => {
  const settings = req.body as TrendMonitorSettings | undefined;
  if (!settings || !Array.isArray(settings.sources)) {
    res.status(400).json({ error: '缺少有效的热点来源配置。' });
    return;
  }

  try {
    const payload = await saveTrendMonitorSettings(settings);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '热点来源配置保存失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/rss/import', async (req, res) => {
  const url = String(req.body?.url || '').trim();
  const category = req.body?.category;
  if (!url) {
    res.status(400).json({ error: '缺少有效的 RSS 地址。' });
    return;
  }

  try {
    const payload = await importRssSubscription(url, category);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS 导入失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/rss/feeds', async (req, res) => {
  const subscriptions = Array.isArray(req.body?.subscriptions) ? (req.body.subscriptions as RSSSubscription[]) : [];
  const perFeedLimit = Number(req.body?.perFeedLimit || 4);

  try {
    const payload = await fetchRssFeeds(subscriptions, Number.isFinite(perFeedLimit) ? perFeedLimit : 4);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS 抓取失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/social-crawl', async (req, res) => {
  const provider = req.body?.provider;
  const query = req.body?.query;
  const limit = Number(req.body?.limit || 6);
  const settings = req.body?.settings as SocialCrawlerSettings | undefined;

  if (provider !== 'xhs' && provider !== 'douyin' && provider !== 'wechat') {
    res.status(400).json({ error: 'provider 仅支持 xhs、douyin 或 wechat。' });
    return;
  }

  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: '缺少查询词或链接。' });
    return;
  }

  try {
    const payload = await crawlSocialProvider(provider, query, Number.isFinite(limit) ? limit : 6, settings);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '社媒爬虫执行失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/social-auth/open-login', async (req, res) => {
  const provider = req.body?.provider as 'xhs' | 'douyin' | 'douyin-live' | 'wechat' | undefined;
  if (!provider || !['xhs', 'douyin', 'douyin-live', 'wechat'].includes(provider)) {
    res.status(400).json({ error: 'provider 仅支持 xhs、douyin、douyin-live 或 wechat。' });
    return;
  }

  try {
    const payload = await openSocialLoginPage(provider);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '打开登录页失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/social-auth/capture-wechat', async (req, res) => {
  const settings = req.body?.settings as SocialCrawlerSettings | undefined;

  try {
    const payload = await captureWechatAuth(settings);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '公众号登录捕获失败。';
    res.status(500).json({ error: message });
  }
});

app.post('/api/social-auth/capture-login', async (req, res) => {
  const provider = req.body?.provider as 'xhs' | 'douyin' | 'douyin-live' | undefined;
  if (!provider || !['xhs', 'douyin', 'douyin-live'].includes(provider)) {
    res.status(400).json({ error: 'provider 仅支持 xhs、douyin 或 douyin-live。' });
    return;
  }

  try {
    const payload = await captureBrowserAuth(provider);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '登录态捕获失败。';
    res.status(500).json({ error: message });
  }
});

app.delete('/api/analyses/:id', async (req, res) => {
  const id = req.params.id?.trim();
  if (!id) {
    res.status(400).json({ error: '缺少有效条目 ID。' });
    return;
  }

  try {
    const payload = await removeAnalysisFromKnowledgeBase(id);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败。';
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Dehydrated Reader API listening on http://localhost:${port}`);
});
