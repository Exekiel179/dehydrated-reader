import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpenText,
  Bolt,
  CheckCircle2,
  Droplets,
  FileText,
  Globe,
  History,
  PlayCircle,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Analysis, HydrationSnapshot, SourceEstimateResponse, User } from '@/src/types';
import { cn } from '@/src/lib/utils';

interface DashboardProps {
  user: User;
  recentAnalyses: Analysis[];
  onEstimateSource: (url: string) => Promise<SourceEstimateResponse>;
  onSelectAnalysis: (id: string) => void;
  queueItems: Array<{
    id: string;
    source: string;
    status: 'queued' | 'processing';
  }>;
  onCreateAnalysis: ({
    source,
    options,
  }: {
    source: string;
    options: { verifyWithSearch: boolean; saveToKnowledgeBase: boolean; dehydrationLevel: number };
  }) => Promise<Analysis>;
}

const PROCESS_STEPS = [
  { title: '抓取正文', description: '读取当前页面主内容与原图。', icon: Globe },
  { title: '评估含水量', description: '估算原文里的噪音、重复和有效信息占比。', icon: Search },
  { title: '结构切分', description: '按段落与层级切成稳定片段。', icon: FileText },
  { title: '脱水生成', description: '压缩成高密度摘要并生成结构图。', icon: Sparkles },
  { title: '完成', description: '回写结果并准备入库。', icon: CheckCircle2 },
];

function getTypeIcon(type: Analysis['type']) {
  switch (type) {
    case 'video':
      return PlayCircle;
    case 'book':
      return BookOpenText;
    case 'article':
      return FileText;
    default:
      return Globe;
  }
}

function getTypeLabel(type: Analysis['type']) {
  switch (type) {
    case 'video':
      return '视频';
    case 'book':
      return '文档';
    case 'article':
      return '文章';
    default:
      return '网页';
  }
}

function getStatusLabel(status: Analysis['status']) {
  switch (status) {
    case 'ready':
      return '已完成';
    case 'essential':
      return '重点';
    default:
      return '待读';
  }
}

function getExcerpt(analysis: Analysis) {
  return analysis.content
    .replace(/[#>*`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110) || analysis.source;
}

function getHydrationTone(waterPercent: number) {
  if (waterPercent >= 70) {
    return {
      text: 'text-primary',
      ring: 'border-primary/18',
      fill: 'from-primary to-primary-container',
      bg: 'bg-primary/8',
    };
  }
  if (waterPercent >= 50) {
    return {
      text: 'text-secondary',
      ring: 'border-secondary/16',
      fill: 'from-secondary-container to-secondary',
      bg: 'bg-secondary-container/55',
    };
  }
  return {
    text: 'text-tertiary',
    ring: 'border-tertiary/16',
    fill: 'from-tertiary/65 to-tertiary',
    bg: 'bg-tertiary/10',
  };
}

function HydrationStatCard({
  label,
  snapshot,
  pending = false,
}: {
  label: string;
  snapshot?: HydrationSnapshot | null;
  pending?: boolean;
}) {
  const tone = getHydrationTone(snapshot?.waterPercent ?? 58);

  return (
    <div className={cn('rounded-lg border px-4 py-4', tone.ring, tone.bg)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface-variant/55">{label}</p>
          <p className={cn('mt-2 font-headline text-3xl font-bold', tone.text)}>
            {pending ? '...' : `${snapshot?.waterPercent ?? '--'}%`}
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-primary">
          <Droplets className="h-5 w-5" />
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/80">
        <motion.div
          animate={{ width: `${pending ? 62 : snapshot?.waterPercent ?? 62}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={cn('h-full rounded-full bg-gradient-to-r', tone.fill)}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-on-surface-variant">
        <span>{pending ? '估算中' : snapshot?.label || '待计算'}</span>
        <span>{pending ? '--' : `信号 ${snapshot?.signalPercent ?? '--'}%`}</span>
      </div>
    </div>
  );
}

function DehydrationProcessPanel({
  visible,
  stepIndex,
  preview,
  finalHydration,
}: {
  visible: boolean;
  stepIndex: number;
  preview: SourceEstimateResponse | null;
  finalHydration: Analysis['hydration'] | null;
}) {
  if (!visible) {
    return null;
  }

  const workingBefore = preview?.hydration;
  const workingAfter = finalHydration?.after || null;
  const displayedWaterLevel = workingAfter
    ? workingAfter.waterPercent
    : workingBefore
      ? stepIndex >= 3
        ? Math.max(14, workingBefore.waterPercent - 24)
        : stepIndex >= 2
          ? Math.max(20, workingBefore.waterPercent - 12)
          : workingBefore.waterPercent
      : stepIndex >= 3
        ? 36
        : stepIndex >= 2
          ? 52
          : 68;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="grid gap-5 rounded-lg border border-primary/14 bg-surface-container-lowest/95 p-5 shadow-[0_18px_36px_rgba(107,60,57,0.08)] lg:grid-cols-[220px_minmax(0,1fr)]"
    >
      <div className="flex flex-col items-center justify-center gap-4 border-b border-outline-variant/12 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        <div className="relative flex h-40 w-28 items-center justify-center overflow-hidden rounded-[2rem] border border-primary/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,241,240,0.98))]">
          <motion.div
            animate={{ height: `${displayedWaterLevel}%` }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary via-primary/80 to-primary-container/70"
          />
          <motion.div
            animate={{ y: [0, -4, 0], opacity: [0.2, 0.36, 0.2] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-x-2 bottom-7 h-6 rounded-full bg-white/24 blur-sm"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-primary">含水量</span>
            <span className="mt-2 font-headline text-4xl font-bold text-on-primary">{displayedWaterLevel}%</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">
            {preview?.title ? preview.title.slice(0, 32) : '准备读取来源'}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {workingAfter
              ? `水分下降 ${finalHydration?.waterDropPercent ?? 0}% ，正文压缩 ${finalHydration?.compressionPercent ?? 0}%`
              : '先评估原文，再把冗余和重复挤出去。'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <HydrationStatCard label="脱水前估算" snapshot={workingBefore} pending={!workingBefore} />
          <HydrationStatCard label="脱水后估算" snapshot={workingAfter} pending={!workingAfter} />
        </div>

        <div className="space-y-3">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = step.icon;
            const completed = Boolean(workingAfter) ? index <= stepIndex : index < stepIndex;
            const active = !workingAfter && index === stepIndex;

            return (
              <div
                key={step.title}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                  completed
                    ? 'border-primary/16 bg-primary/6'
                    : active
                      ? 'border-primary/20 bg-surface-container-low'
                      : 'border-outline-variant/12 bg-surface'
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                    completed ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  )}
                >
                  {completed && index === PROCESS_STEPS.length - 1 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className={cn('h-4 w-4', active && 'animate-pulse')} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-on-surface-variant">{step.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function DashboardView({ user, recentAnalyses, onEstimateSource, onSelectAnalysis, onCreateAnalysis, queueItems }: DashboardProps) {
  const [sourceInput, setSourceInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [message, setMessage] = useState('粘贴链接或拖入文档，立即生成一条新的脱水任务。');
  const [verifyWithSearch, setVerifyWithSearch] = useState(false);
  const [saveToKnowledgeBase, setSaveToKnowledgeBase] = useState(true);
  const [dehydrationLevel, setDehydrationLevel] = useState(68);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processVisible, setProcessVisible] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [processPreview, setProcessPreview] = useState<SourceEstimateResponse | null>(null);
  const [processHydration, setProcessHydration] = useState<Analysis['hydration'] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  const summaryCount = recentAnalyses.length;
  const highlightCards = useMemo(() => recentAnalyses.slice(0, 4), [recentAnalyses]);
  const tagCount = useMemo(() => new Set(recentAnalyses.flatMap((analysis) => analysis.tags)).size, [recentAnalyses]);
  const processingQueueItem = useMemo(() => queueItems.find((item) => item.status === 'processing') || null, [queueItems]);
  const pendingQueueItems = useMemo(() => queueItems.filter((item) => item.status === 'queued'), [queueItems]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isSubmitting || !processVisible) {
      return;
    }

    const timer = window.setInterval(() => {
      setProcessStep((current) => {
        if (current < 2) {
          return current;
        }
        return current === 2 ? 3 : 2;
      });
    }, 980);

    return () => window.clearInterval(timer);
  }, [isSubmitting, processVisible]);

  const submitSource = async (rawSource: string) => {
    const source = rawSource.trim();
    if (!source) {
      setMessage('请输入链接，或拖入 PDF、EPUB、TXT 文件。');
      return;
    }

    const isUrl = /^https?:\/\//i.test(source);

    try {
      setIsSubmitting(true);
      setProcessVisible(isUrl);
      setProcessStep(0);
      setProcessPreview(null);
      setProcessHydration(null);
      setMessage('正在抓取原文并执行脱水，请稍候……');

      if (isUrl) {
        const preview = await onEstimateSource(source);
        if (!mountedRef.current) {
          return;
        }
        setProcessPreview(preview);
        setProcessStep(1);
        setMessage(`原文含水量约 ${preview.hydration.waterPercent}% ，开始进入结构脱水。`);
      }

      setProcessStep(2);
      const shouldAutoOpenAnalysis = queueItems.length === 0 && !processingQueueItem;
      const creationPromise = onCreateAnalysis({
        source,
        options: {
          verifyWithSearch,
          saveToKnowledgeBase,
          dehydrationLevel,
        },
      });
      setSourceInput('');
      setMessage(
        queueItems.length
          ? `已加入队列，前方还有 ${queueItems.length} 项。`
          : '已进入脱水流程。'
      );
      setIsSubmitting(false);

      void creationPromise
        .then((created) => {
          if (!mountedRef.current) {
            return;
          }

          setProcessHydration(created.hydration || null);
          setProcessStep(4);
          setMessage(
            created.hydration
              ? `脱水完成：原文 ${created.hydration.before.waterPercent}% ，结果 ${created.hydration.after.waterPercent}% 。`
              : '新的脱水任务已创建。'
          );
          if (shouldAutoOpenAnalysis) {
            onSelectAnalysis(created.id);
          }

          window.setTimeout(() => {
            if (mountedRef.current) {
              setProcessVisible(false);
            }
          }, 1800);
        })
        .catch((error) => {
          if (!mountedRef.current) {
            return;
          }
          setProcessVisible(false);
          setProcessPreview(null);
          setProcessHydration(null);
          setMessage(error instanceof Error ? error.message : '脱水失败，请稍后重试。');
        });
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setProcessVisible(false);
      setProcessPreview(null);
      setProcessHydration(null);
      setMessage(error instanceof Error ? error.message : '脱水失败，请稍后重试。');
      setIsSubmitting(false);
    }
  };

  const submitFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    for (const file of Array.from(files)) {
      await submitSource(file.name);
    }
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-8 px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <div
          className={cn(
            'relative overflow-hidden rounded-lg border border-outline-variant/14 bg-surface-container-low px-6 py-7 shadow-[0_20px_40px_rgba(107,60,57,0.06)] md:px-8 md:py-8',
            dragActive && 'border-primary/35 bg-[color:rgba(250,240,238,0.96)]'
          )}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            submitFiles(event.dataTransfer.files);
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ backgroundImage: 'linear-gradient(90deg, transparent, color-mix(in oklab, var(--color-primary) 50%, transparent), transparent)' }}
          />
          <div className="absolute right-6 top-6 hidden h-28 w-28 rounded-full border border-primary/10 xl:block" />
          <div className="absolute right-10 top-10 hidden h-28 w-28 rounded-full border border-primary/8 xl:block" />

          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-surface-container-lowest px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                脱水工作台
              </div>
              <div className="max-w-2xl space-y-3">
                <h1 className="font-headline text-3xl font-bold leading-tight text-primary md:text-4xl">
                  长链接、论文 PDF、课程视频，一键脱水。
                </h1>
              </div>
              <form
                className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSource(sourceInput);
                }}
              >
                <input
                  type="text"
                  placeholder="粘贴链接（B站、YouTube、公众号、PDF 链接等）"
                  value={sourceInput}
                  onChange={(event) => setSourceInput(event.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-outline-variant/20 bg-surface-container-lowest px-4 py-4 text-sm shadow-sm outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/12"
                />
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-6 py-4 font-headline text-sm font-bold text-on-primary shadow-[0_12px_32px_rgba(137,72,84,0.12)] transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70"
                  disabled={isSubmitting}
                  type="submit"
                >
                  <Bolt className="h-4 w-4" />
                  {isSubmitting ? '脱水中...' : '开始脱水'}
                </button>
              </form>

              <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                <label className="inline-flex items-center gap-2">
                  <input
                    checked={verifyWithSearch}
                    className="h-4 w-4 accent-[color:var(--color-primary)]"
                    disabled={isSubmitting}
                    onChange={(event) => setVerifyWithSearch(event.target.checked)}
                    type="checkbox"
                  />
                  搜索验证
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    checked={saveToKnowledgeBase}
                    className="h-4 w-4 accent-[color:var(--color-primary)]"
                    disabled={isSubmitting}
                    onChange={(event) => setSaveToKnowledgeBase(event.target.checked)}
                    type="checkbox"
                  />
                  写入本地知识库
                </label>
              </div>

              <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">脱水程度</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      0 更完整，100 更短。当前强度 {dehydrationLevel}/100。
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {dehydrationLevel >= 85 ? '极短' : dehydrationLevel >= 65 ? '高强' : dehydrationLevel >= 35 ? '平衡' : '展开'}
                  </span>
                </div>
                <input
                  className="w-full accent-[color:var(--color-primary)]"
                  disabled={isSubmitting}
                  max={100}
                  min={0}
                  onChange={(event) => setDehydrationLevel(Number(event.target.value))}
                  step={1}
                  type="range"
                  value={dehydrationLevel}
                />
                <div className="mt-2 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span>保留更多上下文</span>
                  <span>只留最高密度要点</span>
                </div>
              </div>

              <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">脱水队列</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      当前处理 {processingQueueItem ? 1 : 0} 项，等待 {pendingQueueItems.length} 项。
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {queueItems.length} 项
                  </span>
                </div>
                {processingQueueItem ? (
                  <div className="mt-3 rounded-lg border border-primary/14 bg-primary/6 px-3 py-3 text-sm text-on-surface">
                    正在处理：{processingQueueItem.source}
                  </div>
                ) : null}
                {pendingQueueItems.length ? (
                  <div className="mt-3 space-y-2">
                    {pendingQueueItems.slice(0, 3).map((item, index) => (
                      <div key={item.id} className="rounded-lg border border-outline-variant/12 bg-surface px-3 py-2 text-sm text-on-surface-variant">
                        队列 {index + 1}：{item.source}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <DehydrationProcessPanel
                visible={processVisible}
                stepIndex={processStep}
                preview={processPreview}
                finalHydration={processHydration}
              />
            </div>

            <div className="grid gap-4 border-t border-outline-variant/14 pt-5 md:grid-cols-[auto_auto_1fr] md:items-center">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/16 bg-surface-container-lowest px-4 py-3 text-left text-sm font-medium text-on-surface transition-colors hover:border-primary/18 hover:text-primary"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <Upload className="h-4 w-4" />
                上传文件
              </button>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <History className="h-4 w-4" />
                <span>已生成 {summaryCount.toLocaleString()} 份脱水结果</span>
              </div>
              <p className="text-sm text-on-surface-variant/80">{message}</p>
            </div>
          </div>

          <input
            className="hidden"
            multiple
            onChange={(event) => submitFiles(event.target.files)}
            ref={fileInputRef}
            type="file"
          />
        </div>

        <div className="flex flex-col rounded-lg border border-outline-variant/14 bg-surface px-6 py-6 shadow-[0_18px_32px_rgba(107,60,57,0.04)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-on-surface-variant/60">本周概览</p>
              <h3 className="mt-2 font-headline text-xl font-bold text-on-surface">脱水效率面板</h3>
            </div>
            <span className="rounded-full bg-tertiary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-tertiary">
              活跃状态
            </span>
          </div>
          <div className="flex-1 space-y-6">
            <div>
              <div className="mb-2 flex justify-between text-xs">
                <span className="font-medium text-on-surface-variant">脱水熟练度</span>
                <span className="font-bold text-primary">{user.proficiency}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${user.proficiency}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/48">节省时间</span>
                <span className="font-headline text-3xl font-bold text-primary">{user.timeSaved}</span>
              </div>
              <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/48">关键洞察</span>
                <span className="font-headline text-3xl font-bold text-primary">{user.keyInsights}</span>
              </div>
            </div>
            <div className="rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/48">趋势</p>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    当前共有 {summaryCount} 条记录，累计沉淀 {tagCount} 个标签。
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-primary/55" />
              </div>
            </div>
          </div>
          <button className="mt-6 w-full rounded-lg border border-primary/18 py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-container-low" type="button">
            查看统计
          </button>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-on-surface-variant/60">最近脱水</p>
            <h3 className="mt-2 font-headline text-2xl font-bold text-on-surface">最新生成的简报</h3>
          </div>
          <button className="text-sm font-bold text-primary" type="button">
            查看库
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {highlightCards.map((analysis) => {
            const Icon = getTypeIcon(analysis.type);
            return (
              <motion.div
                key={analysis.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelectAnalysis(analysis.id)}
                className="group cursor-pointer rounded-lg border border-outline-variant/14 bg-surface-container-lowest p-5 transition-all hover:border-primary/18 hover:shadow-[0_16px_30px_rgba(107,60,57,0.06)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div
                    className={cn(
                      'rounded-lg p-2',
                      analysis.type === 'video'
                        ? 'bg-secondary-container/35 text-secondary'
                        : analysis.type === 'book'
                          ? 'bg-tertiary/12 text-tertiary'
                          : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/40">{analysis.timestamp}</span>
                </div>
                <h4 className="mb-2 line-clamp-2 font-headline text-lg font-bold text-on-surface transition-colors group-hover:text-primary">
                  {analysis.title}
                </h4>
                <p className="mb-5 line-clamp-3 text-sm leading-6 text-on-surface-variant">
                  {getExcerpt(analysis)}
                </p>
                {analysis.hydration ? (
                  <div className="mb-4 flex items-center justify-between rounded-lg border border-outline-variant/12 bg-surface px-3 py-2 text-xs text-on-surface-variant">
                    <span>含水量 {analysis.hydration.before.waterPercent}% → {analysis.hydration.after.waterPercent}%</span>
                    <span className="font-bold text-primary">-{analysis.hydration.waterDropPercent}%</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-surface-container px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-on-surface-variant/65">
                      {getTypeLabel(analysis.type)}
                    </span>
                    <span className="rounded-md bg-primary/8 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                      {getStatusLabel(analysis.status)}
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-on-surface-variant/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </motion.div>
            );
          })}

          <button
            className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/30 bg-surface px-6 text-center text-on-surface-variant transition-colors hover:border-primary/28 hover:bg-surface-container-low"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <span className="text-sm font-bold text-on-surface">新增来源</span>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">支持 PDF、EPUB、TXT、视频链接和长文章链接。</p>
          </button>
        </div>
      </section>
    </div>
  );
}
