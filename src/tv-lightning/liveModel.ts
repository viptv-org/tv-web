import type { Guide, GuideProgram, LiveCategory, MediaItem } from "../api";
import {
  WINDOW_SECONDS, cellAt, channelMonogram, clockTime, elapsed, filterOptions,
  firstVisibleRow, guideCells, guideZone, programAfter, timeRange, tvSpan,
  type GuideCell,
} from "../ui/guide-core";
import { railIcon } from "./railIcons";

export interface LiveFilterView {
  id: string;
  label: string;
  x: number;
  width: number;
  selected: boolean;
  icon: string;
}
export interface LiveChannelView {
  row: number;
  channel: MediaItem;
  number: string;
  monogram: string;
  name: string;
  y: number;
}
export interface LiveProgramView {
  id: string;
  row: number;
  index: number;
  channel: MediaItem;
  cell: GuideCell;
  program?: GuideProgram;
  x: number;
  y: number;
  width: number;
  title: string;
  range: string;
  missing: boolean;
  airing: boolean;
  progress: number;
}
export interface LiveHeroView {
  channel: MediaItem | null;
  label: string;
  title: string;
  range: string;
  next: string;
  monogram: string;
  progress: number;
  minutesLeft: string;
  airing: boolean;
}
export const emptyLiveHero: LiveHeroView = {
  channel: null, label: "", title: "", range: "", next: "", monogram: "", progress: 0,
  minutesLeft: "", airing: false,
};

const widthOf = (label: string) => Math.max(92, Math.round(label.length * 13 + 57));

export function liveFilters(categories: readonly LiveCategory[], active: string): LiveFilterView[] {
  const options = filterOptions(categories);
  let x = 258;
  const choices = options.map(option => {
    const width = option.id === "all" ? 237 : widthOf(option.label);
    const view = { id: option.id, label: option.label, x, width, selected: option.id === active, icon: "" };
    x += width + 6;
    return view;
  });
  return [{ id: "search", label: "", x: 192, width: 52, selected: false, icon: railIcon("search") }, ...choices];
}

export function projectLiveGuide(
  channels: readonly MediaItem[],
  guides: Readonly<Record<string, Guide>>,
  now: number,
  windowStart: number,
  selectedRow: number,
  selectedCellIndex: number | null,
  offset: number,
): {
  channels: LiveChannelView[];
  programs: LiveProgramView[];
  timeline: { x: number; label: string }[];
  nowX: number;
  nowLabel: string;
  hero: LiveHeroView;
  first: number;
} {
  const first = firstVisibleRow(selectedRow, channels.length);
  const visible = channels.slice(first, first + 5);
  const zone = guideZone(guides[visible[0]?.id]?.timezone);
  const channelViews: LiveChannelView[] = [];
  const programViews: LiveProgramView[] = [];
  const byRow = new Map<number, readonly GuideCell[]>();
  for (let slot = 0; slot < visible.length; slot++) {
    const row = first + slot;
    const channel = visible[slot];
    // Renderer props are reactive; keep each view's item separate from the
    // canonical channel list so focus updates cannot rewrite API identities.
    const viewChannel = { ...channel };
    const y = 515 + slot * 100;
    channelViews.push({ row, channel: viewChannel, number: String(offset + row + 1), monogram: channelMonogram(channel.name), name: channel.name, y });
    const cells = guideCells(guides[channel.id]?.programs ?? [], windowStart, windowStart + WINDOW_SECONDS);
    byRow.set(row, cells);
    for (let index = 0; index < cells.length; index++) {
      const cell = cells[index];
      const width = Math.max(0, tvSpan(cell.end - cell.start) - 8);
      programViews.push({
        id: `${channel.id}:${index}:${cell.start}`, row, index, channel: { ...channel }, cell, program: cell.program,
        x: 492 + tvSpan(cell.start - windowStart) + 4,
        y: y - 1, width,
        title: cell.missing ? "No guide data — press OK to watch live" : cell.title,
        range: timeRange(cell.start, cell.program?.end ?? cell.end, zone),
        missing: cell.missing,
        airing: !cell.missing && cell.start <= now && cell.end > now,
        progress: elapsed(cell.start, cell.end, now),
      });
    }
  }
  const channel = channels[selectedRow];
  let hero = emptyLiveHero;
  if (channel) {
    const cells = byRow.get(selectedRow) ?? guideCells(guides[channel.id]?.programs ?? [], windowStart, windowStart + WINDOW_SECONDS);
    const cell = selectedCellIndex === null ? cells[cellAt(cells, now)] : cells[selectedCellIndex];
    const program = cell?.missing ? undefined : cell?.program;
    const next = program ? programAfter(guides[channel.id]?.programs ?? [], program) : undefined;
    const airing = !!program && !!cell && cell.start <= now && cell.end > now;
    hero = {
      channel: { ...channel },
      label: `${offset + selectedRow + 1} · ${channel.name}`,
      title: program?.title || channel.name,
      range: cell && program ? timeRange(cell.start, cell.end, zone, true) : "",
      next: next ? `Next at ${clockTime(next.start, zone, false)} · ${next.title}` : !program && guides[channel.id] ? "No guide information. You can still watch this channel." : "",
      monogram: channelMonogram(channel.name),
      progress: airing ? elapsed(cell.start, cell.end, now) : 0,
      minutesLeft: airing ? `${Math.max(1, Math.ceil((program.end - now) / 60))} min left` : "",
      airing,
    };
  }
  return {
    channels: channelViews, programs: programViews, hero, first,
    timeline: Array.from({ length: 6 }, (_, index) => ({
      x: 492 + index * 300,
      label: clockTime(windowStart + index * 1_800, zone),
    })),
    nowX: now >= windowStart && now < windowStart + WINDOW_SECONDS ? 492 + tvSpan(now - windowStart) : -1,
    nowLabel: clockTime(now, zone, false),
  };
}
