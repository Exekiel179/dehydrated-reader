import { BarChart3, Database, Droplets, FileOutput, LayoutDashboard, Plus, Radar, Rss, Search, Settings, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { ViewType } from '@/src/types';

interface SidebarProps {
  currentView: ViewType;
  isOpen: boolean;
  onClose: () => void;
  onNewAnalysis: () => void;
  onViewChange: (view: ViewType) => void;
}

export function Sidebar({ currentView, isOpen, onClose, onNewAnalysis, onViewChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
    { id: 'analysis', label: '分析页', icon: BarChart3 },
    { id: 'output-studio', label: '产出页', icon: FileOutput },
    { id: 'knowledge-base', label: '知识库', icon: Database },
    { id: 'knowledge-search', label: '知识搜索', icon: Search },
    { id: 'trend-tracker', label: '热点追踪', icon: Radar },
    { id: 'social-crawler', label: '社媒爬虫', icon: Search },
    { id: 'rss-feed', label: 'RSS 订阅', icon: Rss },
    { id: 'settings', label: '接口设置', icon: Settings },
  ] as const;

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-outline-variant/20 bg-surface px-4 py-6 shadow-[18px_0_50px_rgba(107,60,57,0.08)] transition-transform duration-300 lg:w-64 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="mb-8 flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] text-on-primary shadow-[0_12px_32px_rgba(137,72,84,0.12)]">
            <Droplets className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-headline text-lg font-bold text-primary">脱水</h1>
          </div>
        </div>
        <button
          aria-label="关闭导航"
          className="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container lg:hidden"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium tracking-wide transition-all duration-300',
                isActive
                  ? 'border border-primary/15 bg-surface-container-lowest text-primary shadow-[0_10px_20px_rgba(107,60,57,0.06)]'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-primary hover:translate-x-1'
              )}
              type="button"
            >
              <item.icon className={cn('h-5 w-5', isActive && 'text-primary')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-container))] px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-[0_12px_32px_rgba(137,72,84,0.12)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
        onClick={onNewAnalysis}
        type="button"
      >
        <Plus className="h-4 w-4" />
        <span>新建脱水</span>
      </button>
    </aside>
  );
}
