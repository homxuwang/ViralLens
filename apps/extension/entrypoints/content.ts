import { defineContentScript } from 'wxt/utils/define-content-script';
import { browser } from 'wxt/browser';
import { extractPage } from '../extractors';
export default defineContentScript({
  matches: ['https://www.xiaohongshu.com/*', 'https://mp.weixin.qq.com/*', 'https://x.com/*', 'https://www.x.com/*', 'https://twitter.com/*', 'https://www.twitter.com/*'],
  main() {
    browser.runtime.onMessage.addListener((message, sender, respond) => {
      if (sender.id === browser.runtime.id && message?.type === 'EXTRACT_PAGE') {
        try { respond({ ok: true, data: extractPage(document, location.href) }); }
        catch (e) { respond({ ok: false, error: e instanceof Error ? e.message : '解析失败' }); }
      }
      if (sender.id === browser.runtime.id && message?.type === 'PAGE_CONTEXT') {
        respond({ url: location.href, title: document.title });
      }
    });
  },
});
