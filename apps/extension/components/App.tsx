import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { classifyPage } from '../lib/page-context';
import { Workspace } from './Workspace';
import { quickRewrite } from '../lib/quick-rewrite';

const sections = ['当前页面', '博主研究', '单篇分析', '跨平台创作', '我的内容', 'AI 设置'];
export function App() {
  const [section, setSection] = useState(0);
  const [page, setPage] = useState<{url:string;title:string;connected:boolean}>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [openedDraftId, setOpenedDraftId] = useState<string>();
  async function refresh() {
    setLoading(true); setError(''); setPage(undefined);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined) throw new Error('找不到当前标签页。');
      try {
        const reply: unknown = await Promise.race([
          browser.tabs.sendMessage(tab.id, { type: 'PAGE_CONTEXT' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('通信超时')), 3000)),
        ]);
        if (reply && typeof reply === 'object' && 'url' in reply && 'title' in reply && typeof reply.url === 'string' && typeof reply.title === 'string') {
          setPage({ url: reply.url, title: reply.title, connected: true });
          return;
        }
      } catch {
        if (tab.url && classifyPage(tab.url).platform !== 'unknown') setError('页面脚本未连接，请刷新网页后重试。');
      }
      if (!tab.url) throw new Error('无法读取当前页面。请在支持的网页上刷新后重试。');
      setPage({ url: tab.url, title: tab.title ?? '', connected: false });
    } catch (e) { setError(e instanceof Error ? e.message : '读取失败，请重试'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const context = classifyPage(page?.url ?? '');
  const canRewrite = context.kind === 'post' || context.kind === 'note';

  async function rewriteCurrentPage() {
    if (!page?.connected || rewriting) return;
    setRewriting(true);
    setRewriteError('');
    try {
      const id = await quickRewrite(page.url);
      setOpenedDraftId(id);
      setSection(4);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : '改写失败，请重试。');
    } finally { setRewriting(false); }
  }

  return <main>
    <header><span className="logo">V</span><div><strong>ViralLens</strong><small>研究 · 理解 · 原创</small></div><span className="badge">开发版 0.1</span></header>
    <nav aria-label="主要功能">{sections.map((label, i) => <button key={label} disabled={rewriting} aria-current={section === i ? 'page' : undefined} onClick={() => { setOpenedDraftId(undefined); setRewriteError(''); setSection(i); }}>{label}</button>)}</nav>
    <section><p className="eyebrow">创作者工作台</p><h1>{sections[section]}</h1>
      {section === 0 ? <>
        <article><div className="row"><h2>当前浏览器页面</h2><button onClick={() => { setRewriteError(''); void refresh(); }} disabled={loading || rewriting}>{loading ? '读取中…' : '刷新识别'}</button></div>
        {error && <p role="alert" className="error">{error}</p>}
        {page && <><span className="badge">{context.label}</span><h3>{page.title || '无页面标题'}</h3><p className="url">{page.url}</p><p>{page.connected ? '页面脚本已连接' : '尚未连接页面脚本'}</p></>}
        <p className="muted">进入博主研究、单篇分析或跨平台创作采集正文。</p></article>
        <article><h2>图文改写</h2><p>打开 X 或小红书图文帖并展开全文。改写会调用你配置的 BYOK 模型，原帖素材与稿件保存在本浏览器。</p>
        {canRewrite && <button onClick={() => void rewriteCurrentPage()} disabled={!page?.connected || rewriting}>{rewriting ? '正在改写并保存…' : '一键改写并保存'}</button>}
        {rewriteError && <p role="alert" className="error">{rewriteError}</p>}</article>
      </> : <Workspace section={section} openedDraftId={openedDraftId} />}
    </section><footer>Local-first · 仅在主动操作时向配置服务发送素材</footer>
  </main>;
}
