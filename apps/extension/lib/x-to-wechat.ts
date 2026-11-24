import { xPostId } from './page-context';

export function withXPostSource(draft: string, sourceUrl: string) {
  if (!xPostId(sourceUrl)) return draft;
  const attribution = `[X 原帖](${sourceUrl})`;
  return draft.includes(attribution) ? draft : `${draft.trimEnd()}\n\n${attribution}`;
}
