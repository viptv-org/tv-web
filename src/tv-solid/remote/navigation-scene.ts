import { batch, type Accessor, type Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { STREMIO_ONLY, stremioCatalogs, stremioHome } from "./stremio-home";
import { initialSeasonIndex, seasonEpisodes } from "./seasons";
import { lookupSelector } from "./api";
import type { Card, Catalog, Controls, Detail, Home, Management, Page, TitleAction } from "./types";
import type { Screen } from "./app-types";


export interface HistoryEntry {
  screen: Screen;
  zone: string;
  column: number;
  row: number;
  selected?: Card;
  detail?: Detail;
  detailAction?: TitleAction;
  seasonIndex: number;
  page?: Page;
  focusKey?: string;
  rowId?: string;
  stale?: boolean;
}

/** How the app gets from one screen to another, and how it comes back.
 *
 * The history stack is the only record of where the viewer was. Every entry
 * carries the *facts* needed to rebuild that screen — the row and focus key, the
 * selected card, the season — and a `stale` flag that says the data behind it
 * must be re-requested. Restoring is therefore a rebuild, never a cache hit, so
 * a returning screen cannot show a list that has since changed.
 */
export function createNavigationScene(options: {
  api: RemoteTvApi;
  platform: string;
  screen: Accessor<Screen>;
  setScreen: Setter<Screen>;
  zone: Accessor<string>;
  setZone: Setter<string>;
  column: Accessor<number>;
  setColumn: Setter<number>;
  row: Accessor<number>;
  setRow: Setter<number>;
  setHeroAction: Setter<number>;
  loading: Accessor<boolean>;
  setLoading: Setter<boolean>;
  home: Accessor<Home | undefined>;
  setHome: Setter<Home | undefined>;
  page: Accessor<Page>;
  setPage: Setter<Page>;
  setDetail: Setter<Detail | undefined>;
  setSelected: Setter<Card | undefined>;
  setDetailAction: Setter<TitleAction | undefined>;
  setSeasonIndex: Setter<number>;
  setControls: Setter<Controls | undefined>;
  setCatalog: Setter<Catalog | undefined>;
  setFilters: Setter<Record<string, string[]>>;
  setManagement: Setter<Management | undefined>;
  setCalendarDay: Setter<number>;
  setCalendarEntry: Setter<number>;
  setCalendar: Setter<Parameters<RemoteTvApi["calendar"]> extends never ? never : Awaited<ReturnType<RemoteTvApi["calendar"]>> | undefined>;
  navs: Accessor<readonly { id: string }[]>;
  resetScope: () => AbortSignal;
  /** Rebuild Home's remembered row and column. */
  remember: () => void;
  rememberHomeRow: () => void;
  contentFocus: { clear: () => void };
  focusIndex: (cards: readonly Card[], key: string | undefined, fallback: number) => number;
  browseQuery: () => Record<string, unknown>;
  /** The whole first library load, including its default sort. */
  loadLibraryFirst: (signal: AbortSignal) => Promise<Page>;
  libraryControlCount: () => number;
  search: Accessor<string>;
  updateSearch: (value: string, immediate?: boolean) => void;
  searchMediaPending: Accessor<boolean>;
  searchChannelsPending: Accessor<boolean>;
  liveScene: { loadFirstPage: (signal: AbortSignal) => Promise<void> };
  setPrograms: Setter<Record<string, unknown>>;
  setGuideInfo: Setter<Record<string, unknown>>;
  adoptChannelWindow: (pages: never[], searching?: boolean) => void;
  loadSettings: (tab: number, signal: AbortSignal) => Promise<void>;
  player: { stop: () => Promise<void> };
  signal: () => AbortSignal;
  fail: (error: unknown) => void;
  retry: (work: () => void) => void;
}) {
  const history: HistoryEntry[] = [];

  function invalidate() {
    for (const entry of history) {
      entry.stale = true;
      entry.page = undefined;
      entry.detail = undefined;
      entry.detailAction = undefined;
      if (entry.selected) entry.selected = lookupSelector(entry.selected);
    }
  }

  async function restore(previous: HistoryEntry): Promise<void> {
    if (["movie", "series", "anime", "search", "live", "calendar", "library"].includes(previous.screen) &&
      !options.navs().some(item => item.id === previous.screen)) {
      history.length = 0;
      await navigate("home");
      return;
    }
    const signal = options.resetScope();
    batch(() => {
      options.setScreen(previous.screen);
      options.setZone(previous.zone);
      options.setColumn(previous.column);
      options.setRow(previous.row);
      options.setSelected(previous.selected);
      options.setDetail(previous.detail);
      options.setDetailAction(previous.detailAction);
      options.setSeasonIndex(previous.seasonIndex);
      options.setPage(previous.page ?? { cards: [], complete: true });
      options.setLoading(!!previous.stale);
    });
    if (previous.screen === "search") {
      if (previous.stale || options.searchMediaPending() || options.searchChannelsPending())
        options.updateSearch(options.search(), true);
      return;
    }
    if (!previous.stale) return;
    options.retry(() => void restore(previous));
    try {
      if (previous.screen === "home") {
        const rows = options.home()?.rows ?? [];
        const nextRow = Math.max(0, rows.findIndex(row => row.id === previous.rowId));
        options.setRow(nextRow);
        if (previous.zone === "rows")
          options.setColumn(options.focusIndex(rows[nextRow]?.cards ?? [], previous.focusKey, previous.column));
      } else if (previous.screen === "detail" && previous.selected) {
        let [value, intent] = await Promise.all([
          options.api.detail(previous.selected, "0", signal),
          options.api.titleAction(previous.selected, false, signal),
        ]);
        const index = previous.seasonIndex < value.seasons.length
          ? previous.seasonIndex
          : initialSeasonIndex(value, previous.selected, intent);
        const season = value.seasons[index];
        if (season && season.offset !== 0 &&
          !value.episodes.some(card => card.identity.episode?.season === season.season))
          value = await options.api.detail(previous.selected, String(season.offset), signal);
        if (signal.aborted) return;
        batch(() => {
          options.setDetail(value);
          options.setDetailAction(intent);
          options.setSeasonIndex(index);
          if (previous.zone === "episodes" || previous.zone === "recommendations")
            options.setColumn(options.focusIndex(
              previous.zone === "recommendations" || !(value.seasons.length || value.episodes.length)
                ? value.recommendations
                : seasonEpisodes(value, index),
              previous.focusKey, previous.column));
        });
      } else if (previous.screen === "live") {
        await options.liveScene.loadFirstPage(signal);
      } else if (["movie", "series", "anime", "library"].includes(previous.screen)) {
        const value = previous.screen === "library"
          ? await options.loadLibraryFirst(signal)
          : await options.api.discover(options.browseQuery() as never, signal);
        batch(() => {
          options.setPage(value);
          if (previous.zone === "content")
            options.setColumn(options.focusIndex(value.cards, previous.focusKey, previous.column));
        });
      }
    } catch (error) {
      options.fail(error);
    } finally {
      if (!signal.aborted) options.setLoading(false);
    }
  }

  async function navigate(target: Screen): Promise<void> {
    options.contentFocus.clear();
    const signal = options.resetScope();
    if (target === "settings") {
      // Load the first settings group before the screen reports itself so a
      // caller that waits for the screen sees ready content, not an empty column
      // that swallows the first confirm.
      options.setLoading(true);
      options.setZone("settings-nav");
      options.setColumn(0);
      options.setRow(0);
      try {
        await options.loadSettings(2, signal);
      } catch (e) {
        options.fail(e);
      }
      options.setScreen(target);
      options.setLoading(false);
      return;
    }
    options.setScreen(target);
    if (["movie", "series", "anime", "calendar", "library", "search", "live"].includes(target))
      options.setPage({ cards: [], complete: true });
    if (target === "live") {
      options.adoptChannelWindow([]);
      options.setPrograms({});
      options.setGuideInfo({});
    }
    options.setColumn(0);
    options.setRow(0);
    options.setZone(target === "home" ? "hero" : target === "profiles" ? "profiles" : "content");
    options.setHeroAction(0);
    options.retry(() => void navigate(target));
    try {
      if (target === "home") {
        if (!options.home()) options.setLoading(true);
        options.setHome(stremioHome(await options.api.home(signal)));
      } else if (target === "profiles") {
        options.setManagement(await options.api.profiles(signal));
      } else if (target === "movie" || target === "series" || target === "anime") {
        options.setLoading(true);
        options.setPage({ cards: [], complete: true });
        const anime = STREMIO_ONLY && target === "anime";
        const requestType = anime ? "series" : target;
        const result = await options.api.controls(requestType, signal);
        options.setControls(result);
        const catalogs = stremioCatalogs(result.catalogs);
        const first = catalogs[0] ?? result.catalogs[0];
        options.setCatalog(first);
        options.setFilters(anime ? { genre: ["Animation"] } : {});
        options.setPage(await options.api.discover({
          type: requestType,
          ...(first ? { catalog: first.id, addon_id: first.addon_id } : {}),
          ...(anime ? { genre: "Animation" } : {}),
        } as never, signal));
        options.setZone("filters");
      } else if (target === "library") {
        options.setLoading(true);
        options.setPage(await options.loadLibraryFirst(signal));
        if (options.libraryControlCount()) options.setZone("library-controls");
      } else if (target === "calendar") {
        options.setLoading(true);
        options.setCalendarDay(0);
        options.setCalendarEntry(0);
        options.setZone("calendar-days");
        try {
          options.setCalendar(await options.api.calendar(signal));
        } finally {
          options.setLoading(false);
        }
      } else if (target === "search") {
        options.setPage({ cards: [], complete: true });
        options.setZone("keyboard");
        if (options.search()) {
          options.updateSearch(options.search());
          return;
        }
      } else if (target === "live") {
        await options.liveScene.loadFirstPage(signal);
      }
      options.setLoading(false);
    } catch (e) {
      options.fail(e);
    }
  }

  async function openDetail(card: Card): Promise<void> {
    options.remember();
    const signal = options.resetScope();
    options.setSelected(card);
    options.setScreen("detail");
    options.setZone("hero");
    options.setHeroAction(0);
    options.setLoading(true);
    options.setDetail(undefined);
    options.setDetailAction(undefined);
    options.setSeasonIndex(0);
    options.retry(() => void openDetail(card));
    try {
      let [value, intent] = await Promise.all([
        options.api.detail(card, "0", signal),
        options.api.titleAction(card, false, signal),
      ]);
      if (signal.aborted) return;
      const index = initialSeasonIndex(value, card, intent);
      const season = value.seasons[index];
      if (season && season.offset !== 0 &&
        !value.episodes.some(episode => episode.identity.episode?.season === season.season))
        value = await options.api.detail(card, String(season.offset), signal);
      if (signal.aborted) return;
      batch(() => {
        options.setDetail(value);
        options.setDetailAction(intent);
        options.setSeasonIndex(index);
        options.setLoading(false);
      });
    } catch (e) {
      options.fail(e);
    }
  }

  return { history, invalidate, restore, navigate, openDetail };
}

export type NavigationScene = ReturnType<typeof createNavigationScene>;
