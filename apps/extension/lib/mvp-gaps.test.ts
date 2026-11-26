import { describe, expect, it } from 'vitest';
import { toHtml } from './export';
import { filterAndSortNotes, parsePublishedTime, rankNotes } from './research';
import { parseTopics } from './topics';
import type { NoteContent } from './models';

const sampleNote = (overrides: Partial<NoteContent>): NoteContent => ({
  id: 'xiaohongshu:/explore/1',
  platform: 'xiaohongshu',
  sourceUrl: 'https://www.xiaohongshu.com/explore/1',
  author: '测试博主',
  title: '示例笔记',
  content: '正文',
  noteType: 'image',
  images: [],
  video: null,
  tags: [],
  publishedAt: null,
  metrics: { likes: null, collects: null, comments: null, shares: null },
  extractionMethod: 'visible-dom',
  extractionConfidence: 'low',
  capturedAt: '2026-11-26T00:00:00.000Z',
  ...overrides,
});

describe('toHtml Markdown 渲染与安全转义', () => {
  it('渲染标题、列表、引用、代码块、行内格式、链接与图片', () => {
    const md = [
      '# 一级标题',
      '',
      '这是 **加粗**、*斜体*、`行内代码` 和 [参考](https://example.com/a?x=1&y=2)。',
      '',
      '> 引用第一行',
      '> 引用第二行',
      '',
      '- 要点一',
      '- 要点二',
      '',
      '1. 步骤一',
      '2. 步骤二',
      '',
      '---',
      '',
      '```ts',
      'const x = 1 < 2;',
      '```',
      '',
      '![封面](https://example.com/cover.png)',
    ].join('\n');
    const html = toHtml(md);
    expect(html).toContain('<h1>一级标题</h1>');
    expect(html).toContain('<strong>加粗</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<code');
    expect(html).toContain('href="https://example.com/a?x=1&amp;y=2"');
    expect(html).toContain('<blockquote');
    expect(html).toContain('引用第一行<br>引用第二行');
    expect(html).toContain('<ul');
    expect(html).toContain('<li>要点一</li>');
    expect(html).toContain('<ol');
    expect(html).toContain('<li>步骤二</li>');
    expect(html).toContain('<hr');
    expect(html).toContain('<pre');
    expect(html).toContain('const x = 1 &lt; 2;');
    expect(html).toContain('<img src="https://example.com/cover.png" alt="封面"');
  });

  it('拦截 javascript 协议链接与脚本标签', () => {
    const html = toHtml('[点击](javascript:alert(1))\n\n![坏图](javascript:alert(2))\n\n<img src=x onerror=alert(3)>');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('src="javascript:');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(3)&gt;');
  });
});

describe('博主研究排序与发布时间筛选', () => {
  const now = new Date(2026, 10, 26, 12, 0, 0);

  it('解析常见中文与标准日期，未知文本返回 null', () => {
    expect(parsePublishedTime('2026-11-20', now)).toBe(new Date(2026, 10, 20).getTime());
    expect(parsePublishedTime('编辑于 2026-11-18 广东', now)).toBe(new Date(2026, 10, 18).getTime());
    expect(parsePublishedTime('3天前', now)).toBe(now.getTime() - 3 * 86_400_000);
    expect(parsePublishedTime('11-21', now)).toBe(new Date(2026, 10, 21).getTime());
    expect(parsePublishedTime('未知日期', now)).toBeNull();
  });

  it('支持按点赞、收藏、评论、发布时间排序，未知值排在末尾', () => {
    const ranked = rankNotes([
      sampleNote({ id: 'a', publishedAt: '2026-11-10', metrics: { likes: 100, collects: 500, comments: 10, shares: null } }),
      sampleNote({ id: 'b', publishedAt: '2026-11-25', metrics: { likes: 300, collects: 100, comments: 40, shares: null } }),
      sampleNote({ id: 'c', publishedAt: null, metrics: { likes: null, collects: null, comments: null, shares: null } }),
    ]);

    expect(filterAndSortNotes(ranked, { noteType: 'all', minScore: 0, sortBy: 'likes', now }).map(n => n.id)).toEqual(['b', 'a', 'c']);
    expect(filterAndSortNotes(ranked, { noteType: 'all', minScore: 0, sortBy: 'collects', now }).map(n => n.id)).toEqual(['a', 'b', 'c']);
    expect(filterAndSortNotes(ranked, { noteType: 'all', minScore: 0, sortBy: 'comments', now }).map(n => n.id)).toEqual(['b', 'a', 'c']);
    expect(filterAndSortNotes(ranked, { noteType: 'all', minScore: 0, sortBy: 'publishedAt', now }).map(n => n.id)).toEqual(['b', 'a', 'c']);
  });

  it('按发布日期区间筛选并排除无日期样本', () => {
    const ranked = rankNotes([
      sampleNote({ id: 'old', publishedAt: '2026-10-01' }),
      sampleNote({ id: 'mid', publishedAt: '2026-11-15' }),
      sampleNote({ id: 'none', publishedAt: null }),
    ]);
    const filtered = filterAndSortNotes(ranked, {
      noteType: 'all',
      minScore: 0,
      sortBy: 'publishedAt',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-26',
      now,
    });
    expect(filtered.map(n => n.id)).toEqual(['mid']);
  });
});

describe('公众号转小红书可点击选题解析', () => {
  it('解析 Markdown 标题格式的多角度选题', () => {
    const md = [
      '## 选题 1：新手避坑清单',
      '- 目标人群：刚入门的创作者',
      '- 核心观点：先跑通结构再追热点',
      '',
      '## 选题 2：3步拆解爆款框架',
      '- 目标人群：日更遇瓶颈的博主',
      '- 核心观点：复盘中位数而非单篇偶然',
    ].join('\n');
    const topics = parseTopics(md);
    expect(topics).toHaveLength(2);
    expect(topics[0]?.title).toBe('新手避坑清单');
    expect(topics[0]?.summary).toContain('目标人群');
    expect(topics[1]?.title).toBe('3步拆解爆款框架');
  });

  it('兼容编号列表格式且对无结构文本安全返回空数组', () => {
    const listTopics = parseTopics('1. **成本视角**：省掉无效投入\n2. **效率视角**：缩短创作周期');
    expect(listTopics.map(t => t.title)).toEqual(['成本视角：省掉无效投入', '效率视角：缩短创作周期']);
    expect(parseTopics('这是一段普通说明文字，没有分点选题。')).toEqual([]);
  });
});
