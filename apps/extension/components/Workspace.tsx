import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { extractSchema, type NoteContent } from '../lib/models';
import { filterAndSortNotes, mergeNotes, rankNotes, type NoteSortKey } from '../lib/research';
import { authorize, defaults, generate, generateImage, loadSettings, storeSettings, type Settings } from '../lib/ai';
import { library, saveContent, type SavedContent } from '../lib/storage';
import { download, toHtml } from '../lib/export';
import type { Task } from '../lib/prompts';
import { withXPostSource } from '../lib/x-to-wechat';
import { classifyPage } from '../lib/page-context';
import { parseTopics, type TopicOption } from '../lib/topics';

export function Workspace({ section, openedDraftId }: { section: number; openedDraftId?: string }) {
  const [settings, setSettings] = useState(defaults);
  const [notes, setNotes] = useState<NoteContent[]>([]);
  const [creatorPage, setCreatorPage] = useState('');
  const [source, setSource] = useState('');
  const [requirements, setRequirements] = useState('风格：专业深度；目标用户：；账号定位：；品牌产品：；篇幅：1500–2500字；笔记数量：1–3篇');
  const [output, setOutput] = useState('');
  const [outputSource, setOutputSource] = useState('');
  const [openedRecord, setOpenedRecord] = useState<SavedContent>();
  const [image, setImage] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<SavedContent[]>([]);
  const [type, setType] = useState('all');
  const [minimum, setMinimum] = useState(0);
  const [sortBy, setSortBy] = useState<NoteSortKey>('relativeScore');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  useEffect(() => { loadSettings().then(setSettings).catch(() => setStatus('设置读取失败')); }, []);
  useEffect(() => {
    if (section !== 4) return;
    let active = true;
    void library.records.orderBy('createdAt').reverse().toArray().then(items => {
      if (!active) return;
      setRecords(items);
      if (!openedDraftId) return;
      const draft = items.find(item => item.id === openedDraftId);
      if (draft) {
        setOpenedRecord(draft);
        setOutput(draft.body);
        setOutputSource(draft.sourceUrl);
        setStatus('稿件已保存到本浏览器，可编辑、复制或导出。');
      }
    }).catch(() => { if (active) setStatus('内容库读取失败，请重试。'); });
    return () => { active = false; };
  }, [section, openedDraftId]);
  async function run(action: () => Promise<void>) { setBusy(true); setStatus('处理中…'); try { await action(); } catch (e) { setStatus(e instanceof Error ? e.message : '操作失败'); } finally { setBusy(false); } }
  async function collect() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('没有当前网页');
    const response = await Promise.race([browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('采集超时')), 10000))]).catch(() => { throw new Error('页面脚本未连接或超时，请刷新支持的网页后重试'); });
    if (!response?.ok) throw new Error(response?.error ?? '采集失败');
    const data = extractSchema.parse(response.data);
    if (!data.notes.length) throw new Error(data.warnings.join(' ') || '没有采集到内容');
    if (section === 1 && classifyPage(data.url).kind !== 'creator') throw new Error('请在小红书博主主页采集研究样本');
    if (data.notes[0]?.platform === 'x' && section !== 3) throw new Error('请在跨平台创作中采集 X 帖子');
    const url = new URL(data.url);
    const currentCreator = section === 1 ? `${url.origin}${url.pathname.replace(/\/$/, '')}` : '';
    const merged = currentCreator && currentCreator === creatorPage ? mergeNotes(notes, data.notes) : data.notes;
    setCreatorPage(currentCreator);
    setNotes(merged);
    const post = merged[0];
    setSource(post?.platform === 'x' ? [post.content, post.author && `作者 ${post.author}`, `原帖 ${post.sourceUrl}`].filter(Boolean).join('\n\n') : JSON.stringify(merged, null, 2));
    setStatus(`本次采集 ${data.notes.length} 篇，合计 ${merged.length} 篇。${data.warnings.join(' ')}`);
  }
  async function ai(task: Task) {
    if (!source.trim()) throw new Error('请先采集或导入素材');
    if (task === 'xToWechat' && /^(?:https?:\/\/\S+\s*)+$/.test(source.trim())) throw new Error('请打开 X 帖子详情后采集，或粘贴帖子正文。');
    const captured = notes[0];
    const sourceUrl = captured?.platform === 'x' && !source.includes(captured.sourceUrl) ? '' : captured?.sourceUrl ?? '';
    const chosenTopic = task === 'xhs' ? topics.find(t => t.id === selectedTopicId) : undefined;
    const promptInput = chosenTopic ? `选中主题：\n${chosenTopic.raw}\n\n${requirements}\n${source}` : `${requirements}\n${source}`;
    const text = await generate(settings, task, promptInput);
    setOpenedRecord(undefined);
    setOutput(task === 'xToWechat' ? withXPostSource(text, sourceUrl) : text);
    setOutputSource(sourceUrl);
    if (task === 'topics') {
      const parsed = parseTopics(text);
      setTopics(parsed);
      setSelectedTopicId(parsed[0]?.id ?? '');
      setStatus(parsed.length ? `已拆解 ${parsed.length} 个选题，可点击下方选题卡片后生成小红书笔记` : '模型已返回选题，请核对事实后保存');
      return;
    }
    setStatus('模型已返回结果，请核对事实后保存');
  }
  const action = (label: string, fn: () => Promise<void>) => <button disabled={busy} onClick={() => void run(fn)}>{label}</button>;
  const field = (label: string, key: keyof Settings, secret = false) => <label>{label}<input type={secret ? 'password' : 'text'} value={String(settings[key])} onChange={e => setSettings({ ...settings, [key]: e.target.value })} /></label>;
  return <div>
    {section === 5 ? <article>
      <h2>模型配置</h2><p className="muted">密钥仅存浏览器本地，不会写入 D1。BYOK 请求直接发往配置地址；自有代理也由你自行配置。</p>
      <label>模式<select value={settings.mode} onChange={e => setSettings({ ...settings, mode: e.target.value as Settings['mode'] })}><option value="byok">BYOK 真实模式</option><option value="saas">SaaS 真实模式</option></select></label>
      <label>提供商<select value={settings.provider} onChange={e => { const p = e.target.value as Settings['provider']; const endpoints = { openai: 'https://api.openai.com/v1', claude: 'https://api.anthropic.com/v1', gemini: 'https://generativelanguage.googleapis.com/v1beta', deepseek: 'https://api.deepseek.com', custom: '' }; setSettings({ ...settings, provider: p, endpoint: endpoints[p], model: '' }); }}><option>openai</option><option>claude</option><option>gemini</option><option>deepseek</option><option>custom</option></select></label>
      {field('API 地址 / 用户自有代理', 'endpoint')}{field('API Key', 'key', true)}{field('文本模型名称', 'model')}
      <label><input type="checkbox" checked={settings.vision} onChange={e => setSettings({ ...settings, vision: e.target.checked })} />模型支持 OpenAI 兼容视觉输入（需向提供商确认）</label>
      <h3>图片模型（OpenAI 兼容接口）</h3>{field('图片 API 地址', 'imageEndpoint')}{field('图片 Key', 'imageKey', true)}{field('图片模型', 'imageModel')}
      <h3>SaaS</h3>{field('Worker 地址', 'workerUrl')}{field('访问令牌', 'token', true)}
      {action('保存并授权文本接口', async () => { await authorize(settings); await storeSettings(settings); setStatus('配置已保存，文本接口权限已授予'); })}
      {action('保存并授权图片接口', async () => { await authorize(settings, true); await storeSettings(settings); setStatus('图片接口已授权并保存'); })}
      {action('测试文本连接（会消耗额度）', async () => { await generate(settings, 'rewrite', '请回复连接成功'); setStatus('已收到真实模型回复，文本连接成功'); })}
      {action('删除全部密钥', async () => { const next = { ...settings, key: '', imageKey: '', token: '' }; await storeSettings(next); setSettings(next); setStatus('本地密钥已删除'); })}
    </article> : section === 4 ? <article><h2>本地内容</h2><input placeholder="搜索标题、正文或类型" value={query} onChange={e => setQuery(e.target.value)} />
      {action('加载 / 刷新内容库', async () => { setRecords(await library.records.orderBy('createdAt').reverse().toArray()); setStatus('本地记录已加载'); })}
      {action('导出全部记录', async () => { download(JSON.stringify(await library.records.toArray(), null, 2), 'virallens-backup.json', 'application/json'); setStatus('备份已导出，不包含密钥'); })}
      {records.filter(r => `${r.title} ${r.body} ${r.kind}`.toLowerCase().includes(query.toLowerCase())).map(r => <article key={r.id}><h3>{r.title}</h3><small>{r.kind === 'quick-rewrite' ? '图文改写' : r.kind} · {r.createdAt}</small><button onClick={() => { setOpenedRecord(r); setOutput(r.body); setOutputSource(r.sourceUrl); setStatus('已打开记录，可编辑或导出'); }}>打开</button>{action('删除', async () => { await library.records.delete(r.id); setRecords(items => items.filter(x => x.id !== r.id)); if (openedRecord?.id === r.id) { setOpenedRecord(undefined); setOutput(''); setOutputSource(''); } setStatus('记录已删除'); })}</article>)}
      {!records.length && <p>暂无本地记录。</p>}
    </article> : <>
      <article><h2>素材来源</h2><p>只读取当前网页已加载内容。滚动网页后点击增量采集；不会自动翻页或请求隐藏接口。</p>
      {action('采集当前页 / 滚动后增量采集', collect)}<button disabled={busy} onClick={() => { setNotes([]); setSource(''); setTopics([]); setSelectedTopicId(''); setStatus('采集样本已清空'); }}>清空样本</button>
      <label>粘贴有权使用的素材 / 链接 / 视频字幕<textarea rows={7} value={source} onChange={e => setSource(e.target.value)} /></label>
      <p className="muted">链接需要在浏览器中打开再采集。{section === 3 && '改写 X 热帖时，先打开帖子详情并展开全文，或直接粘贴原文。'}</p>
      <label>导入 TXT / Markdown（请确认使用权）<input type="file" accept=".txt,.md" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 2_000_000) throw new Error('文件请小于 2 MB'); setSource(await file.text()); setStatus('文件已导入本地'); }); }} /></label>
      </article>
      {section !== 1 && notes.length > 0 && <article><h2>原始内容预览</h2>{notes.map(n => <div key={n.id}><h3>{n.title || '无标题'}</h3><small>{n.author ?? '作者未知'} · {n.noteType} · {n.publishedAt ?? '发布时间未知'}</small><p style={{ whiteSpace: 'pre-wrap' }}>{n.content || '正文未在当前页加载'}</p>{n.images.slice(0, 9).map(url => <img key={url} src={url} alt="原始素材预览" loading="lazy" style={{ width: '30%', margin: '1%' }} />)}{n.video && <video controls src={n.video} style={{ width: '100%' }} />}<p className="muted">视频分析仅依据可见文字、封面与提供字幕，未自动观看或转录视频。</p></div>)}</article>}
      {section === 1 && <article><h2>已加载样本：{notes.length} 篇</h2><p>图文 {notes.filter(n => n.noteType === 'image').length} · 视频 {notes.filter(n => n.noteType === 'video').length} · 未知 {notes.filter(n => n.noteType === 'unknown').length}</p>
      <p className="muted">内部相对分：同账号同类型中位数归一化，点赞 40%、收藏 40%、评论 20%，缺失权重重新归一；中位数为零时不计算该指标。小样本结论有限，并非官方分数。</p>
      <div className="filters">
        <label>类型<select value={type} onChange={e => setType(e.target.value)}><option value="all">全部类型</option><option value="image">图文</option><option value="video">视频</option></select></label>
        <label>排序<select value={sortBy} onChange={e => setSortBy(e.target.value as NoteSortKey)}><option value="relativeScore">综合相对分</option><option value="likes">点赞数</option><option value="collects">收藏数</option><option value="comments">评论数</option><option value="publishedAt">发布时间</option></select></label>
        <label>最低相对分<input type="number" min="0" step="0.5" value={minimum} onChange={e => setMinimum(Number(e.target.value))} /></label>
        <label>发布日期起<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
        <label>发布日期至<input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
      </div>
      {filterAndSortNotes(rankNotes(notes), { noteType: type, minScore: minimum, sortBy, dateFrom, dateTo }).map(n => <div className="note" key={n.id}><a href={n.sourceUrl} target="_blank" rel="noreferrer">{n.title || '无标题'}</a><small>{n.noteType} · {n.publishedAt ?? '时间未知'} · 赞 {n.metrics.likes ?? '未知'} · 藏 {n.metrics.collects ?? '未知'} · 评 {n.metrics.comments ?? '未知'} · 相对分 {n.relativeScore?.toFixed(2) ?? '未知'} · 同组 {n.peerCount} 篇</small></div>)}
      {action('保存采集样本', async () => { await saveContent({ title: `笔记样本 ${notes.length} 篇`, kind: 'notes', body: JSON.stringify(notes), sourceUrl: notes[0]?.sourceUrl ?? '' }); setStatus('样本已保存'); })}</article>}
      <article><h2>分析与原创创作</h2><label>目标人群、定位、风格、篇幅、选中主题等<textarea rows={4} value={requirements} onChange={e => setRequirements(e.target.value)} /></label><p className="muted">点击下方按钮会将素材和要求发送给所配置的模型提供商。请确认你有权使用这些内容。</p>
      {section === 1 ? action('分析赛道、定位与可模仿性', () => ai('research')) : <>
      {action('单篇结构与优化分析', () => ai('analyze'))}{action('原创标题和正文', () => ai('rewrite'))}{action('视频口播与分镜', () => ai('script'))}
      {section === 3 && <>{action('X 热帖 → 公众号文章', () => ai('xToWechat'))}{action('小红书 → 公众号大纲', () => ai('outline'))}{action('小红书 → 公众号全文', () => ai('wechat'))}{action('公众号 → 不同角度选题', () => ai('topics'))}{action('选中主题 → 小红书笔记', () => ai('xhs'))}</>}
      {action('图片 OCR / 视觉分析', async () => { const urls = notes.flatMap(n => n.images).slice(0, 4); if (!urls.length) throw new Error('请先采集包含图片的笔记'); setOutput(await generate(settings, 'vision', source, urls)); setOpenedRecord(undefined); setOutputSource(notes[0]?.sourceUrl ?? ''); setStatus('视觉模型已返回结果'); })}</>}
      {section === 3 && topics.length > 0 && <div className="topics"><p className="muted">已拆解选题（点击选中后可直接点击「选中主题 → 小红书笔记」）：</p>
        {topics.map(t => <button key={t.id} type="button" className="topic-card" aria-pressed={selectedTopicId === t.id} onClick={() => { setSelectedTopicId(t.id); setStatus(`已选中选题：${t.title}`); }}><strong>{t.title}</strong>{t.summary && <small>{t.summary}</small>}</button>)}
      </div>}
      </article>
      <article><h2>原创封面 / 配图</h2><label>图片要求<textarea value={imagePrompt} onChange={e => setImagePrompt(e.target.value)} placeholder="主体、风格、比例和封面文案" /></label>{action('调用图片模型', async () => { if (!imagePrompt.trim()) throw new Error('请填写图片要求'); setImage(await generateImage(settings, imagePrompt)); setStatus('图片模型已返回图片'); })}
      {image && <><img className="generated" src={image} alt="模型生成的原创图片" />{action('保存图片记录', async () => { await saveContent({ title: imagePrompt.slice(0,60), kind: 'image', body: image, sourceUrl: '' }); setStatus('图片结果已保存；远程 URL 可能到期'); })}</>}</article>
    </>}
    {(output || openedRecord) && <article><h2>结果（可编辑）</h2><textarea aria-label="稿件正文" rows={18} value={output} onChange={e => setOutput(e.target.value)} />
      {openedRecord?.original && <details><summary>原帖素材</summary><a href={openedRecord.original.sourceUrl} target="_blank" rel="noreferrer">打开原帖</a><p>{openedRecord.original.title}</p><p style={{ whiteSpace: 'pre-wrap' }}>{openedRecord.original.content}</p>
        {openedRecord.original.images.map((url, index) => <p key={url}><a href={url} target="_blank" rel="noreferrer">原帖图片 {index + 1}</a></p>)}
      </details>}
      {action('保存结果', async () => {
        if (!output.trim()) throw new Error('请先填写稿件正文');
        if (openedRecord?.kind === 'quick-rewrite') {
          const title = output.split('\n').find(line => line.trim())?.replace(/^#+\s*/, '').trim() || openedRecord.title;
          const updated = { ...openedRecord, title, body: output };
          await library.records.put(updated);
          setOpenedRecord(updated);
          setRecords(items => items.map(item => item.id === updated.id ? updated : item));
        } else {
          await saveContent({ title: output.split('\n')[0]?.slice(0,80) || '创作结果', kind: section === 1 ? 'research' : 'creation', body: output, sourceUrl: outputSource });
        }
        setStatus('已保存到本地内容库');
      })}
      <button onClick={() => download(output, 'virallens.md', 'text/markdown')}>Markdown</button><button onClick={() => download(toHtml(output), 'virallens.html', 'text/html')}>HTML</button><button onClick={() => download(output, 'virallens.txt')}>TXT</button>{action('复制', async () => { await navigator.clipboard.writeText(output); setStatus('已复制'); })}
    </article>}
    <p role="status" className="status">{status}</p>
  </div>;
}
