import { useEffect, useMemo, useRef, useState } from "react";
import { TvApi, type Guide as GuideData, type GuideProgram, type LiveCategory, type MediaItem } from "../api";
import { focusElement } from "./remote";
import { DAY_SECONDS, GUIDE_CACHE_LIMIT, GUIDE_CELL_LIMIT, GUIDE_WIDTH, HOUR_SECONDS, PAGE_SIZE, PREFETCH_ROWS, RESPONSIVE_TIMELINE_WIDTH, RESPONSIVE_WINDOW_SECONDS, VISIBLE_ROWS, WINDOW_SECONDS, type GuideCell, cellAt, filterOptions, firstVisibleRow, guideCells, halfHour } from "./guide-core";

export type GuideProps = {
  api: TvApi;
  responsive?: boolean;
  onPlay: (item: MediaItem) => void;
  onError: (error: unknown) => void;
  onDetails: (item: MediaItem, program?: GuideProgram) => void;
};

/* The guide's state, data loading, windowing, key handling and filter
   actions; Guide.tsx renders exclusively from this controller. */
export function useGuideController({ api, onPlay, onError, onDetails, responsive = false }: GuideProps) {
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
  const scrollViewport = useRef<HTMLDivElement>(null);
  const cellsByRow = useRef(new Map<number, readonly GuideCell[]>());
  const [appending, setAppending] = useState(false);
  const appendCursor = useRef(PAGE_SIZE);
  const appendPending = useRef(false);
  const appendScope = useRef<ReturnType<TvApi["createScope"]> | null>(null);

  const visibleFirst = responsive ? 0 : firstVisibleRow(selected, channels.length);
  // The responsive guide scrolls one long channel list, so every loaded row is
  // rendered; the TV guide still shows one bounded window of five rows.
  const rowWindow = responsive ? channels.length : VISIBLE_ROWS;
  const visibleChannels = channels.slice(visibleFirst, visibleFirst + rowWindow);
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
          windowStart + (responsive ? RESPONSIVE_WINDOW_SECONDS : WINDOW_SECONDS),
        ),
      );
    }
    return next;
  }, [guides, visibleChannels, visibleFirst, windowStart, responsive]);
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
    // A route change supersedes any append that was still travelling.
    appendScope.current?.abort();
    appendScope.current = null;
    appendPending.current = false;
    setAppending(false);
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
          appendCursor.current = offset + page.channels.length;
          setChannels(page.channels);
          setTotal(page.total);
          setSelected(target);
          if (!responsive && page.channels.length > 0) {
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
      appendScope.current?.abort();
    };
  }, [api, category, collection, offset, query, responsive]);

  useEffect(() => {
    const scope = api.createScope();
    const needed = channels
      .slice(visibleFirst, visibleFirst + (responsive ? channels.length : VISIBLE_ROWS + PREFETCH_ROWS))
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
  }, [api, channels, visibleFirst, responsive]);

  useEffect(() => {
    const pending = focusAfterTimeline.current;
    if (!pending) return;
    const cells = cellsByRow.current.get(pending.row);
    if (!cells?.length) return;
    focusAfterTimeline.current = null;
    const index = cellAt(cells, pending.at);
    setTimeout(() => focusElement(`guide-program-${pending.row}-${index}`), 0);
  }, [visibleCells, windowStart]);

  useEffect(() => {
    if (scrollViewport.current) scrollViewport.current.scrollTop = 0;
  }, [offset, category, collection, query]);

  const appendChannels = () => {
    if (!responsive || appendPending.current || loading) return;
    if (!channels.length || appendCursor.current >= total) return;
    appendPending.current = true;
    setAppending(true);
    const scope = api.createScope();
    appendScope.current = scope;
    const generation = loadGeneration.current;
    const start = appendCursor.current;
    void api
      .live(
        {
          view: "us",
          collection,
          category,
          search: query.trim() || undefined,
          offset: start,
          limit: PAGE_SIZE,
        },
        { signal: scope.signal },
      )
      .then((page) => {
        if (scope.signal.aborted || generation !== loadGeneration.current) return;
        appendCursor.current = start + page.channels.length;
        setTotal(page.total);
        setChannels((previous) => {
          const known = new Set(previous.map((channel) => channel.id));
          const appended = page.channels.filter(
            (channel) => !known.has(channel.id),
          );
          return appended.length ? [...previous, ...appended] : previous;
        });
      })
      .catch((error) => {
        if (!scope.signal.aborted && generation === loadGeneration.current)
          onError(error);
      })
      .finally(() => {
        appendPending.current = false;
        if (!scope.signal.aborted) setAppending(false);
      });
  };

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

  const pageChannels = (direction: -1 | 1) => {
    const next = visibleFirst + direction * VISIBLE_ROWS;
    setSelectedProgram(undefined);
    if (next >= 0 && next < channels.length) setSelected(next);
    else if (direction > 0 && offset + channels.length < total) routePage(offset + PAGE_SIZE, 0);
    else if (direction < 0 && offset > 0) routePage(Math.max(0, offset - PAGE_SIZE), PAGE_SIZE - VISIBLE_ROWS);
  };

  const restoreNow = () => {
    setFollowing(true);
    setWindowStart(halfHour());
    if (scrollViewport.current) scrollViewport.current.scrollLeft = 0;
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

  const selectedGuide = channels[selected]
    ? guides[channels[selected].id]
    : undefined;
  let guideTimezone: string | undefined;
  if (responsive && selectedGuide?.timezone) {
    try { new Intl.DateTimeFormat([], { timeZone: selectedGuide.timezone }); guideTimezone = selectedGuide.timezone; } catch { /* Unknown server zones use browser-local labels consistently. */ }
  }
  const formatTime = (time: number) =>
    new Date(time * 1000).toLocaleTimeString([], {
      hour: "numeric", minute: "2-digit", timeZone: guideTimezone,
    });
  const selectFilter = (filter: ReturnType<typeof filterOptions>[number]) => {
    focusAfterLoad.current = 0;
    setCollection(filter.collection);
    setCategory(filter.category);
    setOffset(0);
  };
  const activeFilter = filterItems.find(filter => filter.collection === collection && filter.category === category) ?? filterItems[0];
  return {
    activateCell, appendChannels, appendCursor, appendPending,
    appendScope, appending, cache, categories,
    category, cellsByRow, channels, closeSearchEntry,
    collection, failedLogos, filterItems, focusAfterLoad,
    focusAfterTimeline, following, formatTime, guides,
    key, loadGeneration, loading, moveWindow,
    now, offset, pageChannels, query,
    restoreNow, routePage, rowWindow, scrollViewport,
    searchEntry, searchEntryKey, selectFilter, selected,
    selectedGuide, selectedProgram, setAppending, setCategories,
    setCategory, setChannels, setCollection, setFailedLogos,
    setFollowing, setGuides, setLoading, setNow,
    setOffset, setQuery, setSearchEntry, setSelected,
    setSelectedProgram, setTotal, setWindowStart, total,
    visibleCells, visibleChannels, visibleFirst, windowStart,
    activeFilter, guideTimezone
  };
}
