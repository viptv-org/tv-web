import type { CardPresentation, MediaItem } from "../../api";

/*
 * Caption and meta strings for Home cards and the hero, in the design's
 * wording (reference screens Main, DeskHome, TvHome; copy.md). The Rust
 * presentation owns the data (progress, episode label, queue status); these
 * helpers only format it for the redesigned cards.
 */

/** Minutes:seconds, as the cards draw resume points ("73:46", "0:04"). */
export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** "1 h 40 min" / "52 min" from a minute count. */
export function formatMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  return `${Math.floor(whole / 60)} h ${String(whole % 60).padStart(2, "0")} min`;
}

/** Catalog runtimes arrive as "100 min"; the design reads "1 h 40 min". Other shapes pass through. */
export function formatRuntime(runtime: string | undefined): string {
  if (!runtime) return "";
  const match = /^\s*(\d+)\s*(?:min|mins|m)\s*$/i.exec(runtime);
  return match ? formatMinutes(Number(match[1])) : runtime.trim();
}

const QUEUE_STATUS: Readonly<Record<string, string>> = {
  next: "Up next",
  caught_up: "Caught up",
  upcoming: "Coming soon",
  pending: "Find next",
  unavailable: "Find next",
};

const episodeOf = (item: MediaItem) =>
  (item.episode ?? 0) > 0 || item.type === "episode"
    ? `S${item.season ?? 1} E${item.episode || 1}`
    : "";

/**
 * Desktop / TV continue-watching caption: "S1 E1 · Pilot · 5:43" for an
 * episode, "Resume from 73:46" for a title, the queue state otherwise.
 */
export function continueMeta(item: MediaItem, presentation: CardPresentation): string {
  if (item.type === "live") return "";
  const status = QUEUE_STATUS[item.queueStatus ?? ""];
  const position = item.position ?? 0;
  const episode = episodeOf(item);
  if (episode) {
    return [episode, item.episodeTitle, status ?? (position > 0 ? formatClock(position) : "")]
      .filter(Boolean)
      .join(" · ");
  }
  if (status) return status;
  if (position > 0) return `Resume from ${formatClock(position)}`;
  return presentation.subtitle || [item.year, item.type === "movie" ? "Movie" : item.type === "series" ? "Series" : ""].filter(Boolean).join(" · ");
}

/** Phone continue card meta: "2026 · 42 min left" / "S1 E3 · 12 min left". */
export function phoneContinueMeta(item: MediaItem): string {
  const status = QUEUE_STATUS[item.queueStatus ?? ""];
  const position = item.position ?? 0;
  const duration = item.duration ?? 0;
  const left = !status && duration > 0 && position > 0 ? `${formatMinutes((duration - position) / 60)} left` : status ?? "";
  return [episodeOf(item) || (item.year ? String(item.year) : ""), left].filter(Boolean).join(" · ");
}

/**
 * Catalog card meta: the episode number or the year, plus a short queue
 * state. Genres and runtimes stay out of the card.
 */
export function cardMeta(item: MediaItem): string {
  if (item.type === "live") return "";
  return [episodeOf(item) || (item.year ? String(item.year) : ""), QUEUE_STATUS[item.queueStatus ?? ""]]
    .filter(Boolean)
    .join(" · ");
}

const titleCase = (text: string) => text.replace(/(^|[\s-])([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase());

/** A live tile's second line: the feed's region ("West") or its section ("Entertainment"). */
export function liveSubtitle(item: MediaItem): string {
  const region = item.description?.trim();
  if (region && region.length <= 24) return region;
  const extra = item as MediaItem & { category?: string };
  const raw = item.raw as Record<string, unknown> | undefined;
  const section = extra.category ?? (typeof raw?.section === "string" ? raw.section : typeof raw?.category === "string" ? raw.category : "");
  return section ? titleCase(section) : item.genres[0] ?? "";
}

const STOP_WORDS = new Set(["the", "of", "and", "&", "a", "an", "tv", "hd"]);

/**
 * Channel logos are always text monograms in display type (components.md §6):
 * a short one-word name as it is ("SYFY", "CNBC"), a leading acronym ("ABC
 * News Live" → "ABC"), else the initials of the name ("Cartoon Network" → "CN").
 */
export function channelMonogram(name: string): string {
  const words = name.replace(/[()[\]]/g, " ").split(/[\s/_-]+/).filter(Boolean);
  if (!words.length) return "";
  const [first] = words;
  if (words.length === 1) return first.length <= 5 ? first : first.slice(0, 4).toUpperCase();
  if (/^[A-Z0-9]{2,4}$/.test(first)) return first;
  const initials = words.filter((word) => !STOP_WORDS.has(word.toLowerCase())).map((word) => word[0]!.toUpperCase());
  return (initials.length ? initials : words.map((word) => word[0]!.toUpperCase())).slice(0, 3).join("");
}
