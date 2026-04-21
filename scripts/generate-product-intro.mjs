import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'marketing', 'product-intro');
const SCREEN_DIR = path.join(OUT_DIR, 'screenshots');
const CARD_DIR = path.join(OUT_DIR, 'cards');
const APP_URL = process.env.APP_URL || 'http://localhost:4300/';

const now = new Date().toLocaleString('zh-CN', { hour12: false });

function svgCover(title, bgA, bgB, accent) {
  const safeTitle = title.replace(/[<>&]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="${bgA}" offset="0"/>
      <stop stop-color="${bgB}" offset="1"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>
  <rect width="1200" height="760" fill="url(#g)"/>
  <circle cx="890" cy="180" r="170" fill="${accent}" opacity=".24" filter="url(#blur)"/>
  <circle cx="280" cy="600" r="230" fill="#ffffff" opacity=".16" filter="url(#blur)"/>
  <path d="M180 220 C 360 120, 460 340, 620 230 S 850 130, 1000 260" stroke="#fff" stroke-width="18" fill="none" opacity=".32"/>
  <text x="96" y="600" fill="#fff" font-family="Arial, 'Microsoft YaHei'" font-size="72" font-weight="800">${safeTitle}</text>
  <text x="100" y="660" fill="#fff" opacity=".8" font-family="Arial, 'Microsoft YaHei'" font-size="28" font-weight="700">DEHYDRATED READER</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const analyses = [
  {
    id: 'analysis-demo-001',
    title: '5月1日：特朗普军事行动的法律截止日',
    source: '华尔街见闻',
    sourceUrl: 'https://wallstreetcn.com/articles/3770498',
    readTime: '阅读约 6 分钟',
    tags: ['美股行情', '地缘风险', '法律时限', '能源市场'],
    content: '# 核心摘要\n- 5月1日是美国战争权力法下的关键截止日，未经国会授权的军事行动需要明确去留。\n- 冲突已推高能源市场风险，法律与市场压力同步集中。\n- 核心问题不是事件本身，而是总统权力、国会授权与市场预期的三角关系。\n\n# 结构拆解\n- 法律期限提出约束 → 军事行动引发市场成本 → 国会授权成为政治焦点 → 市场等待制度信号。\n\n# 行动项\n- 追踪国会授权进展。\n- 关注能源与避险资产反应。',
    visualSynthesis: [],
    timestamp: '刚刚',
    status: 'ready',
    type: 'article',
    coverImageUrl: svgCover('法律截止日', '#7b3948', '#273241', '#f1a9b8'),
    logoUrl: '',
    dehydrationLevel: 72,
    hydration: {
      before: { waterPercent: 58, signalPercent: 42, estimatedWaterChars: 1200, estimatedSignalChars: 900, totalChars: 2100, densityScore: 42, label: '偏湿' },
      after: { waterPercent: 27, signalPercent: 73, estimatedWaterChars: 380, estimatedSignalChars: 1030, totalChars: 1410, densityScore: 73, label: '高密度' },
      waterDropPercent: 31,
      compressionPercent: 33,
      compressionRatio: 0.67,
    },
    metrics: { sourceReadMinutes: 6, summaryReadMinutes: 2, timeSavedMinutes: 4, keyInsights: 3 },
  },
  {
    id: 'analysis-demo-002',
    title: '自然语言编程的根本缺陷',
    source: 'EWD Archive',
    sourceUrl: 'https://example.com/dijkstra',
    readTime: '阅读约 8 分钟',
    tags: ['Dijkstra', '形式化思维', '自然语言编程', '编程语言哲学'],
    content: '# 核心摘要\n- 自然语言的弹性让它适合交流，却不适合直接承担形式系统的精确约束。\n- 编程语言的价值不在接近口语，而在提前排除模糊和荒谬。\n- 数学符号史说明：形式化不是负担，而是复杂文明的认知脚手架。\n\n# 结构拆解\n- 反驳自然语言编程幻想 → 回到数学史 → 说明形式系统的必要性 → 推出编程接口的边界。\n\n# 行动项\n- 设计提示词时明确约束和输出格式。',
    visualSynthesis: [],
    timestamp: '今天',
    status: 'essential',
    type: 'article',
    coverImageUrl: svgCover('形式化思维', '#111114', '#5f698f', '#ffffff'),
    logoUrl: '',
    dehydrationLevel: 83,
    metrics: { sourceReadMinutes: 8, summaryReadMinutes: 2.5, timeSavedMinutes: 5.5, keyInsights: 3 },
  },
  {
    id: 'analysis-demo-003',
    title: 'AI 产品如何降低用户的认知负荷',
    source: '产品方法论',
    sourceUrl: 'https://example.com/ai-product-cognition',
    readTime: '阅读约 10 分钟',
    tags: ['AI产品', '工作记忆', '认知负荷', '效率策略'],
    content: '# 核心摘要\n- 好的 AI 产品不是堆功能，而是替用户减少切换、记忆和判断成本。\n- 工作记忆容量有限，界面应把复杂过程外显成阶段、队列和可回看的结构。\n- 代理能力需要透明反馈，否则用户会把不确定性转化为焦虑。\n\n# 结构拆解\n- 认知负荷问题 → 产品界面分担记忆 → 智能体透明反馈 → 形成信任。\n\n# 行动项\n- 用队列、状态、摘要和可视化降低操作成本。',
    visualSynthesis: [],
    timestamp: '昨天',
    status: 'ready',
    type: 'web',
    coverImageUrl: svgCover('认知负荷', '#3f6446', '#f4b9c3', '#ffffff'),
    logoUrl: '',
    dehydrationLevel: 68,
    metrics: { sourceReadMinutes: 10, summaryReadMinutes: 3, timeSavedMinutes: 7, keyInsights: 3 },
  },
  {
    id: 'analysis-demo-004',
    title: '课程视频：从字幕到结构化简报',
    source: 'Bilibili',
    sourceUrl: 'https://www.bilibili.com/video/demo',
    readTime: '观看约 42 分钟',
    tags: ['课程视频', 'Whisper', '结构提炼', '学习方法'],
    content: '# 核心摘要\n- 视频脱水的关键是先拿到字幕或音频转写，再做章节切分和结构提炼。\n- 模型总结视频时不应只复述内容，要提取课程目标、论证步骤和可行动练习。\n- 本地 faster-whisper 可以让无字幕视频进入同一条脱水管线。\n\n# 结构拆解\n- 视频下载 → 字幕/转写 → 章节切分 → 脱水摘要 → 入库检索。\n\n# 行动项\n- 对长课优先生成章节索引。',
    visualSynthesis: [],
    timestamp: '昨天',
    status: 'ready',
    type: 'video',
    coverImageUrl: svgCover('视频脱水', '#2c4d66', '#87cde3', '#ffffff'),
    logoUrl: '',
    dehydrationLevel: 64,
    metrics: { sourceReadMinutes: 42, summaryReadMinutes: 5, timeSavedMinutes: 37, keyInsights: 4 },
  },
];

const rssSubscriptions = [
  { id: 'rss-psy', title: '心理学顶刊', url: 'https://example.com/psy.xml', category: 'psychology-journal', enabled: true, description: '心理学论文目录', coverImageUrl: svgCover('心理学顶刊', '#8c4b57', '#f6dce0', '#ffffff') },
  { id: 'rss-ai', title: 'AI 产品趋势', url: 'https://example.com/ai.xml', category: 'ai-product', enabled: true, description: 'AI 产品、Agent 与工具更新', coverImageUrl: svgCover('AI 产品', '#40524b', '#b9d7cb', '#ffffff') },
  { id: 'rss-github', title: 'GitHub 趋势', url: 'https://example.com/github.xml', category: 'github', enabled: true, description: '开源项目趋势', coverImageUrl: svgCover('GitHub 趋势', '#111114', '#6f8178', '#ffffff') },
];

const userProfile = {
  name: 'Exekiel',
  title: '策展者',
  avatarUrl: svgCover('E', '#894854', '#a6606c', '#ffffff'),
  proficiency: 78,
  timeSaved: '46.5h',
  keyInsights: 16,
};

const pages = [
  { id: '01-dashboard', nav: '仪表盘', title: '一键脱水工作台', subtitle: '长文链接、论文 PDF、课程视频进入同一条处理管线。', bullets: ['先估含水量', '队列化脱水', '沉淀到知识库'] },
  { id: '02-analysis', nav: '分析页', title: '结构化阅读结果', subtitle: '原文、结构提炼、摘要和图谱按阅读顺序组织。', bullets: ['含水量对比', '结构图生成', '关键判断保留'] },
  { id: '03-knowledge', nav: '知识库', title: '瀑布流笔记墙', subtitle: '每条脱水结果以图片和标题进入可回看的知识库。', bullets: ['标签复用', '详情展开', '删除同步知识库'] },
  { id: '04-search', nav: '知识搜索', title: '本地知识搜索', subtitle: '向量 RAG 与可视化搜索界面，让沉淀资料重新参与思考。', bullets: ['语义召回', '片段预览', 'MCP 暴露接口'] },
  { id: '05-output', nav: '产出页', title: '多素材聚合成文', subtitle: '从多篇脱水文章重新组织主线，生成公众号、小红书或深度文章。', bullets: ['拖拽选素材', '平台化风格', '配图/视频提示词'] },
  { id: '06-rss', nav: 'RSS 订阅', title: 'RSS 流水屏', subtitle: '订阅、关键词发现和文章图像进入统一阅读队列。', bullets: ['AI 搜索 RSS', '分组可编辑', '点击加入脱水'] },
  { id: '07-trends', nav: '热点追踪', title: '热点雷达入口', subtitle: '读取 TrendRadar 数据，按平台分布筛选可脱水热点。', bullets: ['手动刷新', '来源开关', '忽略噪声'] },
  { id: '08-social', nav: '社媒爬虫', title: '统一社媒采集', subtitle: '小红书、抖音、公众号爬虫收口到一个可视化工作台。', bullets: ['登录态配置', '真实抓取结果', '封面与正文'] },
  { id: '09-settings', nav: '接口设置', title: '接口、提示词与媒体 API', subtitle: 'AI、抓取器、提示词、生图和生视频配置集中管理。', bullets: ['多配置切换', 'Key 隐藏', '提示词可改'] },
];

async function ensureDirs() {
  await fs.mkdir(SCREEN_DIR, { recursive: true });
  await fs.mkdir(CARD_DIR, { recursive: true });
}

async function seedDemoData(page) {
  await page.addInitScript(({ analyses, rssSubscriptions, userProfile }) => {
    localStorage.setItem('dehydrated-reader-analyses', JSON.stringify(analyses));
    localStorage.setItem('dehydrated-reader-rss-subscriptions', JSON.stringify(rssSubscriptions));
    localStorage.setItem('dehydrated-reader-user-profile', JSON.stringify(userProfile));
    localStorage.setItem('dehydrated-reader-color-theme', 'rose');
    localStorage.setItem('dehydrated-reader-accent-preset', 'berry');
  }, { analyses, rssSubscriptions, userProfile });
}

async function clickNav(page, label) {
  await page.getByText(label, { exact: true }).first().click({ timeout: 8000 });
  await page.waitForTimeout(900);
}

async function captureScreenshots(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  await seedDemoData(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  for (const item of pages) {
    await clickNav(page, item.nav);
    if (item.id === '02-analysis') {
      await page.getByText('5月1日：特朗普军事行动的法律截止日').first().click().catch(() => {});
      await page.waitForTimeout(800);
    }
    if (item.id === '05-output') {
      await page.locator('article').nth(0).locator('button').first().click().catch(() => {});
      await page.locator('article').nth(1).locator('button').first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: path.join(SCREEN_DIR, `${item.id}.png`), fullPage: false });
  }
  await context.close();
}

function buildPosterHtml(item, index) {
  const screenshot = path.join(SCREEN_DIR, `${item.id}.png`).replaceAll('\\', '/');
  const bullets = item.bullets.map((bullet) => `<span>${bullet}</span>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;width:1600px;height:900px;background:#fcf9f8;font-family:Inter,"Microsoft YaHei",Arial,sans-serif;color:#1b1c1b;overflow:hidden}
  .page{position:relative;width:1600px;height:900px;padding:64px 76px;background:
    radial-gradient(circle at 58% 8%, rgba(255,178,189,.42), transparent 18%),
    radial-gradient(circle at 8% 88%, rgba(137,72,84,.12), transparent 20%),
    #fcf9f8}
  .grain{position:absolute;inset:0;background-image:radial-gradient(rgba(137,72,84,.14) 1px, transparent 1px);background-size:18px 18px;mask-image:linear-gradient(120deg,transparent 0%,#000 28%,transparent 68%);opacity:.5}
  .top{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:40px}
  .eyebrow{font-size:18px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#8c4b57}
  h1{margin:18px 0 0;font-size:70px;line-height:1.02;letter-spacing:0;font-weight:900;color:#1b1c1b}
  .subtitle{margin-top:22px;max-width:720px;font-size:27px;line-height:1.65;color:#514346}
  .num{font-size:86px;font-weight:900;color:#8c4b57;line-height:.9}
  .num small{display:block;margin-top:14px;font-size:18px;letter-spacing:.18em;color:#837375}
  .screen{position:absolute;left:76px;right:76px;bottom:64px;height:512px;border-radius:26px;border:1px solid rgba(131,115,117,.24);background:white;box-shadow:0 30px 80px rgba(137,72,84,.16);overflow:hidden}
  .screen img{width:100%;height:100%;object-fit:cover;object-position:top left;display:block}
  .shine{position:absolute;inset:0;background:linear-gradient(100deg,rgba(255,255,255,.28),transparent 35%,transparent 72%,rgba(255,255,255,.18));pointer-events:none}
  .chips{position:absolute;right:118px;top:282px;display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;max-width:650px}
  .chips span{padding:12px 18px;border-radius:8px;background:#fff;border:1px solid rgba(131,115,117,.18);box-shadow:0 12px 26px rgba(137,72,84,.08);font-size:20px;font-weight:800;color:#8c4b57}
  .brand{position:absolute;left:88px;bottom:24px;font-size:16px;font-weight:900;letter-spacing:.24em;color:#8c4b57;opacity:.8}
</style>
</head>
<body>
  <main class="page">
    <div class="grain"></div>
    <section class="top">
      <div>
        <div class="eyebrow">脱水 · 产品实机演示</div>
        <h1>${item.title}</h1>
        <p class="subtitle">${item.subtitle}</p>
      </div>
      <div class="num">${String(index + 1).padStart(2, '0')}<small>REAL UI</small></div>
    </section>
    <div class="chips">${bullets}</div>
    <section class="screen">
      <img src="file:///${screenshot}" />
      <div class="shine"></div>
    </section>
    <div class="brand">DEHYDRATED READER · ${now}</div>
  </main>
</body>
</html>`;
}

async function renderCards(browser) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  for (const [index, item] of pages.entries()) {
    const htmlPath = path.join(OUT_DIR, `${item.id}.html`);
    await fs.writeFile(htmlPath, buildPosterHtml(item, index), 'utf8');
    await page.goto(`file:///${htmlPath.replaceAll('\\', '/')}`, { waitUntil: 'load' });
    await page.screenshot({ path: path.join(CARD_DIR, `${item.id}.png`), fullPage: false });
  }
  await page.close();
}

async function buildIndex() {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><title>脱水产品介绍图</title><style>
body{margin:0;background:#f5f0ef;font-family:Inter,"Microsoft YaHei",Arial,sans-serif;color:#1b1c1b}
main{max-width:1180px;margin:0 auto;padding:48px 24px}
h1{font-size:42px;margin:0 0 12px}
p{color:#514346}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;margin-top:28px}
a{display:block;text-decoration:none;color:inherit;background:white;border-radius:12px;overflow:hidden;border:1px solid rgba(131,115,117,.22);box-shadow:0 18px 40px rgba(137,72,84,.08)}
img{display:block;width:100%}
span{display:block;padding:14px 16px;font-weight:800}
</style></head><body><main><h1>脱水 · 产品介绍图</h1><p>真实界面截图生成，共 9 张，可直接用于项目介绍、发布页和演示材料。</p><div class="grid">
${pages.map((item) => `<a href="cards/${item.id}.png"><img src="cards/${item.id}.png"/><span>${item.title}</span></a>`).join('')}
</div></main></body></html>`;
  await fs.writeFile(path.join(OUT_DIR, 'index.html'), html, 'utf8');
}

await ensureDirs();
const browser = await chromium.launch({ headless: true });
try {
  await captureScreenshots(browser);
  await renderCards(browser);
  await buildIndex();
} finally {
  await browser.close();
}

console.log(JSON.stringify({ outDir: OUT_DIR, screenshots: SCREEN_DIR, cards: CARD_DIR }, null, 2));
