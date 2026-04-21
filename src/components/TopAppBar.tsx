import { Bell, CheckCircle2, Menu, Search, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { User, ViewType } from '@/src/types';

interface TopAppBarProps {
  user: User;
  currentView: ViewType;
  activeProfileName: string;
  onMenuToggle: () => void;
  onSettingsClick: () => void;
}

export function TopAppBar({ user, currentView, activeProfileName, onMenuToggle, onSettingsClick }: TopAppBarProps) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const viewTitle = {
    dashboard: '仪表盘',
    analysis: '分析页',
    'output-studio': '产出页',
    'knowledge-base': '知识库',
    'trend-tracker': '热点追踪',
    'social-crawler': '社媒爬虫',
    'rss-feed': 'RSS 订阅',
    settings: '接口设置',
  }[currentView];

  return (
    <>
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-outline-variant/10 bg-background/92 px-4 backdrop-blur md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
          <button
            aria-label="打开导航"
            className="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container lg:hidden"
            onClick={onMenuToggle}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-on-surface-variant/60">脱水</p>
            <h2 className="truncate font-headline text-lg font-bold text-on-surface">{viewTitle}</h2>
          </div>
          <div className="relative hidden w-full max-w-md md:block">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-on-surface-variant/40" />
            </div>
            <input
              type="text"
              placeholder={`搜索${viewTitle}...`}
              className="block w-full rounded-lg border border-transparent bg-surface-container-low pl-10 pr-3 py-2 text-sm transition-all focus:border-primary/10 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>
          <div className="hidden xl:flex flex-col rounded-lg border border-outline-variant/14 bg-surface-container-lowest px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-on-surface-variant/50">当前接口</span>
            <span className="text-sm font-bold text-on-surface">{activeProfileName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-5">
          <div className="flex items-center gap-2">
            <button
              className="hidden rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container md:inline-flex"
              onClick={() => setNoticeVisible(true)}
              type="button"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container" onClick={onSettingsClick} type="button">
              <Settings className="h-5 w-5" />
            </button>
          </div>
          <div className="hidden h-8 w-px bg-outline-variant opacity-20 md:block" />
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-xs font-headline font-bold text-on-surface">{user.name}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-on-surface-variant/55">{user.title}</p>
            </div>
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-primary/15">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
    {noticeVisible ? (
      <div className="fixed bottom-6 left-1/2 z-[70] w-[min(92vw,520px)] -translate-x-1/2 rounded-lg border border-primary/16 bg-surface-container-lowest p-4 text-left shadow-[0_20px_48px_rgba(68,44,49,0.18)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-on-surface">浏览器脱水提醒</p>
            <p className="mt-1 text-sm leading-6 text-on-surface-variant">
              在真实浏览器里完成公众号验证后，点击书签栏里的“发送到脱水”，当前页面正文会发送到本地服务并进入脱水队列。
            </p>
          </div>
          <button className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container" onClick={() => setNoticeVisible(false)} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}
