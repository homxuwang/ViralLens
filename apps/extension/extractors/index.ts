import { classifyPage, xPostId } from '../lib/page-context';
import type { ExtractResult, NoteContent } from '../lib/models';
export interface PlatformExtractor {
  canHandle(url: string): boolean;
  extractCurrentPage(doc: Document, url: string): ExtractResult;
}
export function parseMetric(text: string | null): number | null {
  const m = text?.replace(/,/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*(万|千|[kKwW])?\+?$/);
  return m ? Math.round(Number(m[1]) * (/万|w/i.test(m[2] ?? '') ? 10000 : /千|k/i.test(m[2] ?? '') ? 1000 : 1)) : null;
}
const text = (root: ParentNode, selector: string) => root.querySelector(selector)?.textContent?.trim() || null;
const safeUrl = (raw: string | null | undefined, base: string) => { try { const u = new URL(raw ?? '', base); return raw && /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };
function note(root: ParentNode, url: string, platform: NoteContent['platform']): NoteContent {
  const images = Array.from(root.querySelectorAll('img')).map(img => safeUrl(img.getAttribute('data-src') || img.getAttribute('src'), url)).filter((v): v is string => !!v);
  const videoEl = root.querySelector('video');
  const video = safeUrl(videoEl?.getAttribute('src') || videoEl?.querySelector('source')?.getAttribute('src'), url);
  return {
    id: `${platform}:${new URL(url).pathname}`, platform, sourceUrl: url,
    author: text(root, '.author .name, .author-wrapper .username, .nickname, #js_name'),
    title: text(root, '#detail-title, .title, #activity-name') ?? '',
    content: text(root, '#detail-desc, .note-text, #js_content') ?? '',
    noteType: platform === 'wechat' ? 'article' : videoEl || root.querySelector('.video-icon, .play-icon') ? 'video' : images.length ? 'image' : 'unknown',
    images: [...new Set(images)], video, tags: Array.from(root.querySelectorAll('.tag, a.tag')).map(e => e.textContent?.trim() ?? '').filter(Boolean),
    publishedAt: text(root, '.date, .publish-time, #publish_time'),
    metrics: { likes: parseMetric(text(root, '.like-wrapper .count, .like-wrapper .count-text')), collects: parseMetric(text(root, '.collect-wrapper .count')), comments: parseMetric(text(root, '.chat-wrapper .count, .comment-wrapper .count')), shares: null },
    extractionMethod: 'visible-dom', extractionConfidence: 'low', capturedAt: new Date().toISOString(),
  };
}
export class XiaohongshuExtractor implements PlatformExtractor {
  canHandle(url: string) { return classifyPage(url).platform === 'xiaohongshu'; }
  extractCurrentPage(doc: Document, url: string): ExtractResult {
    const creator = classifyPage(url).kind === 'creator';
    const author = text(doc, '.user-name, .nickname, .author .name');
    const roots = creator ? Array.from(doc.querySelectorAll('section.note-item, .feeds-container .note-item')) : [doc.querySelector('.note-detail-mask .note-container, #noteContainer, .note-container') ?? doc];
    const notes: NoteContent[] = [];
    for (const root of roots) {
      const href = creator ? safeUrl(root.querySelector('a[href*="/explore/"], a[href*="/discovery/item/"]')?.getAttribute('href'), url) : url;
      if (!href) continue;
      const item = note(root, href, 'xiaohongshu');
      item.author ??= author;
      if (item.title || item.content || item.images.length) notes.push(item);
    }
    return { url, author, bio: text(doc, '.user-desc'), notes: [...new Map(notes.map(n => [n.id, n])).values()], warnings: ['仅包含当前 DOM 已加载内容，不代表全部历史作品；缺失指标为未知。', ...(notes.length ? [] : ['未找到笔记，请确认页面已加载或通过手动文本导入。'])] };
  }
}
export class WechatArticleExtractor implements PlatformExtractor {
  canHandle(url: string) { return classifyPage(url).platform === 'wechat'; }
  extractCurrentPage(doc: Document, url: string): ExtractResult {
    const item = note(doc.querySelector('#img-content') ?? doc, url, 'wechat');
    return { url, author: item.author, bio: null, notes: item.content ? [item] : [], warnings: item.content ? ['仅提取当前文章 DOM，互动指标可能不可见。'] : ['文章正文未加载或页面不可访问。'] };
  }
}
class XPostExtractor implements PlatformExtractor {
  canHandle(url: string) { return Boolean(xPostId(url)); }

  extractCurrentPage(doc: Document, url: string): ExtractResult {
    const id = xPostId(url);
    const post = Array.from(doc.querySelectorAll('article[data-testid="tweet"]')).find(article => {
      const timestamp = article.querySelector('time');
      const link = timestamp?.closest('a');
      const permalink = safeUrl(link?.getAttribute('href'), url);
      return permalink && xPostId(permalink) === id;
    });
    const content = post && Array.from(post.querySelectorAll('[data-testid="tweetText"]'))
      .find(element => element.closest('article') === post && !element.closest('[role="link"]'))?.textContent?.trim();
    if (!post || !content) return { url, author: null, bio: null, notes: [], warnings: ['当前帖子正文未加载，请展开帖子后重试，或手动粘贴原文。'] };

    const permalink = new URL(url);
    permalink.pathname = permalink.pathname.replace(/(\/status\/\d+).*$/, '$1');
    permalink.search = '';
    permalink.hash = '';
    const item = note(post, permalink.href, 'x');
    item.id = `x:${id}`;
    item.content = content;
    item.title = content.split('\n')[0]?.slice(0, 80) ?? '';
    item.author = text(post, '[data-testid="User-Name"] a');
    item.publishedAt = post.querySelector('time')?.getAttribute('datetime') ?? null;
    item.images = Array.from(post.querySelectorAll('[data-testid="tweetPhoto"] img')).map(img => safeUrl(img.getAttribute('src'), url)).filter((value): value is string => Boolean(value));
    item.noteType = post.querySelector('video') ? 'video' : item.images.length ? 'image' : 'unknown';
    return { url, author: item.author, bio: null, notes: [item], warnings: ['已读取当前帖子可见正文。长帖请先展开全文。'] };
  }
}
const adapters: PlatformExtractor[] = [new XiaohongshuExtractor(), new WechatArticleExtractor(), new XPostExtractor()];
export function extractPage(doc: Document, url: string): ExtractResult {
  const adapter = adapters.find(a => a.canHandle(url));
  if (!adapter) throw new Error('请打开小红书笔记、博主主页、公众号文章或 X 帖子详情。');
  return adapter.extractCurrentPage(doc, url);
}
