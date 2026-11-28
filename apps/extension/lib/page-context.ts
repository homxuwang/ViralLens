export function classifyPage(raw: string) {
  const unknown = { platform: 'unknown', kind: 'unsupported', label: '暂不支持的页面' } as const;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return unknown;
    if (xPostId(url.href)) return { platform: 'x', kind: 'post', label: 'X · 帖子' };
    if (url.hostname === 'www.xiaohongshu.com') {
      if (/^\/user\/profile\/[^/]+/.test(url.pathname)) return { platform: 'xiaohongshu', kind: 'creator', label: '小红书 · 博主主页' };
      if (/^\/(explore|discovery\/item)\/[^/]+/.test(url.pathname)) return { platform: 'xiaohongshu', kind: 'note', label: '小红书 · 笔记' };
    }
    if (url.hostname === 'mp.weixin.qq.com' && (/^\/s\/[^/]+/.test(url.pathname) || (url.pathname === '/s' && url.searchParams.has('__biz')))) return { platform: 'wechat', kind: 'article', label: '微信公众号 · 文章' };
    return unknown;
  } catch { return unknown; }
}

export function xPostId(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname)) return;
    return url.pathname.match(/^\/(?:i\/web|[A-Za-z0-9_]+)\/status\/(\d+)(?:\/|$)/)?.[1];
  } catch { return; }
}

const KNOWN_PLATFORM_HOSTS = new Set([
  'www.xiaohongshu.com',
  'mp.weixin.qq.com',
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
]);

export function isKnownPlatformHost(raw: string): boolean {
  try {
    return KNOWN_PLATFORM_HOSTS.has(new URL(raw).hostname);
  } catch { return false; }
}

export function isReadableWebUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch { return false; }
}
