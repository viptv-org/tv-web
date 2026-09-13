import type { MediaItem } from "../api";

/** Sparse metadata enriches presentation without dropping saved playback identity. */
export function enrichDetail(
  original: MediaItem,
  metadata: MediaItem,
): MediaItem {
  const present = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  );
  return {
    ...original,
    ...present,
    genres: metadata.genres.length ? metadata.genres : original.genres,
    raw: { ...original.raw, ...metadata.raw },
  };
}
export function mergeEpisodeProgress(
  episodes: readonly MediaItem[],
  history: readonly MediaItem[],
  seriesId: string,
) {
  return episodes.map((episode) => {
    const record =
      history.find((row) => row.id === episode.id) ??
      history.find(
        (row) =>
          row.seriesId === seriesId &&
          row.season !== undefined &&
          row.episode !== undefined &&
          row.season === episode.season &&
          row.episode === episode.episode,
      );
    if (!record) return episode;
    return {
      ...episode,
      position: record.position,
      duration: record.duration ?? episode.duration,
      watched: record.watched,
      sourceAddonId: record.sourceAddonId,
      sourceName: record.sourceName,
      sourceFingerprint: record.sourceFingerprint,
      sourceBingeGroup: record.sourceBingeGroup,
      sourceReleaseGroup: record.sourceReleaseGroup,
      sourceQuality: record.sourceQuality,
      sourceAudio: record.sourceAudio,
      raw: { ...episode.raw, updated_at: record.raw.updated_at ?? 0 },
    };
  });
}
/** Follow the latest episode activity; only advance to a released, unwatched episode. */
export function initialEpisode(
  episodes: readonly MediaItem[],
  original: MediaItem,
) {
  const ordered = [...episodes].sort(
    (a, b) =>
      (a.season ?? 1) - (b.season ?? 1) || (a.episode ?? 0) - (b.episode ?? 0),
  );
  const updated = (item: MediaItem) =>
    typeof item.raw.updated_at === "number" ? item.raw.updated_at : 0;
  const latest = [...ordered]
    .filter((item) => updated(item) > 0)
    .sort((a, b) => updated(b) - updated(a))[0];
  const watched = (item: MediaItem) =>
    item.watched ??
    (!!item.duration && (item.position ?? 0) / item.duration >= 0.95);
  if (latest && watched(latest))
    return (
      ordered.slice(ordered.indexOf(latest) + 1).find((item) => {
        const released =
          typeof item.raw.released === "string"
            ? Date.parse(item.raw.released)
            : NaN;
        return (
          !watched(item) &&
          item.season !== 0 &&
          (Number.isNaN(released) || released <= Date.now())
        );
      }) ?? latest
    );
  return (
    latest ??
    ordered.find((item) => (item.position ?? 0) > 0 && !watched(item)) ??
    ordered.find(
      (item) =>
        original.episode !== undefined &&
        item.season === original.season &&
        item.episode === original.episode,
    ) ??
    ordered.find((item) => !watched(item) && item.season !== 0) ??
    ordered[0]
  );
}
