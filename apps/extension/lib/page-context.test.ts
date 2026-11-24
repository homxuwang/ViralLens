import { describe, expect, it } from 'vitest';
import { classifyPage } from './page-context';
describe('页面识别', () => {
  it.each([
    ['https://www.xiaohongshu.com/user/profile/abc', 'creator'],
    ['https://www.xiaohongshu.com/explore/abc', 'note'],
    ['https://www.xiaohongshu.com/discovery/item/abc', 'note'],
    ['https://mp.weixin.qq.com/s/abc', 'article'],
    ['https://x.com/author/status/42?s=20', 'post'],
    ['https://twitter.com/i/web/status/42', 'post'],
    ['https://x.com/explore', 'unsupported'],
    ['https://x.com.evil.test/author/status/42', 'unsupported'],
    ['https://www.xiaohongshu.com.evil.test/explore/abc', 'unsupported'],
    ['chrome://extensions', 'unsupported'],
    ['invalid', 'unsupported'],
    ['https://mp.weixin.qq.com/', 'unsupported'],
  ])('%s → %s', (url, kind) => expect(classifyPage(url).kind).toBe(kind));
});
