import { xPostId } from './page-context';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function toHtml(markdown: string) {
  const body = markdown.split(/\n\s*\n/).map(block => {
    const source = block.match(/^\[X 原帖\]\(([^\s)]+)\)$/)?.[1];
    if (source && xPostId(source)) return `<p><a href="${escape(source)}">X 原帖</a></p>`;
    if (/^#{1,3} /.test(block)) { const n = block.match(/^#+/)![0].length; return `<h${n}>${escape(block.replace(/^#+ /, ''))}</h${n}>`; }
    if (block.startsWith('> ')) return `<blockquote>${escape(block.slice(2))}</blockquote>`;
    return `<p>${escape(block).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>ViralLens 创作</title><body><article style="max-width:680px;margin:auto;font:16px/1.9 sans-serif;color:#283d35">${body}</article></body></html>`;
}
export function download(body: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
