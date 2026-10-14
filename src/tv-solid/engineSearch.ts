import type { Card } from '../../vendor/engine/wire';
import type { MediaItem } from '../api';
import type { SearchRow } from './searchModel';

/** Preserve host ranking within the explicit media categories; no provider choice or client reranking. */
export function engineSearchRows(items: readonly MediaItem[]): SearchRow[] {
  const groups = new Map<string, SearchRow>();
  for (const item of items) {
    const card = item.raw.engine_card as unknown as Card | undefined;
    const key = card?.category === 'anime' ? 'anime' : item.type;
    let group = groups.get(key);
    if (!group) {
      group = { id: `metadata:${key}`, name: key === 'anime' ? 'Anime' : key === 'movie' ? 'Movies' : 'TV Shows', items: [] };
      groups.set(key, group);
    }
    group.items = [...group.items, item];
  }
  return [...groups.values()];
}
