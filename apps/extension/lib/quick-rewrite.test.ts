import { beforeEach, expect, it, vi } from 'vitest';
import type { NoteContent } from './models';

const { send, generate, save, load } = vi.hoisted(() => ({ send: vi.fn(), generate: vi.fn(), save: vi.fn(), load: vi.fn() }));
vi.mock('wxt/browser', () => ({ browser: { tabs: { query: async () => [{ id: 42 }], sendMessage: send } } }));
vi.mock('./ai', () => ({ generate, loadSettings: load }));
vi.mock('./storage', () => ({ saveContent: save }));

import { quickRewrite } from './quick-rewrite';

const post: NoteContent = {
  id: 'x:42', platform: 'x', sourceUrl: 'https://x.com/author/status/42', title: '原帖标题', content: '原帖正文',
  author: '作者', noteType: 'image', images: ['https://pbs.twimg.com/media/example.jpg'], video: null,
  tags: [], publishedAt: null, metrics: { likes: null, collects: null, comments: null, shares: null },
  extractionMethod: 'visible-dom', extractionConfidence: 'low', capturedAt: '2026-11-24T00:00:00.000Z',
};
function captured(note: NoteContent, url = note.sourceUrl) {
  send.mockResolvedValue({ ok: true, data: { url, notes: [note], warnings: [], author: note.author, bio: null } });
}
beforeEach(() => {
  vi.resetAllMocks();
  load.mockResolvedValue({ mode: 'byok', provider: 'openai', vision: true });
  generate.mockResolvedValue('# 新标题\n\n原创稿');
  save.mockResolvedValue('draft-id');
  captured(post);
});

it.each([post, { ...post, platform: 'xiaohongshu', id: 'xiaohongshu:/explore/test', sourceUrl: 'https://www.xiaohongshu.com/explore/test' } as const])('采集 $platform 图文、调用 BYOK 模型并保存来源', async note => {
  captured(note);
  await expect(quickRewrite(note.sourceUrl)).resolves.toBe('draft-id');
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'byok' }), 'rewrite', expect.stringContaining('原帖正文'), note.images);
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ title: '新标题', body: '# 新标题\n\n原创稿', sourceUrl: note.sourceUrl, original: note }));
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
