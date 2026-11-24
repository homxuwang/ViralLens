import { browser } from 'wxt/browser';
import { generate, loadSettings } from './ai';
import { extractSchema } from './models';
import { classifyPage, xPostId } from './page-context';
import { saveContent } from './storage';

function postKey(url: string) {
  const page = classifyPage(url);
  if (page.kind === 'post') return `x:${xPostId(url)}`;
  if (page.kind !== 'note') return;
  const id = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  return `xiaohongshu:${id}`;
}

export async function quickRewrite(expectedUrl: string) {
  const expected = postKey(expectedUrl);
  if (!expected) throw new Error('请打开 X 或小红书的帖子详情。');

  const settings = await loadSettings();
  if (settings.mode !== 'byok') throw new Error('请在 AI 设置中切换到 BYOK 并保存文本模型配置。');

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('找不到当前标签页。');

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const response = await Promise.race([
    browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' }),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('读取超时')), 10000);
    }),
  ]).catch(() => { throw new Error('无法读取当前页，请刷新帖子后重试。'); })
    .finally(() => clearTimeout(timeout));

  if (!response?.ok) throw new Error('无法读取当前帖子，请刷新页面后重试。');
  const { url, notes } = extractSchema.parse(response.data);
  if (postKey(url) !== expected) throw new Error('页面已切换，请刷新识别后重试。');
  const post = notes.find(note => postKey(note.sourceUrl) === expected);
  if (!post) throw new Error('未采集到当前帖子的正文，请展开全文后重试。');
  if (post.noteType === 'video') throw new Error('一键改写支持图文帖。视频可进入单篇分析。');

  const images = settings.vision && (settings.provider === 'openai' || settings.provider === 'custom')
    ? post.images.filter(url => url.startsWith('https://')).slice(0, 4)
    : [];
  if (!(post.title.trim() || post.content.trim() || images.length)) throw new Error('帖子没有可改写的正文。纯图片素材需要配置视觉模型。');

  const input = [
    '面向中文读者生成可在不同内容平台发布的通用图文稿。输出一个一级标题、导语、分段正文和配图建议。',
    '保持原意，使用独立表达。注明未经核实的说法，不补造数字、引语或传播热度。',
    images.length ? '仅引用实际可辨认的图像信息。' : '仅依据提供的文字，不推测图片内容。',
    JSON.stringify({ title: post.title, content: post.content, author: post.author, sourceUrl: post.sourceUrl }),
  ].join('\n\n');
  const body = (await generate(settings, 'rewrite', input, images)).trim();
  if (!body) throw new Error('模型返回了空稿，请重试。');

  const title = body.split('\n').find(line => line.trim())?.replace(/^#+\s*/, '').trim();
  return saveContent({ title: title || post.title || '图文改写', kind: 'quick-rewrite', body, sourceUrl: post.sourceUrl, original: post });
}
