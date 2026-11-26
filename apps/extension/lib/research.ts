import type { NoteContent } from './models';
export function mergeNotes(existing: NoteContent[], incoming: NoteContent[]) {
  const map = new Map(existing.map(n => [n.id, n]));
  for (const n of incoming) {
    const old = map.get(n.id);
    map.set(n.id, old ? { ...old, ...n, content: n.content || old.content, metrics: { likes: n.metrics.likes ?? old.metrics.likes, collects: n.metrics.collects ?? old.metrics.collects, comments: n.metrics.comments ?? old.metrics.comments, shares: n.metrics.shares ?? old.metrics.shares } } : n);
  }
  return [...map.values()];
}
const median = (values: number[]) => { const a = [...values].sort((a,b) => a-b); const i = Math.floor(a.length / 2); return a.length ? a.length % 2 ? a[i]! : (a[i-1]! + a[i]!) / 2 : null; };
export type RankedNote = NoteContent & { relativeScore: number | null; peerCount: number };
export type NoteSortKey = 'relativeScore' | 'likes' | 'collects' | 'comments' | 'publishedAt';

export function rankNotes(notes: NoteContent[]): RankedNote[] {
  return notes.map(n => {
    const peers = notes.filter(p => p.author === n.author && p.platform === n.platform && p.noteType === n.noteType);
    const weights = { likes: 0.4, collects: 0.4, comments: 0.2 };
    let total = 0, used = 0;
    for (const key of ['likes', 'collects', 'comments'] as const) {
      const baseline = median(peers.map(p => p.metrics[key]).filter((v): v is number => v !== null));
      if (baseline !== null && baseline > 0 && n.metrics[key] !== null) { total += n.metrics[key]! / baseline * weights[key]; used += weights[key]; }
    }
    return { ...n, relativeScore: used ? total / used : null, peerCount: peers.length };
  }).sort((a,b) => (b.relativeScore ?? -1) - (a.relativeScore ?? -1));
}

export function parsePublishedTime(raw: string | null, now = new Date()): number | null {
  if (!raw) return null;
  const text = raw.trim().replace(/^编辑于\s*/, '').replace(/\s+[\u4e00-\u9fa5]{2,}$/, '');
  if (!text) return null;

  const relDay = text.match(/^(\d+)\s*天前$/);
  if (relDay) return now.getTime() - Number(relDay[1]) * 86_400_000;
  const relHour = text.match(/^(\d+)\s*小时前$/);
  if (relHour) return now.getTime() - Number(relHour[1]) * 3_600_000;
  const relMin = text.match(/^(\d+)\s*分钟前$/);
  if (relMin) return now.getTime() - Number(relMin[1]) * 60_000;
  if (/^刚刚$/.test(text)) return now.getTime();
  if (/^今天/.test(text)) return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (/^昨天/.test(text)) return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

  const md = text.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (md) {
    const year = now.getFullYear();
    const candidate = new Date(year, Number(md[1]) - 1, Number(md[2]));
    if (!Number.isNaN(candidate.getTime())) {
      return candidate.getTime() > now.getTime() + 86_400_000
        ? new Date(year - 1, Number(md[1]) - 1, Number(md[2])).getTime()
        : candidate.getTime();
    }
  }

  const ymd = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymd) {
    const dt = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), Number(ymd[4] ?? 0), Number(ymd[5] ?? 0), Number(ymd[6] ?? 0));
    return Number.isNaN(dt.getTime()) ? null : dt.getTime();
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

export interface NoteFilterOptions {
  noteType: string;
  minScore: number;
  sortBy: NoteSortKey;
  dateFrom?: string;
  dateTo?: string;
  now?: Date;
}

function sortMetric(note: RankedNote, sortBy: NoteSortKey, now: Date): number | null {
  if (sortBy === 'relativeScore') return note.relativeScore;
  if (sortBy === 'publishedAt') return parsePublishedTime(note.publishedAt, now);
  return note.metrics[sortBy];
}

export function filterAndSortNotes(notes: RankedNote[], options: NoteFilterOptions): RankedNote[] {
  const now = options.now ?? new Date();
  const fromTs = options.dateFrom ? parsePublishedTime(options.dateFrom, now) : null;
  const toBase = options.dateTo ? parsePublishedTime(options.dateTo, now) : null;
  const toTs = toBase !== null ? toBase + 86_400_000 - 1 : null;

  return notes
    .filter(n => {
      if (options.noteType !== 'all' && n.noteType !== options.noteType) return false;
      if (options.minScore > 0 && (n.relativeScore ?? -1) < options.minScore) return false;
      if (fromTs !== null || toTs !== null) {
        const ts = parsePublishedTime(n.publishedAt, now);
        if (ts === null) return false;
        if (fromTs !== null && ts < fromTs) return false;
        if (toTs !== null && ts > toTs) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = sortMetric(a, options.sortBy, now);
      const bv = sortMetric(b, options.sortBy, now);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return bv - av;
    });
}
