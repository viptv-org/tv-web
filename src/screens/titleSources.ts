/*
 * Shared title-family helpers: the discovery key of a playable item, source
 * quality ordering / labels and the title facts line.
 */
import type { MediaItem, MediaSource } from "../api";

/** One source discovery per playable item (a movie or an episode). */
export const sourceKey = (item: MediaItem) => `${item.type}:${item.id}`;

/** The filter value of a source without a quality. */
export const UNKNOWN_QUALITY = "Unknown";

export const qualityOf = (source: MediaSource) => source.quality ?? UNKNOWN_QUALITY;
export const providerOf = (source: MediaSource) => source.sourceName ?? source.name;

/** The chips always offer the common qualities (components.md §2), then any others found. */
const STANDARD_QUALITIES = ["4K", "1080p", "720p"];
const LATER_QUALITIES = ["480p", "SD", UNKNOWN_QUALITY];

export function qualityChoices(sources: readonly MediaSource[]) {
  const counts = new Map<string, number>();
  for (const source of sources) counts.set(qualityOf(source), (counts.get(qualityOf(source)) ?? 0) + 1);
  const found = Array.from(counts.keys()).filter((quality) => !STANDARD_QUALITIES.includes(quality));
  found.sort((a, b) => {
    const rank = (quality: string) => (LATER_QUALITIES.includes(quality) ? 100 + LATER_QUALITIES.indexOf(quality) : 50);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return [...STANDARD_QUALITIES, ...found].map((quality) => ({ quality, count: counts.get(quality) ?? 0 }));
}

export const qualityLabel = (quality: string) => (quality === UNKNOWN_QUALITY ? "Other" : quality);

export function matchesFilters(source: MediaSource, quality: string, provider: string) {
  return (quality === "All" || qualityOf(source) === quality) && (provider === "All" || providerOf(source) === provider);
}

/** "100 min" → "1 h 40 min" (the references' runtime form); other strings pass through. */
export function formatRuntime(runtime: string | undefined) {
  if (!runtime) return "";
  const match = /^\s*(\d+)\s*(?:min|mins|minutes|m)?\s*$/i.exec(runtime);
  if (!match) return runtime;
  const minutes = Number(match[1]);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "S1 E2" for an episode, "" otherwise. */
export function episodeCode(item: MediaItem) {
  return item.season !== undefined ? `S${item.season} E${item.episode ?? 1}` : "";
}
