/**
 * `/api/profiles/:id/continue` answers a cursor envelope of continuation
 * entries, not the offset page of media rows it replaced. Each entry is a
 * server-rendered `card` plus the playback `record` the row stands on.
 *
 * Fixtures keep authoring plain media rows and lift them here, so every mock
 * answers the shape the deployed backend actually serves.
 *
 * The continuation card carries the provider, not the source fingerprint:
 * resuming re-ranks sources for that provider instead of pinning an exact one.
 */
export function queueEntry(row: Record<string, unknown>) {
  const identity = {
    id: String(row.id),
    kind: String(row.type ?? 'series'),
    ids: [],
    edition: null,
    episode: row.season == null && row.episode == null
      ? null
      : { order: 'aired', season: row.season, episode: row.episode },
  };
  const parent = typeof row.series_id === 'string'
    ? { id: row.series_id, kind: 'series', ids: [], episode: null, edition: null }
    : null;
  const previous = row.previous_episode as Record<string, unknown> | undefined;
  const title = row.name ?? row.title;
  return {
    card: {
      identity,
      parent_identity: parent,
      provider_id: row.source_addon_id,
      title,
      subtitle: row.episode_title,
      description: row.description,
      poster: row.poster,
      landscape: row.background,
      logo: row.title_logo,
      progress: null,
      badges: [],
    },
    record: {
      identity,
      parent_identity: parent,
      provider_id: row.source_addon_id,
      title,
      position_millis: Number(row.position ?? 0) * 1000,
      duration_millis: Number(row.duration ?? 0) * 1000,
      updated_at_millis: 1_700_000_000_000,
    },
    status: row.queue_status === 'next' ? 'Next' : 'Resume',
    previous_identity: previous ? {
      id: String(previous.id),
      kind: String(previous.type ?? 'series'),
      ids: [],
      edition: null,
      episode: previous.season == null && previous.episode == null
        ? null
        : { order: 'aired', season: previous.season, episode: previous.episode },
    } : null,
  };
}

export function continuation(rows: readonly Record<string, unknown>[] = []) {
  return {
    scope: { kind: 'viptv:device', account: '7', profile: '1', generation: 1 },
    revision: 1,
    entries: rows.map(queueEntry),
    next_cursor: null,
    complete: true,
  };
}