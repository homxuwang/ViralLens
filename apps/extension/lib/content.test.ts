// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { extractPage, parseMetric } from '../extractors';
import { mergeNotes, rankNotes } from './research';
import { toHtml } from './export';
import { withXPostSource } from './x-to-wechat';
it('解析中文计数且保留未知值', () => {
  expect(parseMetric('1.2万')).toBe(12000);
  expect(parseMetric('点赞')).toBeNull();
  expect(parseMetric('0')).toBe(0);
});
it('提取公众号正文且不采集导航', () => {
  document.body.innerHTML = '<nav>导航</nav><h1 id="activity-name">标题</h1><div id="js_content"><p>正文</p></div>';
  const result = extractPage(document, 'https://mp.weixin.qq.com/s/example');
  expect(result.notes[0]?.content).toBe('正文');
  expect(result.notes[0]?.metrics.likes).toBeNull();
});
it('增量合并保留已知指标，不跨账号比较', () => {
  const base = extractPage(document, 'https://mp.weixin.qq.com/s/example').notes[0]!;
  const notes = [{ ...base, id: 'a', author: '甲', metrics: { ...base.metrics, likes: 10 } }, { ...base, id: 'b', author: '乙', metrics: { ...base.metrics, likes: 100 } }];
  expect(mergeNotes(notes, [{ ...notes[0]!, metrics: { ...base.metrics } }])[0]?.metrics.likes).toBe(10);
  expect(rankNotes(notes).map(n => n.relativeScore)).toEqual([1, 1]);
});
it('导出 HTML 转义用户和模型返回的脚本', () => {
  const html = toHtml('# 标题\n\n<script>alert(1)</script>');
  expect(html).toContain('<h1>标题</h1>');
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});

it('按当前 URL 匹配 X 主帖，忽略回复与嵌入引用', () => {
  document.body.innerHTML = `
    <article data-testid="tweet"><a href="/reply/status/9"><time></time></a><div data-testid="tweetText">回复</div></article>
    <article data-testid="tweet">
      <div data-testid="User-Name"><a href="/author">作者</a><a href="/author/status/42"><time datetime="2026-11-24T10:00:00Z"></time></a></div>
      <div role="link"><div data-testid="tweetText">引用内容</div></div>
      <div data-testid="tweetText">主帖正文</div>
    </article>`;
  const result = extractPage(document, 'https://x.com/author/status/42?s=20');
  expect(result.notes).toHaveLength(1);
  expect(result.notes[0]).toMatchObject({ id: 'x:42', platform: 'x', sourceUrl: 'https://x.com/author/status/42', content: '主帖正文', author: '作者' });
});

it('保留已采集的原帖链接以便署名和导出', () => {
  const url = 'https://x.com/author/status/42';
  const draft = withXPostSource('# 公众号文章', url);
  expect(draft).toContain(url);
  expect(toHtml(draft)).toContain(`href="${url}"`);
  expect(withXPostSource(draft, url)).toBe(draft);
});
it('博主卡片提取并去重，缺失互动保持未知', () => {
  document.body.innerHTML = '<div class="avatar-wrapper"><img src="https://example.com/avatar.jpg"></div><div class="user-name">作者</div><div class="user-desc">科技与效率分享</div><section class="note-item"><a href="/explore/a"><img src="https://example.com/a.png"></a><div class="title">笔记标题</div><span class="like-wrapper"><span class="count">1.2万</span></span><span class="video-icon"></span></section>';
  const result = extractPage(document, 'https://www.xiaohongshu.com/user/profile/a');
  expect(result.author).toBe('作者');
  expect(result.avatar).toBe('https://example.com/avatar.jpg');
  expect(result.bio).toBe('科技与效率分享');
  expect(result.notes).toHaveLength(1);
  expect(result.notes[0]?.noteType).toBe('video');
  expect(result.notes[0]?.metrics.likes).toBe(12000);
  expect(result.notes[0]?.metrics.collects).toBeNull();
});
