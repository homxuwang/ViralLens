export interface TopicOption {
  id: string;
  title: string;
  summary: string;
  raw: string;
}

const HEADING_TOPIC = /^#{1,4}\s*(?:(?:选题|角度|主题)\s*[0-9一二三四五六七八九十]+[\s:：.、-]*|\d+[.、]\s*)(.+)$/;
const LIST_TOPIC = /^(?:\d+[.、]\s*|(?:选题|角度|主题)\s*[0-9一二三四五六七八九十]+[\s:：.、-]+)(.+)$/;

function cleanTitle(raw: string): string {
  return raw.replace(/\*\*/g, '').replace(/^\[|\]$/g, '').trim();
}

export function parseTopics(markdown: string): TopicOption[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const buckets: { title: string; body: string[]; raw: string[] }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(HEADING_TOPIC);
    const listMatch = !headingMatch && buckets.length === 0 ? trimmed.match(LIST_TOPIC) : null;
    const nextListMatch = !headingMatch && buckets.length > 0 && /^(\d+[.、]|(?:选题|角度|主题)\s*[0-9一二三四五六七八九十]+[\s:：.、-])/.test(trimmed)
      ? trimmed.match(LIST_TOPIC)
      : null;
    const match = headingMatch ?? listMatch ?? nextListMatch;

    if (match?.[1]) {
      const title = cleanTitle(match[1]);
      if (title) {
        buckets.push({ title, body: [], raw: [line] });
        continue;
      }
    }
    const current = buckets.at(-1);
    if (current) {
      current.raw.push(line);
      if (trimmed) current.body.push(trimmed.replace(/^[-*+]\s+/, ''));
    }
  }

  return buckets.slice(0, 6).map((bucket, idx) => ({
    id: `topic-${idx + 1}`,
    title: bucket.title,
    summary: bucket.body.slice(0, 2).join(' · ').slice(0, 120),
    raw: bucket.raw.join('\n').trim(),
  }));
}
