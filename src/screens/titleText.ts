/*
 * Title-page strings in the words the boards draw: the phone Series page
 * (M3Title.html), the phone movie page (M3Movie.html) and the data
 * dictionary's §A4 title-detail entry. Formatting only — DetailScreen owns
 * the arrangement, this owns the text.
 */
import type { MediaItem } from "../api";

/**
 * The declared-certification keys, in the shared engine's own precedence
 * (`core/crates/viptv-engine/src/stremio/media.rs`). The React transport's
 * `MediaItem` has no typed field, so the declared text is read from the
 * provider metadata the normalized item keeps in `raw`.
 */
const CERTIFICATION_KEYS = ["contentRating", "certification", "ageRating", "mpaaRating"] as const;

/** "Series" / "Movie": the fact line's media-kind prefix (M3Title, M3Movie). */
export function titleKind(item: MediaItem): string {
  return item.type === "series" ? "Series" : item.type === "movie" ? "Movie" : "";
}

/**
 * The declared certification as text ("TV-MA", "PG-13"), or undefined. The
 * dictionary draws it as a bordered chip and insists that missing values draw
 * nothing, so an undeclared title carries no badge rather than a guessed one.
 */
export function titleCertification(item: MediaItem): string | undefined {
  for (const key of CERTIFICATION_KEYS) {
    const value = item.raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * The fact line's outlined badges, in board order (M3Title "TV-MA", M3Movie
 * "PG-13"). Only declared metadata reaches this row: the phone boards also draw
 * server-computed capability badges ("HD", "5.1", "4K", "HDR"), which the
 * current backend projection supplies as `Card.view.hero_badges` and the React
 * transport does not carry.
 */
export function titleBadgeLabels(item: MediaItem): string[] {
  const certification = titleCertification(item);
  return certification ? [certification] : [];
}

const compact = (minutes: number): string => {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 1) return "";
  if (whole < 60) return `${whole}m`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

/**
 * The compact runtime the title boards draw: "52m" for an episode, "1h 40m"
 * for a movie. A provider runtime that is not a minute count ("2h 3m") passes
 * through; a playback duration stands in when the metadata carries none.
 */
export function titleRuntime(runtime: string | undefined, seconds?: number): string {
  const text = runtime?.trim();
  if (text) {
    const minutes = /^(\d+)\s*(?:min|mins|minutes|m)?$/i.exec(text);
    return minutes ? compact(Number(minutes[1])) : text;
  }
  return seconds && seconds > 0 ? compact(seconds / 60) : "";
}

/** The episode row's heading as M3Title draws it: "1. Episode One". */
export function phoneEpisodeHeading(item: MediaItem, index: number): string {
  const number = item.episode && item.episode > 0 ? item.episode : index + 1;
  return `${number}. ${item.episodeTitle ?? item.name}`;
}

/**
 * The episode row's caption as M3Title draws it: "52m · 38m left" while an
 * episode is in progress, "52m · Watched" once it is finished, "52m" before
 * either. A fact the profile has no value for is left out.
 */
export function phoneEpisodeMeta(item: MediaItem): string {
  const runtime = titleRuntime(item.runtime, item.duration);
  const watching = !!item.position && (item.resumeActive ?? !item.watched);
  const left = watching ? titleRuntime(undefined, (item.duration ?? 0) - (item.position ?? 0)) : "";
  const state = left ? `${left} left` : item.watched ? "Watched" : "";
  return [runtime, state].filter(Boolean).join(" · ");
}

/**
 * The credit lines the boards draw under the synopsis ("Starring Evan Peters,
 * Richard Jenkins, Niecy Nash" on M3Title and D3Title). The shared core already
 * composes them as "Directed by …" / "Starring …" (`viptv-core` media
 * normalization), so those lines are used as sent; the cast the rich metadata
 * add-ons send composes the same line when the item carries none.
 */
export function titleCreditLines(item: MediaItem, cast: readonly { name: string }[], directors: string): string[] {
  const composed = (item.credits ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (composed.length) return composed;
  const names = cast.slice(0, 4).map((member) => member.name);
  return [directors ? `Directed by ${directors}` : "", names.length ? `Starring ${names.join(", ")}` : ""].filter(Boolean);
}