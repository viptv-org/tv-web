import { type Guide as GuideData, type GuideProgram, type LiveCategory, type MediaItem } from "../api";

/* Pure guide math: cell slicing, windowing and category filters. */
export const PAGE_SIZE = 40;
export const VISIBLE_ROWS = 5;
export const PREFETCH_ROWS = 2;
// The responsive guide keeps a whole category's rows in one scroll, so appended
// pages must not evict the schedules of the channels above them.
export const GUIDE_CACHE_LIMIT = 200;
export const GUIDE_CELL_LIMIT = 32;
export const WINDOW_SECONDS = 7_200;
export const HOUR_SECONDS = 3_600;
export const DAY_SECONDS = 86_400;
export const GUIDE_WIDTH = 804;
export const RESPONSIVE_WINDOW_SECONDS = 21_600;
export const RESPONSIVE_TIMELINE_WIDTH = 1_440;

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

export function firstVisibleRow(selected: number, count: number): number {
  return Math.max(0, Math.min(count - 1, selected) - (VISIBLE_ROWS - 1));
}

export function filterOptions(categories: readonly LiveCategory[]) {
  return [
    {
      id: "all",
      label: "All US channels",
      collection: undefined,
      category: undefined,
    },
    {
      id: "favorites",
      label: "My channels",
      collection: "favorites",
      category: undefined,
    },
    {
      id: "recent",
      label: "Recent",
      collection: "recent",
      category: undefined,
    },
    ...categories.map((category) => ({
      id: `category:${category.id}`,
      label: `${category.name} · ${category.count}`,
      collection: undefined,
      category: category.id,
    })),
  ] as const;
}
