import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Cookie } from 'playwright';
import type { SocialAuthCaptureResponse } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const AUTH_RUNTIME_ROOT = path.join(PROJECT_ROOT, '.runtime', 'auth-assistant');

type AuthProvider = 'xhs' | 'douyin' | 'douyin-live';

const AUTH_CONFIG: Record<
  AuthProvider,
  {
    url: string;
    title: string;
    domains: string[];
    requiredCookies: string[];
    loginCookies: string[];
  }
> = {
  xhs: {
    url: 'https://www.xiaohongshu.com/explore',
    title: 'Spider_XHS 登录助手',
    domains: ['xiaohongshu.com'],
    requiredCookies: ['a1'],
    loginCookies: ['web_session', 'gid', 'webId'],
  },
  douyin: {
    url: 'https://www.douyin.com/',
    title: 'DouYin_Spider 登录助手',
    domains: ['douyin.com'],
    requiredCookies: ['s_v_web_id'],
    loginCookies: ['sessionid_ss', 'passport_csrf_token', 'uid_tt', 'sid_guard'],
  },
  'douyin-live': {
    url: 'https://live.douyin.com/',
    title: 'DouYin_Spider 直播登录助手',
    domains: ['douyin.com'],
    requiredCookies: ['ttwid'],
    loginCookies: ['sessionid_ss', 'passport_csrf_token', 'uid_tt', 'sid_guard'],
  },
};

function cookieMatchesDomain(cookie: Cookie, domains: string[]) {
  return domains.some((domain) => cookie.domain === domain || cookie.domain.endsWith(`.${domain}`));
}

function buildCookieString(cookies: Cookie[]) {
  const pairs = new Map<string, string>();
  for (const cookie of cookies) {
    if (!pairs.has(cookie.name)) {
      pairs.set(cookie.name, cookie.value);
    }
  }
  return Array.from(pairs.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function hasRequiredCookies(cookies: Cookie[], requiredCookies: string[]) {
  const names = new Set(cookies.map((cookie) => cookie.name));
  return requiredCookies.every((name) => names.has(name));
}

function hasLoginSignal(cookies: Cookie[], loginCookies: string[]) {
  const names = new Set(cookies.map((cookie) => cookie.name));
  return loginCookies.some((name) => names.has(name));
}

export async function capturePlatformAuth(provider: AuthProvider): Promise<SocialAuthCaptureResponse> {
  const config = AUTH_CONFIG[provider];
  const profileDir = path.join(AUTH_RUNTIME_ROOT, provider);
  await fs.mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    locale: 'zh-CN',
    viewport: { width: 1440, height: 960 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(config.url, { waitUntil: 'domcontentloaded' });
    await page.bringToFront().catch(() => undefined);

    const timeoutAt = Date.now() + 10 * 60 * 1000;
    while (Date.now() < timeoutAt) {
      const cookies = (await context.cookies()).filter((cookie) => cookieMatchesDomain(cookie, config.domains));
      if (cookies.length && hasRequiredCookies(cookies, config.requiredCookies) && hasLoginSignal(cookies, config.loginCookies)) {
        return {
          provider,
          cookieString: buildCookieString(cookies),
          message: `${config.title} 已捕获登录态并写回。`,
        };
      }
      await page.waitForTimeout(1500);
    }

    throw new Error('等待登录超时。请完成登录后重试，或继续使用手动粘贴 cookie。');
  } finally {
    await context.close().catch(() => undefined);
  }
}
