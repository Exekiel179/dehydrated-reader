# Dehydrated Reader

一个可运行的中文“脱水阅读器”原型：输入网址，抓取正文，切分内容，用 Anthropic 兼容接口生成高密度摘要，并可选做搜索核验与本地知识库写入。

## 当前能力

- 中文仪表盘、分析页、RSS、知识库、设置页
- 多组 AI 配置切换
- 支持 `Crawl4AI / Firecrawl / Readability` 三种抓取模式
- 支持配置联通性测试
- 摘要结果包含基于正文结构生成的 Mermaid 结构图
- 可选把结果写入本地 `sqlite` 知识库
- 后端已切换为 `agentic-rag` 编排模式：代理会决定是否检索知识库、是否做搜索核验、是否写回知识库

## RAG 现状

当前已经有可运行的本地 RAG 基线，但还不是最终形态。

现在已经有的是：

- SQLite 知识库存储：`data/knowledge-base.sqlite`
- 抓取、切分、摘要、可选搜索验证
- 使用本地 embedding 模型生成向量
- 向量召回与词项召回混合排序
- 使用本地 reranker 对候选结果二次重排
- 检索结果会作为上下文参与当前摘要

当前还没有的是：

- chunk 级引用对齐
- 多路查询扩展

## 本地启动

前置要求：

- Node.js 20+
- Python 3.11+（只在使用 Crawl4AI 时需要）

### 1. 安装 Node 依赖

```bash
npm install
```

### 2. 准备环境变量

复制 `.env.example` 为 `.env`，填入你的 AI 接口配置。

### 3. 预热本地模型

```bash
npm run setup:models
```

这一步会提前下载：

- embedding 模型
- reranker 模型

模型缓存位置：

- `.runtime/hf-cache`

### 4. 如需项目内 Crawl4AI 运行时

```powershell
npm run setup:crawl4ai
```

这会在仓库内创建：

- `.runtime/crawl4ai/.venv`

向量模型首次运行时会自动下载到：

- `.runtime/hf-cache`

如果首次向量模型加载过慢，服务会在超时后自动退回词项检索，避免整条请求一直阻塞。超时时间可通过 `EMBEDDING_TIMEOUT_MS` 调整。

应用启动时会优先使用仓库内运行时；如果没有，再回退到你自定义的 `CRAWL4AI_PYTHON` 或外部 `CRAWL4AI_ROOT`。

### 5. 启动

```bash
npm run dev
```

如果你只想一键启动前端：

```bash
npm run start:frontend
```

Windows 下也可以直接双击：

- `start-frontend.bat`

## 部署说明

为了方便分发到 GitHub，项目现在采用：

1. Node 依赖全部放在仓库内 `package.json`
2. embedding / reranker 模型缓存放在仓库内 `.runtime`
3. Crawl4AI 运行时优先放在仓库内 `.runtime`
4. 外部本地环境只作为回退方案，不再是唯一依赖

如果你不想依赖本地 Python 环境，也可以在部署时只启用：

- `Firecrawl`
- `Readability`

这样部署会更轻。
