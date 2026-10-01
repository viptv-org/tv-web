import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LivePageWindow } from './live-page-window';
import { TvApi, TvApiError, type Guide as GuideData, type GuideProgram, type LiveCategory, type MediaItem } from "../api";
import { focusElement } from "./remote";
import { DAY_SECONDS, GUIDE_CACHE_LIMIT, HOUR_SECONDS, PAGE_SIZE, PREFETCH_ROWS, RESPONSIVE_WINDOW_SECONDS, VISIBLE_ROWS, WINDOW_SECONDS, type GuideCell, type GuideFilter, cellAt, clockTime, filterOptions, firstVisibleRow, guideCells, guideZone, halfHour, timeRange } from "./guide-core";

export type GuideProps = {
  api: TvApi;
  responsive?: boolean;
  /** Phone arrangement of the responsive shell: a channel list, not a timeline. */
  phone?: boolean;
  onPlay: (item: MediaItem) => void;
  onError: (error: unknown) => void;
  /**
   * The channel menu (phone long-press, desktop right-click on a channel):
   * Watch channel, Programme details (`details`), Add to / Remove from My List.
   */
  onMenu?: (item: MediaItem, details: () => void) => void;
};

/** Programme details for one channel: `program` absent = no guide information. */
export type GuideDetails = {
  readonly channel: MediaItem;
  readonly program?: GuideProgram;
  /** The TV / desktop block that opened it (kept lit under the panel). */
  readonly block?: string;
};

/* The guide's state, data loading, windowing, key handling and filter
   actions; Guide.tsx renders exclusively from this controller. */
export function useGuideController({ api, onPlay, onError, responsive = false }: GuideProps) {
  const [channels, setChannels] = useState<readonly MediaItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [cursor, setCursor] = useState<string>();
  const [reload, setReload] = useState(0);
  const [offset, setOffset] = useState(0);
  const [collection, setCollection] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [query, setQuery] = useState("");
  const [searchEntry, setSearchEntry] = useState(false);
  const [categories, setCategories] = useState<readonly LiveCategory[]>([]);
  const [categoryCursor, setCategoryCursor] = useState<string>();
  const [categoryReload, setCategoryReload] = useState(0);
  const [categoryPaging, setCategoryPaging] = useState<{ next?: string | null; previous?: string | null }>({});
  const categoryRoot = useRef<HTMLElement | null>(null);
  const [categoryNode, setCategoryNode] = useState<HTMLElement | null>(null);
  const bindCategoryRoot = useCallback((node: HTMLElement | null) => {categoryRoot.current=node;setCategoryNode(node)},[]);
  const selectedFilter = useRef<GuideFilter>({id:'all',label:'All channels'});
  const categoryPending = useRef(false);
  const categoryDirection = useRef<-1 | 1>();
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);
  const rowsRoot = useRef<HTMLElement | null>(null);
  const windowPages = useRef(new LivePageWindow());
  const catalogSnapshot = useRef<{ channels?: string; categories?: string }>({});
  const checkSnapshot = (kind: 'channels' | 'categories', catalogId: string | null, generation: string | null) => {
    const key = JSON.stringify([catalogId, generation]);
    const other = catalogSnapshot.current[kind === 'channels' ? 'categories' : 'channels'];
    if ((other !== undefined && other !== key) || (catalogSnapshot.current[kind] !== undefined && catalogSnapshot.current[kind] !== key)) {
      setCategories([]);
      throw new TvApiError(409, 'This playlist changed while you were browsing. Reload the guide.', 'catalog_changed');
    }
    catalogSnapshot.current[kind] = key;
  };
  const [scheduleRows, setScheduleRows] = useState({ first: 0, end: 12 });
  const anchor = useRef<{ id: string; top: number }>();
  const [selected, setSelected] = useState(0);
  const [selectedProgram, setSelectedProgram] = useState<GuideCell>();
  const [failedLogos, setFailedLogos] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [windowStart, setWindowStart] = useState(halfHour);
  const [now, setNow] = useState(Date.now() / 1000);
  const [following, setFollowing] = useState(true);
  const [guides, setGuides] = useState<Record<string, GuideData>>({});
  const [details, setDetails] = useState<GuideDetails>();
  const detailsReturn = useRef<{ element: HTMLElement | null; id: string }>({ element: null, id: "" });
  const cache = useRef(
    new Map<string, { expires: number; guide: GuideData }>(),
  );
  const loadGeneration = useRef(0);
  const focusAfterLoad = useRef<number | null>(null);
  const focusAfterTimeline = useRef<{ row: number; at: number } | null>(null);
  const pageProgramAnchor = useRef<number>();
  const scrollViewport = useRef<HTMLDivElement>(null);
  const cellsByRow = useRef(new Map<number, readonly GuideCell[]>());
  const [appending, setAppending] = useState(false);
  const appendPending = useRef(false);
  const appendScope = useRef<ReturnType<TvApi["createScope"]> | null>(null);
  const pageRef = useRef<{ next: string | null; previous: string | null }>({ next: null, previous: null });
  const rowNodes = () => Array.from(rowsRoot.current?.querySelectorAll<HTMLElement>('[data-live-channel]') ?? []);
  const scrollRoot = () => {
    if (scrollViewport.current) return scrollViewport.current;
    for (let node = rowsRoot.current?.parentElement; node; node = node.parentElement)
      if (['auto','scroll'].includes(getComputedStyle(node).overflowY)) return node;
    return null;
  };
  const saveAnchor = () => {
    const root = scrollRoot();
    const top = root?.getBoundingClientRect().top ?? 0;
    const node = rowNodes().find(node => node.getBoundingClientRect().bottom > top);
    anchor.current = node ? { id: node.dataset.liveChannel!, top: node.getBoundingClientRect().top } : undefined;
  };
  const removedHeight = (items: readonly MediaItem[]) => {
    const ids = new Set(items.map(item => item.id));
    const nodes=rowNodes();
    const selected=nodes.filter(node => ids.has(node.dataset.liveChannel!));
    const pitch=nodes.length ? nodes.reduce((sum,node)=>sum+(node.getBoundingClientRect().height || 64),0)/nodes.length : 64;
    return selected.length ? selected.reduce((sum,node)=>sum+(node.getBoundingClientRect().height || pitch),0) : items.length*pitch;
  };
  const observeRows = () => {
    const root = scrollRoot();
    const rect = root?.getBoundingClientRect();
    if (!rect || !rect.height) return;
    const nodes = rowNodes();
    const indexes = nodes.map((node,index) => ({ index,rect:node.getBoundingClientRect() }))
      .filter(({rect:row})=>row.bottom>=rect.top-128 && row.top<=rect.bottom+128).map(item=>item.index);
    if (indexes.length) setScheduleRows(previous => {
      const next = {first:indexes[0],end:indexes.at(-1)!+1};
      return previous.first===next.first && previous.end===next.end ? previous : next;
    });
  };
  useLayoutEffect(() => {
    const saved = anchor.current;
    if (saved) {
      const node = rowNodes().find(node => node.dataset.liveChannel===saved.id);
      const root = scrollRoot();
      if (node && root) root.scrollTop += node.getBoundingClientRect().top-saved.top;
      anchor.current=undefined;
    }
    observeRows();
  },[channels,paddingTop,paddingBottom]);
  useEffect(() => {
    if (!responsive) return;
    const root=scrollRoot();
    root?.addEventListener('scroll',observeRows,{passive:true});
    return ()=>root?.removeEventListener('scroll',observeRows);
  },[responsive,channels]);

  const visibleFirst = responsive ? 0 : firstVisibleRow(selected, channels.length);
  // The responsive guide scrolls one long channel list, so every loaded row is
  // rendered; the TV guide still shows one bounded window of five rows.
  const rowWindow = responsive ? channels.length : VISIBLE_ROWS;
  const visibleChannels = channels.slice(visibleFirst, visibleFirst + rowWindow);
  const filterItems = filterOptions(categories);
  const pageCategories = (direction: -1 | 1) => {
    const token = direction > 0 ? categoryPaging.next : categoryPaging.previous;
    if (!token || categoryPending.current) return false;
    categoryPending.current = true;
    categoryDirection.current = direction;
    setCategoryCursor(token);
    setCategoryReload(value=>value+1);
    return true;
  };
  useLayoutEffect(() => {
    const direction = categoryDirection.current;
    const root = categoryRoot.current;
    if (!direction || !root || categoryPending.current) return;
    categoryDirection.current = undefined;
    const controls = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
    if (!responsive) (direction > 0 ? controls.find(node=>node.dataset.focusId==='live-filter-3') : controls.at(-1))?.focus({preventScroll:true});
    root.scrollLeft = direction > 0 ? 0 : root.scrollWidth;
    root.scrollTop = direction > 0 ? 0 : root.scrollHeight;
  }, [categories,responsive]);
  useEffect(() => {
    const root = categoryRoot.current;
    if (!root || !responsive) return;
    let previous = root.scrollLeft + root.scrollTop;
    const boundary = (direction: -1 | 1) => {
      const horizontal = root.scrollWidth > root.clientWidth + 1;
      const position = horizontal ? root.scrollLeft : root.scrollTop;
      const extent = horizontal ? root.scrollWidth-root.clientWidth : root.scrollHeight-root.clientHeight;
      if (direction > 0 && position >= extent-24) pageCategories(1);
      if (direction < 0 && position <= 24) pageCategories(-1);
    };
    const scroll = () => {
      const position = root.scrollLeft + root.scrollTop;
      if (position !== previous) boundary(position > previous ? 1 : -1);
      previous = position;
    };
    const wheel = (event: WheelEvent) => boundary(event.deltaX + event.deltaY > 0 ? 1 : -1);
    root.addEventListener('scroll',scroll,{passive:true});
    root.addEventListener('wheel',wheel,{passive:true});
    return () => { root.removeEventListener('scroll',scroll); root.removeEventListener('wheel',wheel); };
  }, [categories,categoryPaging,responsive,categoryNode]);

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
    categoryPending.current = true;
    if (!categoryCursor) catalogSnapshot.current = {};
    if (!categoryCursor) setCategories([]);
    void api
      .liveCategoriesV2({limit:200,cursor:categoryCursor}, { signal: scope.signal })
      .then((result) => {
        if (active && !scope.signal.aborted) {
          checkSnapshot('categories', result.catalogId, result.generation);
          setCategories(result.items.map(item=>({...item,raw:{}})));
          setCategoryPaging({next:result.nextCursor,previous:result.previousCursor});
          categoryPending.current = false;
        }
      })
      .catch((error) => {
        if (active && !scope.signal.aborted) {
          categoryPending.current = false;
          setFailure(error instanceof Error ? error.message : 'Could not load this playlist. Try again.');
          onError(error);
        }
      });
    return () => {
      active = false;
      scope.abort();
      categoryPending.current = false;
    };
  }, [api,category,collection,query,reload,categoryCursor,categoryReload]);

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
    setFailure(undefined);
    const timer = setTimeout(() => {
      void api
        .liveV2(
          {
            collection: collection as 'favorites'|'recent'|undefined,
            categoryId: category,
            search: query.trim() || undefined,
            cursor,
            limit: PAGE_SIZE,
          },
          { signal: scope.signal },
        )
        .then((page) => {
          if (scope.signal.aborted || generation !== loadGeneration.current)
            return;
          checkSnapshot('channels', page.catalogId, page.generation);
          const target = Math.max(
            0,
            Math.min(focusAfterLoad.current ?? 0, page.items.length - 1),
          );
          focusAfterLoad.current = null;
          windowPages.current.replace(page);
          pageRef.current={next:page.nextCursor,previous:page.previousCursor};
          setChannels(page.items);
          setHasNext(!!page.nextCursor); setHasPrevious(!!page.previousCursor);
          setPaddingTop(0); setPaddingBottom(0);
          setScheduleRows({first:0,end:12});
          setSelected(target);
          const programmeAnchor = pageProgramAnchor.current;
          pageProgramAnchor.current = undefined;
          if (programmeAnchor !== undefined) focusAfterTimeline.current = {row:target,at:programmeAnchor};
          if (!responsive && page.items.length > 0) {
            setTimeout(() => {
              if (generation === loadGeneration.current && programmeAnchor === undefined)
                focusElement(`guide-channel-${target}`);
            }, 0);
          }
        })
        .catch((error) => {
          if (!scope.signal.aborted && generation === loadGeneration.current) {
            setFailure(error instanceof Error ? error.message : 'Could not load this playlist. Try again.');
            onError(error);
          }
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
  }, [api, category, collection, cursor, query, responsive,reload]);

  useEffect(() => {
    const scope = api.createScope();
    const needed = channels
      .slice(responsive ? scheduleRows.first : visibleFirst, responsive ? scheduleRows.end : visibleFirst + VISIBLE_ROWS + PREFETCH_ROWS)
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
          guide = await api.guideV2(channel.id, { signal: scope.signal });
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
  }, [api, channels, visibleFirst, responsive,scheduleRows]);

  useEffect(() => {
    const pending = focusAfterTimeline.current;
    if (!pending) return;
    if (!guides[channels[pending.row]?.id]) return;
    const cells = cellsByRow.current.get(pending.row);
    if (!cells?.length) return;
    focusAfterTimeline.current = null;
    const index = cellAt(cells, pending.at);
    setTimeout(() => focusElement(`guide-program-${pending.row}-${index}`), 0);
  }, [visibleCells, windowStart]);

  useEffect(() => {
    if (scrollViewport.current) scrollViewport.current.scrollTop = 0;
  }, [offset, category, collection, query]);

  const loadAdjacent = (previous = false) => {
    if (!responsive || appendPending.current || loading || !(previous ? hasPrevious : hasNext)) return;
    const token=previous ? pageRef.current.previous : pageRef.current.next;
    if (!channels.length || !token) return;
    appendPending.current = true;
    setAppending(true);
    const scope = api.createScope();
    appendScope.current = scope;
    const generation = loadGeneration.current;
    void api
      .liveV2(
        {
          collection: collection as 'favorites'|'recent'|undefined,
          categoryId: category,
          search: query.trim() || undefined,
          cursor: token,
          limit: PAGE_SIZE,
        },
        { signal: scope.signal },
      )
      .then((page) => {
        if (scope.signal.aborted || generation !== loadGeneration.current) return;
        saveAnchor();
        const old=windowPages.current.items;
        if (previous) {
          const removed=windowPages.current.prepend(page);
          setPaddingTop(value=>Math.max(0,value-removedHeight(page.items)));
          if (removed) setPaddingBottom(value=>value+removedHeight(old.slice(-removed)));
        } else {
          const removed=windowPages.current.append(page);
          if (removed) setPaddingTop(value=>value+removedHeight(old.slice(0,removed)));
          setPaddingBottom(value=>Math.max(0,value-removedHeight(page.items)));
        }
        pageRef.current={next:windowPages.current.next,previous:windowPages.current.previous};
        setHasNext(!!pageRef.current.next); setHasPrevious(!!pageRef.current.previous);
        setChannels(windowPages.current.items);
      })
      .catch((error) => {
        if (!scope.signal.aborted && generation === loadGeneration.current) {
          if (previous) setHasPrevious(false); else setHasNext(false);
          setFailure(error instanceof Error ? error.message : 'Could not load this playlist. Try again.');
          onError(error);
        }
      })
      .finally(() => {
        if (appendScope.current !== scope || generation !== loadGeneration.current) return;
        appendPending.current = false;
        appendScope.current = null;
        if (!scope.signal.aborted) setAppending(false);
      });
  };
  const appendChannels = () => loadAdjacent(false);
  const previousChannels = () => loadAdjacent(true);

  const routePage = (nextOffset: number, focusRow: number) => {
    const match = /^guide-program-(\d+)-(\d+)$/.exec((document.activeElement as HTMLElement | null)?.dataset.focusId ?? '');
    pageProgramAnchor.current = match ? cellsByRow.current.get(Number(match[1]))?.[Number(match[2])]?.start : undefined;
    focusAfterLoad.current = focusRow;
    setOffset(nextOffset);
    setCursor(nextOffset>offset ? pageRef.current.next ?? undefined : pageRef.current.previous ?? undefined);
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
    else if (direction > 0 && hasNext) routePage(offset + PAGE_SIZE, 0);
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

  const filterIndex = (filter: GuideFilter | undefined) =>
    Math.max(0, filterItems.findIndex((item) => item.id === filter?.id));

  const key = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const id = target.dataset.focusId ?? "";
    if (!id.startsWith("guide-") && !id.startsWith("live-filter-")) return;
    const channelMatch = /^guide-channel-(\d+)$/.exec(id);
    const programMatch = /^guide-program-(\d+)-(\d+)$/.exec(id);
    const chip = id === "guide-search" || id.startsWith("live-filter-");
    const filterMatch = /^live-filter-(\d+)$/.exec(id);
    if (filterMatch) {
      const index = Number(filterMatch[1]);
      const direction = event.key === 'ArrowRight' && index === filterItems.length-1 ? 1 : event.key === 'ArrowLeft' && index === 3 ? -1 : undefined;
      if (direction && pageCategories(direction)) {
        event.preventDefault(); event.stopPropagation(); return;
      }
    }

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
    // The chip row sits above the grid: Down enters the guide on the selected channel.
    if (chip && event.key === "ArrowDown" && channels.length) {
      event.preventDefault();
      event.stopPropagation();
      focusElement(`guide-channel-${selected}`);
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
      hasNext
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
      // Up from the first channel returns to the active filter chip.
      if (nextRow < 0) {
        focusElement(`live-filter-${filterIndex(activeFilter)}`);
        return;
      }
      if (nextRow >= channels.length) return;
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
      // At the earliest edge Left leaves the timeline for the channel column.
      if (!moveWindow(-1, row, windowStart - 1)) focusElement(`guide-channel-${row}`);
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

  /*
   * Programme details (Guide-owned dialog). Opening remembers the control that
   * asked for it; closing returns focus there. While open, BACK / Esc close it
   * wherever focus is (a capture listener ahead of RemoteRoot's Back).
   */
  const openDetails = (channel: MediaItem, program?: GuideProgram, block?: string) => {
    const active = document.activeElement as HTMLElement | null;
    detailsReturn.current = { element: active, id: active?.dataset.focusId ?? "" };
    setDetails({ channel, program, block });
  };
  const closeDetails = () => {
    setDetails(undefined);
    const { element, id } = detailsReturn.current;
    detailsReturn.current = { element: null, id: "" };
    setTimeout(() => {
      if (element?.isConnected) element.focus({ preventScroll: true });
      else if (id) focusElement(id);
    }, 0);
  };
  const watchDetails = () => {
    const channel = details?.channel;
    setDetails(undefined);
    detailsReturn.current = { element: null, id: "" };
    if (channel) onPlay(channel);
  };
  useEffect(() => {
    if (!details) return;
    const back = (event: KeyboardEvent) => {
      if (
        !["Escape", "BrowserBack", "GoBack"].includes(event.key) &&
        event.keyCode !== 10009 &&
        event.keyCode !== 461
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDetails();
    };
    window.addEventListener("keydown", back, true);
    return () => window.removeEventListener("keydown", back, true);
  }, [details]);

  /** OK on a programme: upcoming opens its details, airing (or a gap) watches the channel. */
  const activateCell = (channel: MediaItem, cell: GuideCell, block?: string) => {
    if (cell.start > now) openDetails(channel, cell.program, block);
    else onPlay(channel);
  };

  const selectedGuide = channels[selected]
    ? guides[channels[selected].id]
    : undefined;
  // The responsive guide labels times in the schedule's zone; the TV keeps
  // the device clock (the panel is set to local time).
  // The last known schedule zone keeps labelling the page while a filter or
  // search has no channels (and so no selected guide).
  const lastZone = useRef<string>();
  const selectedZone = responsive ? guideZone(selectedGuide?.timezone) : undefined;
  if (selectedZone) lastZone.current = selectedZone;
  const guideTimezone = responsive ? selectedZone ?? lastZone.current : undefined;
  /** "10:30 AM" */
  const formatTime = (time: number) => clockTime(time, guideTimezone);
  /** "10:30" (blocks, "Next 11:00") */
  const formatShort = (time: number) => clockTime(time, guideTimezone, false);
  /** "10:30 – 12:00", or "10:30 – 12:00 PM" with `period`. */
  const formatRange = (start: number, end: number, period = false) => timeRange(start, end, guideTimezone, period);
  const selectFilter = (filter: GuideFilter) => {
    selectedFilter.current = filter;
    focusAfterLoad.current = 0;
    setCollection(filter.collection);
    setCategory(filter.category);
    setOffset(0);
    setCursor(undefined);
    setCategoryCursor(undefined);
    setReload(value=>value+1);
  };
  const submitQuery = (value: string) => {
    focusAfterLoad.current = 0;
    setOffset(0);
    setCursor(undefined);
    setQuery(value.slice(0, 128));
    setCategoryCursor(undefined);
  };
  const activeFilter = filterItems.find(filter => filter.collection === collection && filter.category === category) ?? selectedFilter.current;
  return {
    activateCell, appendChannels, previousChannels, appending,rowsRoot,bindCategoryRoot,paddingTop,paddingBottom,observeRows,failure,hasNext,hasPrevious,
    channels, closeDetails, closeSearchEntry, details,
    failedLogos, filterItems, following, formatRange,
    formatShort, formatTime, guides, key,
    loading, moveWindow, now, offset,
    openDetails, query, restoreNow, scrollViewport,
    searchEntry, searchEntryKey, selectFilter, selected,
    selectedGuide, selectedProgram, setFailedLogos, setFollowing,
    setSearchEntry, setSelected, setSelectedProgram, submitQuery,
    visibleCells, visibleChannels, visibleFirst,
    watchDetails, windowStart, activeFilter, guideTimezone,
    pageChannels, focusAfterLoad, setQuery, setOffset,
  };
}
