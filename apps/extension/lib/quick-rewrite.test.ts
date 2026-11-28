import { beforeEach, expect, it, vi } from 'vitest';
import type { NoteContent } from './models';

const { send, execScript, generate, save, load } = vi.hoisted(() => ({
  send: vi.fn(),
  execScript: vi.fn(),
  generate: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
}));
vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { query: async () => [{ id: 42 }], sendMessage: send },
    scripting: { executeScript: execScript },
  },
}));
vi.mock('./ai', () => ({ generate, loadSettings: load }));
vi.mock('./storage', () => ({ saveContent: save }));

import {
  buildQuickTransformPrompt,
  canQuickTransformUrl,
  formatQuickRecordLabel,
  quickRewrite,
} from './quick-rewrite';

const post: NoteContent = {
  id: 'x:42', platform: 'x', sourceUrl: 'https://x.com/author/status/42', title: '原帖标题', content: '原帖正文',
  author: '作者', noteType: 'image', images: ['https://pbs.twimg.com/media/example.jpg'], video: null,
  tags: [], publishedAt: null, metrics: { likes: null, collects: null, comments: null, shares: null },
  extractionMethod: 'visible-dom', extractionConfidence: 'low', capturedAt: '2026-11-24T00:00:00.000Z',
};
function captured(note: NoteContent, url = note.sourceUrl) {
  send.mockResolvedValue({ ok: true, data: { url, notes: [note], warnings: [], author: note.author, avatar: null, bio: null } });
}
beforeEach(() => {
  vi.resetAllMocks();
  load.mockResolvedValue({ mode: 'byok', provider: 'openai', vision: true });
  generate.mockResolvedValue('# 新标题\n\n原创稿');
  save.mockResolvedValue('draft-id');
  captured(post);
});

it.each([
  post,
  { ...post, platform: 'xiaohongshu', id: 'xiaohongshu:/explore/test', sourceUrl: 'https://www.xiaohongshu.com/explore/test' } as const,
  { ...post, platform: 'wechat', noteType: 'article', id: 'wechat:/s/abc', sourceUrl: 'https://mp.weixin.qq.com/s/abc' } as const,
])('采集 $platform 内容、调用模型并保存来源', async note => {
  captured(note);
  await expect(quickRewrite(note.sourceUrl)).resolves.toBe('draft-id');
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'byok' }), 'rewrite', expect.stringContaining('原帖正文'), note.images);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    title: '新标题',
    body: '# 新标题\n\n原创稿',
    sourceUrl: note.sourceUrl,
    original: note,
    meta: { action: 'rewrite', target: 'wechat', level: 'medium' },
  }));
});

it('支持通用网页通过 scripting 按需提取并一键总结为 X 推文', async () => {
  const webNote: NoteContent = {
    ...post,
    id: 'web:https://blog.example.com/post',
    platform: 'web',
    noteType: 'article',
    sourceUrl: 'https://blog.example.com/post',
    images: [],
  };
  execScript.mockResolvedValue([{ result: { ok: true, data: { url: webNote.sourceUrl, author: '博主', avatar: null, bio: null, notes: [webNote], warnings: [] } } }]);

  await expect(quickRewrite(webNote.sourceUrl, { action: 'summarize', target: 'x', level: 'light', extraNote: '语气克制' })).resolves.toBe('draft-id');
  expect(send).not.toHaveBeenCalled();
  expect(execScript).toHaveBeenCalledOnce();
  const promptArg = generate.mock.calls[0]?.[2] as string;
  expect(promptArg).toContain('X（Twitter）');
  expect(promptArg).toContain('精简总结');
  expect(promptArg).toContain('去 AI 味');
  expect(promptArg).toContain('语气克制');
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    meta: { action: 'summarize', target: 'x', level: 'light' },
  }));
});

it('根据目标平台和改写程度构建不同提示词并包含去 AI 味约束', () => {
  const xhsDeep = buildQuickTransformPrompt(post, { action: 'rewrite', target: 'xiaohongshu', level: 'deep' });
  expect(xhsDeep).toContain('小红书图文笔记');
  expect(xhsDeep).toContain('深度再创作');
  expect(xhsDeep).toContain('严禁满屏 emoji');
  expect(xhsDeep).toContain('总而言之');

  const wechatLight = buildQuickTransformPrompt(post, { action: 'rewrite', target: 'wechat', level: 'light' });
  expect(wechatLight).toContain('微信公众号文章');
  expect(wechatLight).toContain('轻度改写');

  expect(formatQuickRecordLabel({ action: 'summarize', target: 'xiaohongshu', level: 'deep' })).toBe('小红书总结 · 深度提炼');
  expect(canQuickTransformUrl('https://mp.weixin.qq.com/s/abc')).toBe(true);
  expect(canQuickTransformUrl('https://blog.example.com/article')).toBe(true);
  expect(canQuickTransformUrl('https://www.xiaohongshu.com/user/profile/123')).toBe(false);
  expect(canQuickTransformUrl('https://x.com/explore')).toBe(false);
});

it('当前标签页换帖后不发送素材', async () => {
  await expect(quickRewrite('https://x.com/author/status/43')).rejects.toThrow('页面已切换');
  expect(generate).not.toHaveBeenCalled();
});

it('视频不会被当成图文改写', async () => {
  captured({ ...post, noteType: 'video' });
  await expect(quickRewrite(post.sourceUrl)).rejects.toThrow('视频');
  expect(generate).not.toHaveBeenCalled();
});

it('允许仅含正文的 X 帖子，模型失败时不写入空稿', async () => {
  captured({ ...post, noteType: 'unknown', images: [] });
  generate.mockRejectedValue(new Error('服务未连接'));
  await expect(quickRewrite(post.sourceUrl)).rejects.toThrow('服务未连接');
  expect(save).not.toHaveBeenCalled();
});
