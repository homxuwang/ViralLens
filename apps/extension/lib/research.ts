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
export function rankNotes(notes: NoteContent[]) {
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
