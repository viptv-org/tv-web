import type { MediaItem } from "../api";

/** Stop a misbehaving upstream from keeping the visible end sentinel alive forever. */
export function appendCatalogPage(old: readonly MediaItem[], incoming: readonly MediaItem[], skip: number, hasMore: boolean, nextSkip?: number) {
  const seen = new Set((skip ? old : []).map(item => `${item.type}:${item.id}`));
  const added = incoming.filter(item => {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const next = nextSkip ?? skip + incoming.length;
  return {
    items: skip ? [...old, ...added] : added,
    nextSkip: hasMore && added.length > 0 && next > skip && next <= 10_000 ? next : undefined,
  };
}
