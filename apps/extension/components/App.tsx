import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { classifyPage, isKnownPlatformHost, isReadableWebUrl } from '../lib/page-context';
import { Workspace } from './Workspace';
import {
  ACTION_LABELS,
  canQuickTransformUrl,
  LEVEL_DESCRIPTIONS,
  quickRewrite,
  TARGET_LABELS,
  type QuickAction,
  type RewriteLevel,
  type TargetPlatform,
} from '../lib/quick-rewrite';

const sections = ['当前页面', '博主研究', '单篇分析', '跨平台创作', '我的内容', 'AI 设置'];
const actions: QuickAction[] = ['rewrite', 'summarize'];
const targets: TargetPlatform[] = ['wechat', 'xiaohongshu', 'x'];
const levels: RewriteLevel[] = ['light', 'medium', 'deep'];

export function App() {
  const [section, setSection] = useState(0);
  const [page, setPage] = useState<{ url: string; title: string; connected: boolean }>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState('');
  const [openedDraftId, setOpenedDraftId] = useState<string>();
  const [quickAction, setQuickAction] = useState<QuickAction>('rewrite');
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('wechat');
  const [rewriteLevel, setRewriteLevel] = useState<RewriteLevel>('medium');
  const [extraNote, setExtraNote] = useState('');

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
      if (!tab.url) throw new Error('无法读取当前页面。请先点击浏览器工具栏 ViralLens 图标授权，或在支持的网页上刷新后重试。');
      setPage({ url: tab.url, title: tab.title ?? '', connected: false });
    } catch (e) { setError(e instanceof Error ? e.message : '读取失败，请重试'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const rawUrl = page?.url ?? '';
  const context = classifyPage(rawUrl);
  const isGenericWeb = Boolean(page && context.platform === 'unknown' && isReadableWebUrl(rawUrl) && !isKnownPlatformHost(rawUrl));
  const canTransform = Boolean(page && canQuickTransformUrl(rawUrl));
  const readyToTransform = canTransform && (isGenericWeb || Boolean(page?.connected));
  const pageBadge = isGenericWeb ? '网页内容（通用解析）' : context.label;
  const levelMeta = LEVEL_DESCRIPTIONS[quickAction][rewriteLevel];

  async function transformCurrentPage() {
    if (!page || !readyToTransform || rewriting) return;
    setRewriting(true);
    setRewriteError('');
    try {
      const id = await quickRewrite(page.url, {
        action: quickAction,
        target: targetPlatform,
        level: rewriteLevel,
        extraNote,
      });
      setOpenedDraftId(id);
      setSection(4);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : '生成失败，请重试。');
    } finally { setRewriting(false); }
  }

  return <main>
    <header><span className="logo">V</span><div><strong>ViralLens</strong><small>研究 · 理解 · 原创</small></div><span className="badge">开发版 0.1</span></header>
    <nav aria-label="主要功能">{sections.map((label, i) => <button key={label} disabled={rewriting} aria-current={section === i ? 'page' : undefined} onClick={() => { setOpenedDraftId(undefined); setRewriteError(''); setSection(i); }}>{label}</button>)}</nav>
    <section><p className="eyebrow">创作者工作台</p><h1>{sections[section]}</h1>
      {section === 0 ? <>
        <article><div className="row"><h2>当前浏览器页面</h2><button onClick={() => { setRewriteError(''); void refresh(); }} disabled={loading || rewriting}>{loading ? '读取中…' : '刷新识别'}</button></div>
        {error && <p role="alert" className="error">{error}</p>}
        {page && <><span className="badge">{pageBadge}</span><h3>{page.title || '无页面标题'}</h3><p className="url">{page.url}</p><p className="muted">{page.connected ? '专用解析器已连接（X / 小红书 / 公众号）' : isGenericWeb ? '通用网页模式（点击下方按钮按需读取正文）' : '尚未连接页面脚本'}</p></>}
        {context.kind === 'creator' && <button type="button" onClick={() => setSection(1)}>进入「博主研究」批量采集</button>}
        </article>
        <article><h2>一键总结 / 改写（去 AI 味）</h2>
        <p className="muted">不区分来源平台，自动解析 X 帖子、小红书笔记、公众号文章或普通网页，按目标平台风格和改写深度一键生成并保存到本地。</p>
        <div className="control-group"><span className="control-label">处理方式</span>
          <div className="segmented">{actions.map(item => <button key={item} type="button" disabled={rewriting} aria-pressed={quickAction === item} onClick={() => setQuickAction(item)}>{ACTION_LABELS[item]}</button>)}</div>
        </div>
        <div className="control-group"><span className="control-label">目标平台形式</span>
          <div className="segmented three">{targets.map(item => <button key={item} type="button" disabled={rewriting} aria-pressed={targetPlatform === item} onClick={() => setTargetPlatform(item)}>{TARGET_LABELS[item]}</button>)}</div>
        </div>
        <div className="control-group"><span className="control-label">{quickAction === 'rewrite' ? '改写程度' : '总结深度'}</span>
          <div className="segmented three">{levels.map(item => <button key={item} type="button" disabled={rewriting} aria-pressed={rewriteLevel === item} onClick={() => setRewriteLevel(item)}>{LEVEL_DESCRIPTIONS[quickAction][item].label.replace('（推荐）', '')}</button>)}</div>
          <p className="muted">{levelMeta.hint}</p>
        </div>
        <label>补充要求（可选）<input type="text" disabled={rewriting} value={extraNote} onChange={e => setExtraNote(e.target.value)} placeholder="如：面向职场新人、语气更克制、控制在 600 字内" /></label>
        {canTransform ? (
          <button type="button" className="primary-btn" onClick={() => void transformCurrentPage()} disabled={!readyToTransform || rewriting}>
            {rewriting ? '正在解析并生成…' : `一键${ACTION_LABELS[quickAction]}为${TARGET_LABELS[targetPlatform]}并保存`}
          </button>
        ) : (
          <p className="muted">{context.kind === 'creator' ? '当前为博主主页，请点击上方按钮进入「博主研究」。' : '请打开具体的 X 帖子、小红书笔记、公众号文章或任意文章网页后点击「刷新识别」。'}</p>
        )}
        {rewriteError && <p role="alert" className="error">{rewriteError}</p>}</article>
      </> : <Workspace section={section} openedDraftId={openedDraftId} />}
    </section><footer>Local-first · 仅在主动操作时向配置服务发送素材</footer>
  </main>;
}
