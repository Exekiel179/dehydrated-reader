import { FileText, Share2, Save, Network, Maximize2, Trash2, Sparkles } from 'lucide-react';
import { Analysis } from '@/src/types';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { MermaidDiagram } from './MermaidDiagram';

interface AnalysisViewProps {
  analysis: Analysis | null;
  onDelete: (id: string) => Promise<void>;
  onGenerateStructure: (id: string) => Promise<void>;
}

export function AnalysisView({ analysis, onDelete, onGenerateStructure }: AnalysisViewProps) {
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [structureVisible, setStructureVisible] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  useEffect(() => {
    setStructureVisible(false);
    setIsGeneratingStructure(false);
    setStructureError(null);
  }, [analysis?.id]);

  if (!analysis) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-screen-xl items-center justify-center px-8 py-12">
        <div className="rounded-xl border border-outline-variant/14 bg-surface-container-lowest px-8 py-10 text-center">
          <h2 className="font-headline text-2xl font-bold text-on-surface">还没有可查看的条目</h2>
          <p className="mt-3 text-sm text-on-surface-variant">回到仪表盘粘贴链接，或从知识库里选择一条已有记录。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-screen-2xl mx-auto w-full">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex gap-2 mb-4">
            {analysis.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-tertiary-container text-on-tertiary-container rounded-full text-[10px] font-bold uppercase tracking-wider">
                {tag}
              </span>
            ))}
            {typeof analysis.dehydrationLevel === 'number' ? (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wider">
                脱水 {analysis.dehydrationLevel}
              </span>
            ) : null}
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-headline font-extrabold text-on-surface tracking-tight mb-2"
          >
            {analysis.title}
          </motion.h1>
          <p className="text-on-surface-variant font-medium">来源：<span className="italic">{analysis.source}</span> • {analysis.readTime}</p>
        </div>

        <div className="flex gap-3">
          <button className="px-6 py-3 bg-surface-container-low text-primary font-headline font-bold rounded-xl flex items-center gap-2 hover:bg-surface-container-high transition-colors">
            <Share2 className="w-4 h-4" />
            导出
          </button>
          <button className="px-6 py-3 bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] text-on-primary font-headline font-bold rounded-xl flex items-center gap-2 shadow-[0_12px_32px_rgba(137,72,84,0.12)] hover:scale-[1.02] transition-transform">
            <Save className="w-4 h-4 fill-current" />
            保存到知识库
          </button>
          <button
            className="px-6 py-3 bg-rose-50 text-rose-700 font-headline font-bold rounded-xl flex items-center gap-2 hover:bg-rose-100 transition-colors"
            onClick={async () => {
              if (!window.confirm('删除后会同步删除知识库中的同名条目，确定继续吗？')) {
                return;
              }
              await onDelete(analysis.id);
            }}
            type="button"
          >
            <Trash2 className="w-4 h-4" />
            删除
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-[0_4px_24px_rgba(137,72,84,0.04)] min-h-[600px] overflow-y-auto">
          <div className="flex items-center gap-2 mb-6 text-primary border-b border-outline-variant/20 pb-4">
            <FileText className="w-4 h-4" />
            <h3 className="font-headline font-bold uppercase tracking-widest text-xs">脱水核心笔记</h3>
          </div>
          <div className="markdown-content">
            <ReactMarkdown>{analysis.content}</ReactMarkdown>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
          {analysis.hydration ? (
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0_4px_24px_rgba(137,72,84,0.04)]">
              <div className="flex items-center gap-2 mb-5 text-primary border-b border-outline-variant/20 pb-4">
                <FileText className="w-4 h-4" />
                <h3 className="font-headline font-bold uppercase tracking-widest text-xs">含水量变化</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-outline-variant/14 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">脱水前</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-primary">{analysis.hydration.before.waterPercent}%</p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    信号 {analysis.hydration.before.signalPercent}% · {analysis.hydration.before.label}
                  </p>
                </div>
                <div className="rounded-lg border border-outline-variant/14 bg-surface px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant/50">脱水后</p>
                  <p className="mt-2 font-headline text-3xl font-bold text-tertiary">{analysis.hydration.after.waterPercent}%</p>
                  <p className="mt-2 text-xs text-on-surface-variant">
                    信号 {analysis.hydration.after.signalPercent}% · {analysis.hydration.after.label}
                  </p>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-container">
                <div className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-tertiary" style={{ width: `${analysis.hydration.compressionPercent}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                <span>水分下降 {analysis.hydration.waterDropPercent}%</span>
                <span>正文压缩 {analysis.hydration.compressionPercent}%</span>
                <span>密度 {analysis.hydration.after.densityScore}/100</span>
              </div>
            </div>
          ) : null}

          <div className="bg-surface-container p-6 rounded-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-primary">
                <Network className="w-4 h-4" />
                <h3 className="font-headline font-bold uppercase tracking-widest text-xs">可视化表达</h3>
              </div>
              <button className="text-on-surface-variant hover:text-primary">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            {!structureVisible ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-outline-variant/16 bg-surface-container-lowest px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <p className="text-lg font-bold text-on-surface">按文章结构生成可视化表达</p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-on-surface-variant">
                  这里不会预放通用图。点击后按当前条目内容生成结构图，只表达原文的层级、推进和关系。
                </p>
                {structureError ? <p className="mt-3 text-sm text-rose-700">{structureError}</p> : null}
                <button
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-on-primary disabled:cursor-wait disabled:opacity-70"
                  disabled={isGeneratingStructure}
                  onClick={async () => {
                    try {
                      setStructureError(null);
                      if (!analysis.structureDiagram) {
                        setIsGeneratingStructure(true);
                        await onGenerateStructure(analysis.id);
                      }
                      setStructureVisible(true);
                    } catch (error) {
                      setStructureError(error instanceof Error ? error.message : '结构图生成失败。');
                    } finally {
                      setIsGeneratingStructure(false);
                    }
                  }}
                  type="button"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGeneratingStructure ? '生成中...' : '生成结构图'}
                </button>
              </div>
            ) : analysis.structureDiagram ? (
              <>
                <MermaidDiagram chart={analysis.structureDiagram.mermaid} />
                <p className="mt-3 text-xs leading-5 text-on-surface-variant">{analysis.structureDiagram.caption}</p>
              </>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-outline-variant/16 bg-surface-container-lowest text-sm text-on-surface-variant">
                暂时没有可生成的结构图。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
