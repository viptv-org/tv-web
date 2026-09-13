import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  TvApi,
  type Guide as GuideData,
  type GuideProgram,
  type LiveCategory,
  type MediaItem,
} from "../api";
import { TvButton, focusElement } from "./remote";
import { TextEntry } from "./TextEntry";
import "./account-roku.css";

const PAGE_SIZE = 40;
const VISIBLE_ROWS = 5;
const PREFETCH_ROWS = 2;
const GUIDE_CACHE_LIMIT = 40;
const GUIDE_CELL_LIMIT = 32;
const WINDOW_SECONDS = 7_200;
const HOUR_SECONDS = 3_600;
const DAY_SECONDS = 86_400;
const GUIDE_WIDTH = 804;

const halfHour = () => Math.floor(Date.now() / 1_800_000) * 1_800;

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

function cellAt(cells: readonly GuideCell[], at: number): number {
  const index = cells.findIndex((cell) => cell.start <= at && cell.end > at);
  return index < 0 ? 0 : index;
}

function firstVisibleRow(selected: number, count: number): number {
  return Math.max(0, Math.min(count - 1, selected) - (VISIBLE_ROWS - 1));
}

function filterOptions(categories: readonly LiveCategory[]) {
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

export function Guide({
  api,
  onPlay,
  onError,
  onDetails,
}: {
  api: TvApi;
  onPlay: (item: MediaItem) => void;
  onError: (error: unknown) => void;
  onDetails: (item: MediaItem, program?: GuideProgram) => void;
}) {
  const [channels, setChannels] = useState<readonly MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [collection, setCollection] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [query, setQuery] = useState("");
  const [searchEntry, setSearchEntry] = useState(false);
  const [categories, setCategories] = useState<readonly LiveCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState<GuideCell>();
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [windowStart, setWindowStart] = useState(halfHour);
  const [now, setNow] = useState(Date.now() / 1000);
  const [following, setFollowing] = useState(true);
  const [guides, setGuides] = useState<Record<string, GuideData>>({});
  const cache = useRef(
    new Map<string, { expires: number; guide: GuideData }>(),
  );
  const loadGeneration = useRef(0);
  const focusAfterLoad = useRef<number | null>(null);
  const focusAfterTimeline = useRef<{ row: number; at: number } | null>(null);
  const cellsByRow = useRef(new Map<number, readonly GuideCell[]>());

  const visibleFirst = firstVisibleRow(selected, channels.length);
  const visibleChannels = channels.slice(
    visibleFirst,
    visibleFirst + VISIBLE_ROWS,
  );
  const filterItems = filterOptions(categories);

  const visibleCells = useMemo(() => {
    const next = new Map<number, readonly GuideCell[]>();
    for (let slot = 0; slot < visibleChannels.length; slot += 1) {
      const row = visibleFirst + slot;
      const channel = visibleChannels[slot];
      next.set(
        row,
        guideCells(
          guides[channel.id]?.programs ?? [],
          windowStart,
          windowStart + WINDOW_SECONDS,
        ),
      );
    }
    return next;
  }, [guides, visibleChannels, visibleFirst, windowStart]);
  cellsByRow.current = visibleCells;

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() / 1000);
      if (following) setWindowStart(halfHour());
    }, 30_000);
    return () => clearInterval(timer);
  }, [following]);

  useEffect(() => {
    const scope = api.createScope();
    let active = true;
    void api
      .liveCategories("us", { signal: scope.signal })
      .then((result) => {
        if (active && !scope.signal.aborted) setCategories(result.categories);
      })
      .catch((error) => {
        if (active && !scope.signal.aborted) onError(error);
      });
    return () => {
      active = false;
      scope.abort();
    };
  }, [api]);

  useEffect(() => {
    const scope = api.createScope();
    const generation = ++loadGeneration.current;
    const delay = query ? 650 : 0;
    // A route is atomic: stale rows must not remain focusable during a new
    // filter/search/page request, even if an aborted transport resolves late.
    setChannels([]);
    setSelectedProgram(undefined);
    setLoading(true);
    const timer = setTimeout(() => {
      void api
        .live(
          {
            view: "us",
            collection,
            category,
            search: query.trim() || undefined,
            offset,
            limit: PAGE_SIZE,
          },
          { signal: scope.signal },
        )
        .then((page) => {
          if (scope.signal.aborted || generation !== loadGeneration.current)
            return;
          const target = Math.max(
            0,
            Math.min(focusAfterLoad.current ?? 0, page.channels.length - 1),
          );
          focusAfterLoad.current = null;
          setChannels(page.channels);
          setTotal(page.total);
          setSelected(target);
          if (page.channels.length > 0) {
            setTimeout(() => {
              if (generation === loadGeneration.current)
                focusElement(`guide-channel-${target}`);
            }, 0);
          }
        })
        .catch((error) => {
          if (!scope.signal.aborted && generation === loadGeneration.current)
            onError(error);
        })
        .finally(() => {
          if (!scope.signal.aborted && generation === loadGeneration.current)
            setLoading(false);
        });
    }, delay);
    return () => {
      clearTimeout(timer);
      scope.abort();
    };
  }, [api, category, collection, offset, query]);

  useEffect(() => {
    const scope = api.createScope();
    const needed = channels
      .slice(visibleFirst, visibleFirst + VISIBLE_ROWS + PREFETCH_ROWS)
      .filter(
        (channel) => (cache.current.get(channel.id)?.expires ?? 0) < Date.now(),
      );
    let cursor = 0;
    const worker = async () => {
      while (!scope.signal.aborted && cursor < needed.length) {
        const channel = needed[cursor++];
        let guide: GuideData = { programs: [], timezone: "" };
        let ttl = 60_000;
        try {
          guide = await api.guide(channel.id, { signal: scope.signal });
          ttl = 300_000;
        } catch {
          // A missing guide is represented by generated schedule-gap cells.
        }
        if (scope.signal.aborted) return;
        cache.current.delete(channel.id);
        cache.current.set(channel.id, { guide, expires: Date.now() + ttl });
        while (cache.current.size > GUIDE_CACHE_LIMIT) {
          cache.current.delete(cache.current.keys().next().value as string);
        }
        setGuides(
          Object.fromEntries(
            Array.from(cache.current, ([id, entry]) => [id, entry.guide]),
          ),
        );
      }
    };
    for (
      let workerIndex = 0;
      workerIndex < Math.min(3, needed.length);
      workerIndex += 1
    )
      void worker();
    return () => scope.abort();
  }, [api, channels, visibleFirst]);

  useEffect(() => {
    const pending = focusAfterTimeline.current;
    if (!pending) return;
    const cells = cellsByRow.current.get(pending.row);
    if (!cells?.length) return;
    focusAfterTimeline.current = null;
    const index = cellAt(cells, pending.at);
    setTimeout(() => focusElement(`guide-program-${pending.row}-${index}`), 0);
  }, [visibleCells, windowStart]);

  const routePage = (nextOffset: number, focusRow: number) => {
    focusAfterLoad.current = focusRow;
    setOffset(nextOffset);
  };

  const moveWindow = (direction: -1 | 1, row?: number, focusAt?: number) => {
    const minimum = halfHour();
    const maximum = minimum + DAY_SECONDS;
    const next = Math.max(
      minimum,
      Math.min(maximum, windowStart + direction * HOUR_SECONDS),
    );
    if (next === windowStart) return false;
    setFollowing(false);
    if (row !== undefined && focusAt !== undefined)
      focusAfterTimeline.current = { row, at: focusAt };
    setWindowStart(next);
    return true;
  };

  const restoreNow = () => {
    setFollowing(true);
    setWindowStart(halfHour());
  };

  const closeSearchEntry = () => {
    setSearchEntry(false);
    // TextEntry owns its controls while open. Once it unmounts, return the
    // remote to the action that opened it instead of leaving focus on body.
    setTimeout(() => focusElement("guide-search"), 0);
  };

  const searchEntryKey = (event: React.KeyboardEvent) => {
    if (
      !["Escape", "BrowserBack"].includes(event.key) &&
      event.keyCode !== 10009 &&
      event.keyCode !== 461
    )
      return;
    // React's capture listener runs before RemoteRoot's window listener. The
    // entry must consume Back itself so it closes instead of navigating away
    // from Live TV.
    event.preventDefault();
    event.stopPropagation();
    closeSearchEntry();
  };

  const key = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const id = target.dataset.focusId ?? "";
    if (!id.startsWith("guide-") && !id.startsWith("live-filter-")) return;
    const channelMatch = /^guide-channel-(\d+)$/.exec(id);
    const programMatch = /^guide-program-(\d+)-(\d+)$/.exec(id);

    if (event.key === "MediaPlay" || event.key === "MediaPlayPause") {
      const row = Number((channelMatch ?? programMatch)?.[1]);
      const channel = channels[row];
      if (!channel) return;
      event.preventDefault();
      event.stopPropagation();
      onPlay(channel);
      return;
    }

    if (
      event.key === "MediaTrackPrevious" ||
      event.key === "Replay" ||
      event.key === "InstantReplay"
    ) {
      event.preventDefault();
      event.stopPropagation();
      restoreNow();
      return;
    }
    if (
      (event.key === "MediaRewind" || event.key === "MediaFastForward") &&
      programMatch
    ) {
      event.preventDefault();
      event.stopPropagation();
      const row = Number(programMatch[1]);
      const direction = event.key === "MediaRewind" ? -1 : 1;
      moveWindow(direction, row, windowStart + direction * HOUR_SECONDS);
      return;
    }
    if (
      (channelMatch || programMatch) &&
      event.key === "ArrowUp" &&
      selected === 0 &&
      offset > 0
    ) {
      event.preventDefault();
      event.stopPropagation();
      routePage(Math.max(0, offset - PAGE_SIZE), PAGE_SIZE - 1);
      return;
    }
    if (
      (channelMatch || programMatch) &&
      event.key === "ArrowDown" &&
      selected === channels.length - 1 &&
      offset + channels.length < total
    ) {
      event.preventDefault();
      event.stopPropagation();
      routePage(offset + PAGE_SIZE, 0);
      return;
    }
    if (
      (channelMatch || programMatch) &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      event.stopPropagation();
      const row = Number((channelMatch ?? programMatch)?.[1]);
      const nextRow = row + (event.key === "ArrowUp" ? -1 : 1);
      if (nextRow < 0 || nextRow >= channels.length) return;
      const anchor = programMatch
        ? (cellsByRow.current.get(row)?.[Number(programMatch[2])]?.start ?? now)
        : now;
      setSelected(nextRow);
      if (programMatch)
        focusAfterTimeline.current = { row: nextRow, at: anchor };
      else setTimeout(() => focusElement(`guide-channel-${nextRow}`), 0);
      return;
    }
    if (
      id.startsWith("live-filter-") &&
      event.key === "ArrowRight" &&
      channels.length
    ) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(`guide-channel-${selected}`);
      return;
    }
    if (event.key === "ArrowLeft" && channelMatch) {
      event.preventDefault();
      event.stopPropagation();
      focusElement("live-filter-0");
      return;
    }
    if (
      !programMatch ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    )
      return;

    const row = Number(programMatch[1]);
    const index = Number(programMatch[2]);
    const cells = cellsByRow.current.get(row) ?? [];
    if (!cells[index]) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "ArrowLeft") {
      if (index > 0) {
        focusElement(`guide-program-${row}-${index - 1}`);
        return;
      }
      if (!moveWindow(-1, row, windowStart - 1)) focusElement("live-filter-0");
      return;
    }
    if (index + 1 < cells.length) {
      focusElement(`guide-program-${row}-${index + 1}`);
      return;
    }
    moveWindow(
      1,
      row,
      Math.min(
        halfHour() + DAY_SECONDS + WINDOW_SECONDS - 1,
        windowStart + HOUR_SECONDS,
      ),
    );
  };

  const activateCell = (channel: MediaItem, cell: GuideCell) => {
    if (cell.start > now) onDetails(channel, cell.program);
    else onPlay(channel);
  };

  const formatTime = (time: number) =>
    new Date(time * 1000).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  const selectedGuide = channels[selected]
    ? guides[channels[selected].id]
    : undefined;
  return (
    <main className="guide roku-guide" onKeyDown={key}>
      <h1>Live TV</h1>
      <div className="guide-filters">
        <TvButton id="guide-search" onActivate={() => setSearchEntry(true)}>
          {query ? `Search Live TV: ${query}` : "Search Live TV"}
        </TvButton>
        {filterItems.map((filter, index) => (
          <TvButton
            id={`live-filter-${index}`}
            key={filter.id}
            aria-pressed={
              filter.collection === collection && filter.category === category
            }
            onActivate={() => {
              focusAfterLoad.current = 0;
              setCollection(filter.collection);
              setCategory(filter.category);
              setOffset(0);
            }}
          >
            {filter.label}
          </TvButton>
        ))}
      </div>
      <div className="guide-header">
        {[0, 1, 2, 3].map((index) => (
          <span key={index}>
            {selectedGuide?.timeline?.find(
              (point) => point.time === windowStart + index * 1_800,
            )?.displayTime ?? formatTime(windowStart + index * 1_800)}
          </span>
        ))}
      </div>
      <div className="guide-rows">
        {visibleChannels.map((channel, slot) => {
          const row = visibleFirst + slot;
          const cells = visibleCells.get(row) ?? [];
          return (
            <div
              className="guide-row"
              data-testid={`guide-row-${row}`}
              key={channel.id}
            >
              <TvButton
                id={`guide-channel-${row}`}
                onFocus={() => setSelected(row)}
                onActivate={() => onPlay(channel)}
                onHold={() => onDetails(channel)}
              >
                {channel.poster && !failedLogos.has(channel.id) ? (
                  <img
                    src={channel.poster}
                    alt={channel.name}
                    onError={() =>
                      setFailedLogos((previous) =>
                        new Set(previous).add(channel.id),
                      )
                    }
                  />
                ) : (
                  <span>{channel.name}</span>
                )}
              </TvButton>
              <div className="programs">
                {cells.map((cell, index) => {
                  const left =
                    ((cell.start - windowStart) / WINDOW_SECONDS) * GUIDE_WIDTH;
                  const width =
                    ((cell.end - cell.start) / WINDOW_SECONDS) * GUIDE_WIDTH;
                  return (
                    <TvButton
                      style={{
                        position: "absolute",
                        left,
                        width: Math.max(1, width - 3),
                        height: 87,
                      }}
                      id={`guide-program-${row}-${index}`}
                      key={`${cell.start}-${cell.end}-${index}`}
                      onFocus={() => {
                        setSelected(row);
                        setSelectedProgram(cell);
                      }}
                      onActivate={() => activateCell(channel, cell)}
                      onHold={() => onDetails(channel, cell.program)}
                    >
                      {width > 52 && (
                        <>
                          <small>
                            {cell.missing
                              ? "LIVE CHANNEL"
                              : cell.program &&
                                  cell.program.start <= now &&
                                  cell.program.end > now
                                ? `${Math.ceil((cell.program.end - now) / 60)} MIN LEFT`
                                : typeof cell.program?.raw.display_time ===
                                    "string"
                                  ? cell.program.raw.display_time
                                  : formatTime(cell.start)}
                          </small>
                          <span>{cell.title}</span>
                        </>
                      )}
                    </TvButton>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {now >= windowStart && now < windowStart + WINDOW_SECONDS && (
        <div
          className="guide-now"
          style={{
            left:
              432 +
              Math.floor(((now - windowStart) / WINDOW_SECONDS) * GUIDE_WIDTH),
          }}
        />
      )}
      <div className="guide-selection-count">
        {channels.length
          ? `${offset + selected + 1} / ${total}`
          : `${total} channels`}
      </div>
      <p className="guide-selection-title">
        {selectedProgram?.missing
          ? channels[selected]?.name
          : (selectedProgram?.title ?? channels[selected]?.name)}
      </p>
      <p className="guide-help">
        OK Watch / Details * Details Replay Now Back Sidebar
      </p>
      {selectedGuide?.timezone && (
        <span className="guide-timezone">{selectedGuide.timezone}</span>
      )}
      {!channels.length && (
        <p className="guide-empty" role="status">
          {loading
            ? "Loading channels…"
            : query
              ? "No matching US channels or current programmes. Try a channel name, section, or another title."
              : "No channels here yet. Choose another filter."}
        </p>
      )}
      {searchEntry &&
        createPortal(
          <div onKeyDownCapture={searchEntryKey}>
            <TextEntry
              title="Search Live TV"
              initialValue={query}
              onSubmit={async (value) => {
                focusAfterLoad.current = 0;
                setOffset(0);
                setQuery(value.trim().slice(0, 128));
                setSearchEntry(false);
              }}
              onCancel={closeSearchEntry}
            />
          </div>,
          document.querySelector(".tv-screen") ?? document.body,
        )}
    </main>
  );
}
