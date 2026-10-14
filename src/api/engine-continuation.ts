import type { ContinuationEntry, ContinuationPage, NextEpisodeResult } from '../../vendor/engine/wire';
import type { MediaItem, Page, JsonObject } from './types';
import type { RequestOptions } from './client-shared';
import { segment, params } from './client-shared';
import { engineCard, itemIdentity } from './engine-card';
import { numericCursor } from './engine-catalog';
import type { EngineRequest } from './engine-bootstrap';

export function continuationItem(entry: ContinuationEntry): MediaItem {
  const item = engineCard(entry.card, entry.status === 'Resume' ? entry.record : undefined);
  return { ...item, queueStatus: entry.status.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
    previousEpisode: entry.status === 'Next' ? engineCard(entry.record.presentation ?? {
      ...entry.card, identity: entry.record.identity, parent_identity: entry.record.parent_identity,
      title: entry.record.title, progress: null,
    }, entry.record) : undefined };
}

export function continuationPage(value: ContinuationPage, offset = 0): Page<MediaItem> {
  const nextOffset = value.next_cursor == null ? null : numericCursor(value.next_cursor);
  return { items: value.entries.map(continuationItem), offset, nextOffset,
    total: nextOffset == null ? offset + value.entries.length : Math.max(nextOffset + 1, offset + value.entries.length) };
}

export class EngineContinuationTransport {
  constructor(private readonly request: EngineRequest) {}
  async page(profile: string, offset = 0, options?: RequestOptions): Promise<Page<MediaItem>> {
    const value = await this.request(`/api/v3/profiles/${segment(profile)}/continue${params({ offset, limit: 40 })}`, {}, options);
    return continuationPage(value as unknown as ContinuationPage, offset);
  }
  async next(profile: string, item: MediaItem, options?: RequestOptions) {
    const value = await this.request(`/api/v3/profiles/${segment(profile)}/continue/next`, {
      method: 'POST', body: continuationIdentity(item),
    }, options) as unknown as NextEpisodeResult;
    return { status: value.status.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase(),
      item: value.item ? engineCard(value.item) : undefined };
  }
  async visibility(profile: string, item: MediaItem, hidden: boolean, options?: RequestOptions) {
    await this.request(`/api/v3/profiles/${segment(profile)}/continue/visibility`, {
      method: 'PUT', body: { ...continuationIdentity(item), hidden },
    }, options);
  }
}

function continuationIdentity(item: MediaItem): JsonObject {
  const card = item.raw.engine_card as unknown as import('../../vendor/engine/wire').Card | undefined;
  const parent = card?.parent_identity ?? (item.seriesId ? {
    id: item.seriesId, kind: 'series', ids: [], episode: null, edition: null,
  } : null);
  return { identity: itemIdentity(item) as unknown as JsonObject, parent_identity: parent as unknown as JsonObject | null };
}
