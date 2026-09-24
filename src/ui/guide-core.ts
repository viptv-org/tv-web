import { type GuideProgram, type LiveCategory } from "../api";

/* Pure guide math: cell slicing, windowing, category filters and labels. */
export const PAGE_SIZE = 40;
/** TV rows rendered at once: four full rows plus a peek row (TvLive). */
export const VISIBLE_ROWS = 5;
export const PREFETCH_ROWS = 2;
// The responsive guide keeps a whole category's rows in one scroll, so appended
// pages must not evict the schedules of the channels above them.
export const GUIDE_CACHE_LIMIT = 200;
export const GUIDE_CELL_LIMIT = 32;
export const HOUR_SECONDS = 3_600;
export const DAY_SECONDS = 86_400;

/*
 * Time scales in px per minute (never stretched blocks): wider screens show
 * more hours. TvLive.html draws 300 px per half hour on the 1920 × 1080
 * canvas; DeskLive.html draws 200 px per half hour.
 */
export const TV_MINUTE_PX = 10;
/** TV timeline width: 1920 − 192 left − 96 right safe area − 300 channel column (TvLive.html). */
export const GUIDE_WIDTH = 1_332;
/** The TV window is exactly what the timeline shows, so no block is ever clipped by it. */
export const WINDOW_SECONDS = (GUIDE_WIDTH / TV_MINUTE_PX) * 60;
/** Desktop / web: 200 px per half hour (DeskLive.html). */
export const DESKTOP_HALF_HOUR_PX = 200;
export const RESPONSIVE_WINDOW_SECONDS = 21_600;
/** Px for a span of seconds on the TV / desktop timelines. */
export const tvSpan = (seconds: number) => (seconds * TV_MINUTE_PX) / 60;
export const deskSpan = (seconds: number) => (seconds * DESKTOP_HALF_HOUR_PX) / 1_800;
export const RESPONSIVE_TIMELINE_WIDTH = deskSpan(RESPONSIVE_WINDOW_SECONDS);

export const halfHour = () => Math.floor(Date.now() / 1_800_000) * 1_800;

export interface GuideCell {
  readonly start: number;
  readonly end: number;
  readonly title: string;
  readonly missing: boolean;
  readonly program?: GuideProgram;
}

/** Roku's half-open EPG policy: show gaps as actionable cells, never empty rows. */
export function guideCells(
  programs: readonly GuideProgram[],
  startAt: number,
  finishAt: number,
): readonly GuideCell[] {
  const entries = programs
    .filter(
      (program) =>
        program.end > program.start &&
        program.end > startAt &&
        program.start < finishAt,
    )
    .slice(0, 100)
    .sort((left, right) => left.start - right.start);
  const cells: GuideCell[] = [];
  let cursor = startAt;
  const push = (cell: GuideCell) => {
    if (cells.length < GUIDE_CELL_LIMIT && cell.end > cell.start)
      cells.push(cell);
  };

  for (const program of entries) {
    if (cells.length >= GUIDE_CELL_LIMIT) break;
    const start = Math.max(cursor, program.start, startAt);
    const end = Math.min(program.end, finishAt);
    if (start > cursor) {
      push({
        start: cursor,
        end: start,
        title: "No schedule available",
        missing: true,
      });
    }
    if (end > start) {
      push({
        start,
        end,
        title: program.title || "Untitled programme",
        missing: false,
        program,
      });
      cursor = end;
    }
  }
  if (cursor < finishAt) {
    push({
      start: cursor,
      end: finishAt,
      title: "No schedule available",
      missing: true,
    });
  }
  return cells;
}

export function cellAt(cells: readonly GuideCell[], at: number): number {
  const index = cells.findIndex((cell) => cell.start <= at && cell.end > at);
  return index < 0 ? 0 : index;
}

/**
 * First rendered TV row: the selected row stays within the first four, so the
 * fifth (clipped) row only ever peeks and is never focused.
 */
export function firstVisibleRow(selected: number, count: number): number {
  return Math.max(0, Math.min(count - 1, selected) - (VISIBLE_ROWS - 2));
}

/** The programme on air at `now` and the one after it. */
export function nowNext(programs: readonly GuideProgram[], now: number) {
  const sorted = programs.filter((program) => program.end > now).sort((left, right) => left.start - right.start);
  const current = sorted.find((program) => program.start <= now && program.end > now);
  const next = sorted.find((program) => program.start >= (current?.end ?? now));
  return { current, next };
}

/** The programme that follows `program` in a schedule. */
export function programAfter(programs: readonly GuideProgram[], program: GuideProgram) {
  return programs
    .filter((candidate) => candidate.start >= program.end)
    .sort((left, right) => left.start - right.start)[0];
}

/** Share of `[start, end)` elapsed at `now`, 0–1. */
export function elapsed(start: number, end: number, now: number) {
  return end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 0;
}

export type GuideFilter = {
  readonly id: string;
  readonly label: string;
  /** Channel count for categories (desktop sidebar); none for the collections. */
  readonly count?: number;
  readonly collection?: string;
  readonly category?: string;
};

export function filterOptions(categories: readonly LiveCategory[]): readonly GuideFilter[] {
  return [
    { id: "all", label: "All US channels" },
    { id: "favorites", label: "My channels", collection: "favorites" },
    { id: "recent", label: "Recent", collection: "recent" },
    ...categories.map((category) => ({
      id: `category:${category.id}`,
      label: category.name,
      count: category.count,
      category: category.id,
    })),
  ];
}

const STOP_WORDS = new Set(["the", "of", "and", "&", "a", "an", "tv", "hd"]);

/**
 * Channel logos are always text monograms in display type (components.md §6):
 * a short one-word name as it is ("SYFY", "CNBC"), a leading acronym ("ABC
 * News Live" → "ABC"), else the initials of the name ("Cartoon Network" → "CN").
 * Same rule as the Home live tiles (components/cards/cardText.ts).
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

/** A validated IANA zone for Intl, or undefined (browser-local labels). */
export function guideZone(zone: string | undefined): string | undefined {
  if (!zone) return undefined;
  try {
    new Intl.DateTimeFormat([], { timeZone: zone });
    return zone;
  } catch {
    return undefined;
  }
}

/** "10:30 AM" (withPeriod) or "10:30": the design's block and range times drop the period. */
export function clockTime(time: number, zone?: string, withPeriod = true): string {
  const format = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit", timeZone: zone });
  const date = new Date(time * 1000);
  if (withPeriod) return format.format(date);
  return format
    .formatToParts(date)
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim();
}

/** "10:30 – 12:00" (TV hero: "10:30 – 12:00 PM", the period once at the end). */
export function timeRange(start: number, end: number, zone?: string, periodAtEnd = false): string {
  return `${clockTime(start, zone, false)} – ${clockTime(end, zone, periodAtEnd)}`;
}

/** "Eastern time" for the guide's zone (desktop subtitle), else the zone id or "Local time". */
export function zoneLabel(zone: string | undefined, at: number): string {
  if (!zone) return "Local time";
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longGeneric" } as Intl.DateTimeFormatOptions)
      .formatToParts(new Date(at * 1000))
      .find((part) => part.type === "timeZoneName")?.value;
    if (name && !/^GMT/.test(name)) return name.replace(/ Time$/, " time");
  } catch {
    /* Engines without longGeneric fall back to the zone id. */
  }
  return zone;
}
