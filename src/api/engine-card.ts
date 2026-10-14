import type { Card, MediaIdentity, PlaybackRecord } from '../../vendor/engine/wire';
import type { JsonObject, MediaItem } from './types';

/** Presentation only: retain the host's opaque identity for every subsequent operation. */
export function engineCard(card: Card, record?: PlaybackRecord): MediaItem {
  if (record && identityKey(record.identity) !== identityKey(card.identity)) record = undefined;
  const episode = card.identity.episode;
  const metadata = card.metadata;
  return {
    id: card.identity.id,
    type: card.identity.kind === 'channel' || card.identity.kind === 'tv' ? 'live' : card.identity.kind === 'movie' ? 'movie' : 'series',
    name: card.title, title: card.title,
    poster: card.poster ?? undefined, background: card.landscape ?? undefined,
    thumbnail: card.landscape ?? card.poster ?? undefined, titleLogo: card.logo ?? undefined,
    description: card.description ?? undefined, year: metadata?.year ?? undefined,
    runtime: metadata?.runtime_minutes == null ? undefined : `${metadata.runtime_minutes}m`,
    imdbRating: metadata?.rating == null ? undefined : String(metadata.rating),
    genres: metadata?.genres ?? [], episodes: [],
    season: episode?.season ?? undefined, episode: episode?.episode,
    episodeTitle: episode ? card.title : undefined, seriesId: card.parent_identity?.id,
    position: record?.position_millis == null ? undefined : record.position_millis / 1000,
    duration: record?.duration_millis == null ? undefined : record.duration_millis / 1000,
    watched: record ? record.completed_at_millis != null : undefined, resumeActive: record ? record.completed_at_millis == null : undefined,
    raw: { engine_card: card as unknown as JsonObject },
  };
}

export function itemIdentity(item: Pick<MediaItem, 'id' | 'type'> & Partial<Pick<MediaItem, 'raw' | 'season' | 'episode'>>): MediaIdentity {
  const card = item.raw?.engine_card as unknown as Card | undefined;
  if (card?.identity?.id === item.id) return card.identity;
  return { id: item.id, kind: item.type === 'live' ? 'channel' : item.type, ids: [], edition: null,
    episode: item.episode == null ? null : { order: 'aired', season: item.season ?? null, episode: item.episode } };
}

export function identityKey(identity: MediaIdentity): string {
  return JSON.stringify([identity.kind, identity.id, identity.edition, identity.episode?.order,
    identity.episode?.season, identity.episode?.episode]);
}
