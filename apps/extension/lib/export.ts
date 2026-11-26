const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function safeHttpUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function renderInline(raw: string): string {
  const tokens: string[] = [];
  const stash = (html: string) => {
    const idx = tokens.push(html) - 1;
    return `\uE000${idx}\uE001`;
  };

  let text = escapeHtml(raw);
  text = text.replace(/`([^`\n]+)`/g, (_, code: string) =>
    stash(`<code style="background:#f2f5f3;padding:2px 5px;border-radius:4px;font-size:0.9em">${code}</code>`),
  );
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (match, alt: string, url: string) => {
    const href = safeHttpUrl(url.replace(/&amp;/g, '&'));
    return href ? stash(`<img src="${escapeHtml(href)}" alt="${alt}" style="max-width:100%;border-radius:6px;margin:8px 0">`) : match;
  });
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeHttpUrl(url.replace(/&amp;/g, '&'));
    return href ? stash(`<a href="${escapeHtml(href)}" style="color:#225d4d">${label}</a>`) : match;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  return text.replace(/\uE000(\d+)\uE001/g, (_, idx: string) => tokens[Number(idx)] ?? '');
}

export function toHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }

    if (/^```/.test(trimmed)) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test((lines[i] ?? '').trim())) {
        codeLines.push(lines[i] ?? '');
        i++;
      }
      if (i < lines.length) i++;
      out.push(`<pre style="background:#f4f6f5;padding:12px;border-radius:8px;overflow:auto;font-size:14px"><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push('<hr style="border:none;border-top:1px solid #dce3de;margin:20px 0">');
      i++;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test((lines[i] ?? '').trim())) {
        quoteLines.push((lines[i] ?? '').trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #225d4d;background:#f5f8f6;color:#3d5248">${quoteLines.map(renderInline).join('<br>')}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test((lines[i] ?? '').trim())) {
        items.push(`<li>${renderInline((lines[i] ?? '').trim().replace(/^[-*+]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul style="padding-left:20px;margin:10px 0">${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? '').trim())) {
        items.push(`<li>${renderInline((lines[i] ?? '').trim().replace(/^\d+\.\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ol style="padding-left:20px;margin:10px 0">${items.join('')}</ol>`);
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^(?:```|#{1,4}\s+|>\s?|[-*+]\s+|\d+\.\s+|-{3,}$|\*{3,}$|_{3,}$)/.test((lines[i] ?? '').trim())
    ) {
      paraLines.push(lines[i] ?? '');
      i++;
    }
    out.push(`<p>${paraLines.map(renderInline).join('<br>')}</p>`);
  }

  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>ViralLens 创作</title><body><article style="max-width:680px;margin:auto;font:16px/1.9 sans-serif;color:#283d35">${out.join('\n')}</article></body></html>`;
}

export function download(body: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
