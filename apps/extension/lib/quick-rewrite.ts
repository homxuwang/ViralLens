import { browser } from 'wxt/browser';
import { generate, loadSettings } from './ai';
import { extractSchema, type NoteContent } from './models';
import { classifyPage, isKnownPlatformHost, isReadableWebUrl, xPostId } from './page-context';
import { saveContent } from './storage';

export type QuickAction = 'rewrite' | 'summarize';
export type TargetPlatform = 'wechat' | 'xiaohongshu' | 'x';
export type RewriteLevel = 'light' | 'medium' | 'deep';

export interface QuickTransformOptions {
  action?: QuickAction;
  target?: TargetPlatform;
  level?: RewriteLevel;
  extraNote?: string;
}

export const TARGET_LABELS: Record<TargetPlatform, string> = {
  wechat: '微信公众号',
  xiaohongshu: '小红书',
  x: 'X (Twitter)',
};

export const ACTION_LABELS: Record<QuickAction, string> = {
  rewrite: '改写',
  summarize: '总结',
};

export const LEVEL_DESCRIPTIONS: Record<QuickAction, Record<RewriteLevel, { label: string; hint: string }>> = {
  rewrite: {
    light: { label: '轻度润色', hint: '忠实保留原意与结构，主要去翻译腔和适配阅读节奏' },
    medium: { label: '中度重构（推荐）', hint: '打散原句式，用独立真人表达按目标平台重新组织' },
    deep: { label: '深度再创作', hint: '换切入角度重搭框架，补充场景与启发，不虚构事实' },
  },
  summarize: {
    light: { label: '精简速览', hint: '30 秒抓重点，提炼 3–5 条最核心事实与结论' },
    medium: { label: '结构化干货（推荐）', hint: '梳理核心主张、关键依据与结论，按目标平台排版' },
    deep: { label: '深度提炼', hint: '提炼要点并拆解隐含逻辑、适用边界与可落地参考' },
  },
};

export const ANTI_AI_GUIDELINES = [
  '去 AI 味写作约束：',
  '1. 直接说人话，第一句就切入具体观察、问题或结论，禁用“在当今……时代”“随着……发展”“不可否认”“值得注意的是”“总而言之”“综上所述”“一文读懂”“干货满满”“建议收藏”“深度解析”“重磅”“赋能”“闭环”等套话。',
  '2. 禁止机械排比和反复套用“不是……而是……”“与其说……不如说……”；不要每段都用“首先、其次、再次、最后”或“**四字标题**：解释”的模板化句式。',
  '3. 保留原文的具体细节、案例、数字和真实体感，不要把具体内容洗成空洞方法论；长短句自然交错，像真人在写给同行或朋友看。',
  '4. 严守事实边界：绝不补造数字、引语、来源或传播热度；未经证实的说法自然归因给原作者，不强行拔高升华，不硬凑鸡汤结尾。',
].join('\n');

const TARGET_INSTRUCTIONS: Record<TargetPlatform, string> = {
  wechat: '目标平台形式：微信公众号文章。输出 1 个自然克制的主标题（# 标题）、简短导语、2–4 个有推进感的分节小标题（##）与适合手机阅读的短段落正文（每段 2–4 句）、自然收尾。避免公文腔和教科书式总结。',
  xiaohongshu: '目标平台形式：小红书图文笔记。输出 2–3 个真实不标题党的备选标题、口语化分段正文（像真人在分享实测或思考，每段 1–3 句）、末尾 3–5 个精准话题标签（#标签）及简短配图建议。严禁满屏 emoji 堆砌（全文最多 0–3 个点缀，禁止每行开头放 emoji）。',
  x: '目标平台形式：X（Twitter）帖子。信息量精炼时输出 1 条高密度单帖（约 280 字内）；内容较丰富时拆分为 3–6 条编号串推（1/、2/……）。首句直接抛核心信息或具体反差，短句克制、去翻译腔、不滥用感叹号和 hashtag（0–2 个或不用）。',
};

const LEVEL_INSTRUCTIONS: Record<QuickAction, Record<RewriteLevel, string>> = {
  rewrite: {
    light: '任务与改写程度：轻度改写。尽量忠实保留原文核心信息、论据和逻辑顺序，重点去除翻译腔、生硬句式和平台水土不服，改为自然流畅的中文表达，不大幅增删观点。',
    medium: '任务与改写程度：中度重构。提取原文核心观点与事实后，打散原有句式和段落顺序，按目标平台读者的阅读节奏完全用独立表达重写，不照抄原句。',
    deep: '任务与改写程度：深度再创作。以原文为切入点，重新设计叙事角度与文章框架，强化观点对比、适用场景与实操启发；所有延伸判断必须与原文事实明确区分，绝不编造案例或数据。',
  },
  summarize: {
    light: '任务与总结程度：精简总结。快速提炼最核心的 3–5 个关键结论与事实要点，删去铺垫和冗余细节，让读者 30 秒抓住重点，并按目标平台习惯呈现。',
    medium: '任务与总结程度：结构化总结。清晰梳理原文的核心主张、关键依据/案例与主要结论，剔除水分，按目标平台的阅读习惯重组为易读内容。',
    deep: '任务与总结程度：深度总结。除准确提炼原文核心要点外，进一步拆解背后的隐含前提、适用边界与可复用参考，清楚区分“原文事实”与“延伸归纳”。',
  },
};

export function buildQuickTransformPrompt(
  post: Pick<NoteContent, 'platform' | 'title' | 'content' | 'author' | 'sourceUrl'>,
  options: QuickTransformOptions = {},
  hasImages = false,
): string {
  const action: QuickAction = options.action ?? 'rewrite';
  const target: TargetPlatform = options.target ?? 'wechat';
  const level: RewriteLevel = options.level ?? 'medium';
  const extra = options.extraNote?.trim();

  return [
    TARGET_INSTRUCTIONS[target],
    LEVEL_INSTRUCTIONS[action][level],
    ANTI_AI_GUIDELINES,
    hasImages ? '仅引用实际可辨认的图像信息，不脑补看不清的细节。' : '仅依据提供的文字内容，不推测未提供图片或视频的画面。',
    extra ? `用户补充要求：${extra}` : '',
    `来源素材：\n${JSON.stringify({ platform: post.platform, title: post.title, content: post.content, author: post.author, sourceUrl: post.sourceUrl })}`,
  ].filter(Boolean).join('\n\n');
}

export function canQuickTransformUrl(raw: string): boolean {
  const page = classifyPage(raw);
  if (page.kind === 'post' || page.kind === 'note' || page.kind === 'article') return true;
  if (page.kind === 'creator') return false;
  return isReadableWebUrl(raw) && !isKnownPlatformHost(raw);
}

function pageKey(url: string): string | undefined {
  const page = classifyPage(url);
  if (page.kind === 'post') return `x:${xPostId(url)}`;
  if (page.kind === 'note') {
    const id = new URL(url).pathname.split('/').filter(Boolean).at(-1);
    return `xiaohongshu:${id}`;
  }
  if (page.kind === 'article') {
    const parsed = new URL(url);
    const biz = parsed.searchParams.get('__biz');
    return biz
      ? `wechat:${parsed.pathname}?${biz}&${parsed.searchParams.get('mid') ?? ''}&${parsed.searchParams.get('idx') ?? ''}`
      : `wechat:${parsed.pathname}`;
  }
  if (page.kind === 'creator') return undefined;
  if (isReadableWebUrl(url) && !isKnownPlatformHost(url)) {
    const parsed = new URL(url);
    return `web:${parsed.origin}${parsed.pathname}`;
  }
  return undefined;
}

// Self-contained DOM reader injected only on generic http(s) pages via activeTab + scripting.
function extractGenericInPage() {
  const url = location.href;
  const safeUrl = (raw: string | null | undefined) => {
    try {
      const parsed = new URL(raw ?? '', url);
      return raw && (parsed.protocol === 'https:' || parsed.protocol === 'http:') ? parsed.href : null;
    } catch { return null; }
  };
  const sourceRoot = document.querySelector('article, main, [role="main"]') ?? document.body;
  const clone = sourceRoot.cloneNode(true) as Element;
  for (const el of clone.querySelectorAll('script, style, noscript, nav, header, footer, aside, [aria-hidden="true"]')) el.remove();
  const blocks = Array.from(clone.querySelectorAll('h1, h2, h3, h4, p, li, blockquote'))
    .filter(el => !el.querySelector('p, li, blockquote, h1, h2, h3, h4'))
    .map(el => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);
  const content = (blocks.length ? blocks.join('\n\n') : (clone.textContent?.replace(/\n{3,}/g, '\n\n').trim() ?? '')).slice(0, 20000);
  const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim()
    || document.querySelector('article h1, main h1, h1')?.textContent?.trim()
    || document.title.trim();
  const author = document.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() || null;
  const images = [...new Set(
    Array.from(sourceRoot.querySelectorAll('img'))
      .filter(img => !img.closest('.avatar, .avatar-wrapper, nav, header, footer'))
      .map(img => safeUrl(img.getAttribute('data-src') || img.getAttribute('src')))
      .filter((v): v is string => Boolean(v)),
  )].slice(0, 9);
  const parsed = new URL(url);
  const item = {
    id: `web:${parsed.origin}${parsed.pathname}`,
    platform: 'web' as const,
    sourceUrl: url,
    author,
    title,
    content,
    noteType: 'article' as const,
    images,
    video: null,
    tags: [],
    publishedAt: document.querySelector('meta[property="article:published_time"]')?.getAttribute('content')?.trim()
      || document.querySelector('time')?.getAttribute('datetime')
      || null,
    metrics: { likes: null, collects: null, comments: null, shares: null },
    extractionMethod: 'visible-dom' as const,
    extractionConfidence: 'low' as const,
    capturedAt: new Date().toISOString(),
  };
  return {
    ok: true,
    data: {
      url,
      author,
      avatar: null,
      bio: null,
      notes: content || title ? [item] : [],
      warnings: content ? ['已提取当前网页可见正文。'] : ['未读取到网页正文。'],
    },
  };
}

async function captureActivePage(tabId: number, expectedUrl: string) {
  if (classifyPage(expectedUrl).platform !== 'unknown') {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const response = await Promise.race([
      browser.tabs.sendMessage(tabId, { type: 'EXTRACT_PAGE' }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('读取超时')), 10000);
      }),
    ]).catch(() => { throw new Error('无法读取当前页，请刷新页面后重试。'); })
      .finally(() => clearTimeout(timeout));
    if (!response?.ok) throw new Error(response?.error ?? '无法读取当前页面，请刷新页面后重试。');
    return extractSchema.parse(response.data);
  }

  if (!browser.scripting?.executeScript) {
    throw new Error('当前环境不支持读取普通网页，请先打开 X、小红书或公众号页面，或手动粘贴素材。');
  }
  const results = await browser.scripting.executeScript({
    target: { tabId },
    func: extractGenericInPage,
  }).catch(() => {
    throw new Error('无法读取当前网页。请先点击浏览器工具栏 ViralLens 图标授权读取，或手动粘贴正文。');
  });
  const payload = results[0]?.result as { ok?: boolean; data?: unknown } | undefined;
  if (!payload?.ok || !payload.data) throw new Error('未能提取当前网页正文，请确认页面已加载完成。');
  return extractSchema.parse(payload.data);
}

export function formatQuickRecordLabel(meta?: { action?: QuickAction; target?: TargetPlatform; level?: RewriteLevel }): string {
  if (!meta?.target || !meta?.action) return '图文改写';
  const levelLabel = meta.level ? LEVEL_DESCRIPTIONS[meta.action][meta.level].label.replace('（推荐）', '') : '';
  return `${TARGET_LABELS[meta.target]}${ACTION_LABELS[meta.action]}${levelLabel ? ` · ${levelLabel}` : ''}`;
}

export async function quickRewrite(expectedUrl: string, options: QuickTransformOptions = {}) {
  const expected = pageKey(expectedUrl);
  if (!expected) throw new Error('请打开 X 帖子、小红书笔记、公众号文章或可读网页。');

  const action: QuickAction = options.action ?? 'rewrite';
  const target: TargetPlatform = options.target ?? 'wechat';
  const level: RewriteLevel = options.level ?? 'medium';

  const settings = await loadSettings();
  if (settings.mode === 'saas' && (!settings.workerUrl || !settings.token)) {
    throw new Error('请在「AI 设置」中配置 BYOK 文本模型，或填写完整的 SaaS 服务配置。');
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('找不到当前标签页。');

  const { url, notes } = await captureActivePage(tab.id, expectedUrl);
  if (pageKey(url) !== expected) throw new Error('页面已切换，请刷新识别后重试。');
  const post = notes.find(note => pageKey(note.sourceUrl) === expected) ?? notes[0];
  if (!post) throw new Error('未采集到当前页面的正文，请展开全文后重试。');
  if (post.noteType === 'video') throw new Error('一键改写/总结暂不支持纯视频帖。视频请进入单篇分析（可粘贴字幕）。');

  const images = settings.mode === 'byok' && settings.vision && (settings.provider === 'openai' || settings.provider === 'custom')
    ? post.images.filter(img => img.startsWith('https://')).slice(0, 4)
    : [];
  if (!(post.title.trim() || post.content.trim() || images.length)) {
    throw new Error('当前页面没有可处理的正文。纯图片素材需要开启兼容视觉模型。');
  }

  const input = buildQuickTransformPrompt(post, { action, target, level, extraNote: options.extraNote }, images.length > 0);
  const body = (await generate(settings, 'rewrite', input, images)).trim();
  if (!body) throw new Error('模型返回了空稿，请重试。');

  const title = body.split('\n').find(line => line.trim())?.replace(/^#+\s*/, '').trim();
  const fallbackTitle = `${TARGET_LABELS[target]}${ACTION_LABELS[action]}`;
  return saveContent({
    title: title || post.title || fallbackTitle,
    kind: 'quick-rewrite',
    body,
    sourceUrl: post.sourceUrl,
    original: post,
    meta: { action, target, level },
  });
}
