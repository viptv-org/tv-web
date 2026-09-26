import { createElement, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookmarkMinus, BookmarkPlus, Circle, CircleCheck, CirclePlay, EyeOff, Info, List, RotateCcw, SkipBack } from "lucide-react";
import { menuAnchor } from "../../screens/titleMenu";
import { sourceKey } from "../../screens/titleSources";
import QRCode from "qrcode";
import {
  TvApi,
  TvApiError,
  type MediaItem,
  type MediaPresentation,
  type MediaSource,
  type DevicePairing,
  type TvProfile,
  type Catalog,
  type PlaybackSession,
  type PlaybackPreferences,
  type PlaybackCapabilities,
  type SourcesPollState,
} from "../../api";
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  isTauriRuntime,
  resolveTauriVideoInvoker,
  type NativeVideoEngine,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "@viptv/video";
import { exactResumeSource, resolveNext } from "../continuation";
import {
  connectionSummary,
  describeApiError,
  nextConnectionFailure,
  type ConnectionIssue,
  type ErrorDetail,
} from "../errors";
import { focusElement } from "../remote";
import { enrichDetail, mergeEpisodeProgress, initialEpisode } from "../detailProgress";
import { readStoredEngine, storeEngine } from "../enginePreference";
import { createAutoplayTestLogger, probeAutoplayTestMode, probeEngineOverride } from "../../testing/autoplay-harness";
import { catalogFilters, catalogDefaults } from "../catalogFilters";
import { appendCatalogPage } from "../catalogPaging";
import { BrowserNavigation, readBrowserRoute, safeRestoredRoute, type BrowserRoute, type SettingsSubpage } from "../browserNavigation";
import { seekPinReleased, type BufferedRange } from "../SeekBar";
import type { Screen } from "../screens";
import { normalizeCore } from "../../core";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { AppApi, CoreApi, DialogsApi, AuthApi, PlaybackEngineApi, PlaybackSessionApi, CatalogApi, NavigationApi } from "./useTvApp";

export function useCatalog(app: PlaybackSessionApi) {
  const { api, autoResume, catalog, catalogs, catalogValues, currentScreen, episodes, epoch, error, fail, favorites, go, items, loadHome, modal, nextEpisode, nextSkip, notify, play, profile, query, queue, responsive, screen, searchScope, season, seek, session, setBusy, setCatalog, setCatalogValues, setDetailOrigin, setEpisodes, setError, setFavorites, setItems, setModal, setNextSkip, setQueue, setSearchPartial, setSearchRows, setSeason, setSelected, setSourceProvider, setSourceQuality, setSources, sourceFocusPending, sourceProvider, sourceQuality, sources } = app;

  const detail = async (item: MediaItem, origin?: Catalog) => {
    if (item.type === "live") { await play(item); return; }
    go("detail");
    setSelected(item);
    setDetailOrigin(origin);
    setEpisodes([]);
    const ticket = ++epoch.current;
    setBusy(true);
    try {
      const value = await api.detail(item);
      if (ticket !== epoch.current) return;
      let enrichedEpisodes = value.episodes;
      if (value.item.type === "series") {
        const history = await api
          .seriesProgress(profile, value.item.seriesId ?? value.item.id)
          .catch((error: unknown) => {
            if (ticket !== epoch.current) return [];
            // Keep the series usable during a history outage without inventing progress.
            notify(
              "Watch history couldn't load. Episode progress may be unavailable.",
            );
            if (error instanceof DOMException && error.name === "AbortError")
              throw error;
            return [];
          });
        if (ticket !== epoch.current) return;
        enrichedEpisodes = mergeEpisodeProgress(
          value.episodes,
          history,
          value.item.seriesId ?? value.item.id,
        );
      }
      if (ticket === epoch.current) {
        setSelected(enrichDetail(item, value.item));
        setEpisodes(enrichedEpisodes);
        const initial = initialEpisode(enrichedEpisodes, item);
        // The title's Play resumes / plays that episode ("Resume S1 E2") and keeps
        // the focus (TvTitle); the episode row scrolls it into view (DetailScreen).
        setSeason(initial?.season ?? enrichedEpisodes[0]?.season);
      }
    } catch (e) {
      if (ticket === epoch.current) fail(e);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  };
  // ---- Source discovery (title family) ----------------------------------
  // The title page shows its play target's best source ("1080p LordStreams ·
  // best of 12 sources"), so it discovers that item's sources in the
  // background. Opening the chooser for the same item continues that
  // discovery instead of starting a second one; the cursor, dedup and budget
  // stay the shared Rust reducer's (pollSourcesStep).
  const discoveries = useRef(new Map<string, { id: string; step: SourcesPollState; done: boolean; at: number }>());
  const preview = useRef<{ key: string; cancel: () => void }>();
  const [sourcePreview, setSourcePreview] = useState<{ key: string; sources: readonly MediaSource[]; done: boolean }>();
  const freshDiscovery = (key: string) => {
    const entry = discoveries.current.get(key);
    // A discovery answered within the last two minutes is still the item's list.
    return entry && Date.now() - entry.at < 120_000 ? entry : undefined;
  };
  const remember = (key: string, id: string, step: SourcesPollState, done: boolean) => {
    if (discoveries.current.size > 32) discoveries.current.clear();
    discoveries.current.set(key, { id, step, done, at: Date.now() });
    setSourcePreview({ key, sources: step.sources, done });
  };
  const stopPreview = () => {
    preview.current?.cancel();
    preview.current = undefined;
  };
  /** Background discovery for the title's best-source line; returns its cancel. Never surfaces errors. */
  const previewSources = (item: MediaItem) => {
    if (item.type === "live" || (item.type === "series" && !item.episode)) return () => undefined;
    const key = sourceKey(item);
    if (preview.current?.key === key) return () => undefined;
    stopPreview();
    const known = freshDiscovery(key);
    if (known) setSourcePreview({ key, sources: known.step.sources, done: known.done });
    if (known?.done) return () => undefined;
    const scope = api.createScope();
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      scope.abort();
    };
    preview.current = { key, cancel };
    void (async () => {
      try {
        const id = known?.id ?? (await api.sources(item, scope.request())).id;
        let step: SourcesPollState = known?.step ?? { after: 0, sources: [], polls: 0 };
        while (!cancelled) {
          const poll = await api.pollSourcesStep(id, step, scope.request());
          if (cancelled) return;
          step = poll.state;
          remember(key, id, step, poll.done);
          if (poll.done) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch {
        // The chooser reports discovery failures; a preview only goes quiet.
      } finally {
        if (preview.current?.cancel === cancel) preview.current = undefined;
      }
    })();
    return () => {
      if (preview.current?.cancel === cancel) stopPreview();
    };
  };
  const discoverSources = async (item: MediaItem, resume = false) => {
    if (item.type === "live") { await play(item); return; }
    if (resume && item.queueStatus === "next" && item.previousEpisode) {
      await nextEpisode(item.previousEpisode);
      return;
    }
    if (item.type === "series" && !item.episode) {
      await detail(item);
      return;
    }
    if (currentScreen.current !== "sources") go("sources");
    else setError("");
    autoResume.current = resume;
    sourceFocusPending.current = true;
    setSelected(item);
    setSources([]);
    setSourceQuality("All");
    setSourceProvider("All");
    setBusy(true);
    const ticket = ++epoch.current;
    const key = sourceKey(item);
    // Take over the title page's discovery of this item when it is fresh.
    stopPreview();
    const known = freshDiscovery(key);
    try {
      const id = known?.id ?? (await api.sources(item)).id;
      // The polling policy (cursor, dedup, budget, completion) is the shared
      // Rust reducer; this loop owns only cancellation, focus and resume.
      let step: SourcesPollState = known?.step ?? { after: 0, sources: [], polls: 0 };
      let done = known?.done ?? false;
      let fresh = !known;
      while (ticket === epoch.current) {
        if (fresh) {
          const poll = await api.pollSourcesStep(id, step);
          if (ticket !== epoch.current) return;
          step = poll.state;
          done = poll.done;
          remember(key, id, step, done);
        }
        fresh = true;
        const all = step.sources;
        setSources([...all]);
        if (all.length && sourceFocusPending.current) {
          sourceFocusPending.current = false;
          setTimeout(() => {
            if (document.activeElement === document.body)
              focusElement("source-0");
          }, 30);
        }
        if (resume && item.sourceAddonId && item.sourceFingerprint) {
          const exact = exactResumeSource(item, all);
          if (exact) {
            await play(item, exact, item.position ?? 0);
            return;
          }
        }
        if (done) {
          if (resume)
            notify(
              "Your previous source is unavailable. Choose a source to continue.",
            );
          break;
        }
        // A continued discovery polls again at once; later polls keep the interval.
        if (known && step === known.step) continue;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
      if (sourceFocusPending.current) {
        sourceFocusPending.current = false;
        setTimeout(() => focusElement("source-0"), 50);
      }
    }
  };
  const toggle = async (item: MediaItem) => {
    try {
      const saved = await api.toggleFavorite(profile, item);
      notify(saved ? "Added to My List" : "Removed from My List");
      const list = await api.favorites(profile);
      setFavorites(list);
      if (screen === "My List") setItems(list);
    } catch (e) {
      fail(e);
    }
  };
  const manage = (item: MediaItem, liveDetails?: () => void) => {
    if (item.type === "live") {
      // Live family: the channel menu (PhItemMenuLive; Live TV long-press /
      // right-click, Home live cards). The Live guide adds Programme details.
      const channelIcon = { "aria-hidden": true, strokeWidth: 2 } as const;
      const savedChannel = favorites.some((f) => f.id === item.id);
      setModal({
        title: item.name,
        view: { kind: "menu", anchor: responsive ? menuAnchor() : undefined },
        choices: [
          {
            label: "Watch channel",
            icon: createElement(CirclePlay, channelIcon),
            action: () => {
              setModal(undefined);
              void play(item);
            },
          },
          ...(liveDetails
            ? [{
                label: "Programme details",
                icon: createElement(Info, channelIcon),
                action: () => {
                  setModal(undefined);
                  liveDetails();
                },
              }]
            : []),
          {
            label: savedChannel ? "Remove from My List" : "Add to My List",
            icon: savedChannel ? createElement(BookmarkMinus, channelIcon) : createElement(BookmarkPlus, channelIcon),
            action: () => {
              setModal(undefined);
              void toggle(item);
            },
          },
          { label: "Cancel", action: () => setModal(undefined) },
        ],
      });
      return;
    }
    // The title menu (components.md §8): ⋯, right-click, long-press, TV hold OK.
    // Desktop opens it as a popover at the pointer / under the ⋯ button.
    const inQueue = queue.some((q) => q.id === item.id);
    const saved = favorites.some((f) => f.id === item.id);
    const menuIcon = { "aria-hidden": true, strokeWidth: 2 } as const;
    setModal({
      title: item.name,
      view: { kind: "menu", anchor: responsive ? menuAnchor() : undefined },
      className: "vx-title-menu",
      choices: [
        ...(item.previousEpisode
          ? [
              {
                label: "Resume previous episode",
                icon: createElement(SkipBack, menuIcon),
                action: () => {
                  setModal(undefined);
                  void discoverSources(item.previousEpisode!, true);
                },
              },
            ]
          : []),
        {
          label: "Choose source",
          icon: createElement(List, menuIcon),
          action: () => {
            setModal(undefined);
            void discoverSources(item);
          },
        },
        {
          label: item.watched ? "Mark unwatched" : "Mark watched",
          icon: item.watched ? createElement(Circle, menuIcon) : createElement(CircleCheck, menuIcon),
          action: () => {
            setModal(undefined);
            void api
              .correctProgress(profile, item, !item.watched)
              .then(() => loadHome())
              .catch(fail);
          },
        },
        {
          label: "Watch from the beginning",
          icon: createElement(RotateCcw, menuIcon),
          action: () => {
            setModal(undefined);
            // Source choice is explicit; do not reuse the queue Resume offset.
            void discoverSources({ ...item, position: 0 });
          },
        },
        ...(inQueue
          ? [
              {
                label: "Remove from Continue Watching",
                icon: createElement(EyeOff, menuIcon),
                action: () => {
                  setModal(undefined);
                  void api
                    .setQueueVisibility(profile, item, true)
                    .then(() => {
                      setQueue((q) => q.filter((i) => i.id !== item.id));
                      setModal({
                        title: "Removed from Continue Watching",
                        view: { kind: "dialog" },
                        // Desktop: Done (the neutral close) gets default focus.
                        focus: responsive ? "Done" : undefined,
                        choices: [
                          {
                            label: "Undo",
                            icon: createElement(RotateCcw, menuIcon),
                            action: () => {
                              setModal(undefined);
                              void api
                                .setQueueVisibility(profile, item, false)
                                .then(() => loadHome())
                                .catch(fail);
                            },
                          },
                          { label: "Done", action: () => setModal(undefined) },
                        ],
                      });
                    })
                    .catch(fail);
                },
              },
            ]
          : []),
        {
          label: saved ? "Remove from My List" : "Add to My List",
          icon: saved ? createElement(BookmarkMinus, menuIcon) : createElement(BookmarkPlus, menuIcon),
          action: () => {
            setModal(undefined);
            void toggle(item);
          },
        },
        { label: "Cancel", action: () => setModal(undefined) },
      ],
    });
  };
  const catalogRequest = useRef<{ key: string; profile: string; scope: ReturnType<TvApi["createScope"]> }>();
  const catalogItems = useRef(items);
  catalogItems.current = items;
  useEffect(() => {
    if (screen !== "Discover" || (catalogRequest.current && catalogRequest.current.profile !== profile)) {
      catalogRequest.current?.scope.abort(); catalogRequest.current = undefined;
    }
  }, [screen, profile]);
  useEffect(() => () => { catalogRequest.current?.scope.abort(); }, []);
  const loadCatalog = async (
    cat: Catalog,
    skip = 0,
    values = skip ? catalogValues : catalogDefaults(cat),
  ) => {
    const key = JSON.stringify([profile, cat.addonId, cat.type, cat.id, skip, Object.entries(values).sort()]);
    if (catalogRequest.current?.key === key) return;
    catalogRequest.current?.scope.abort();
    const scope = api.createScope();
    catalogRequest.current = { key, profile, scope };
    const ticket = ++epoch.current;
    setCatalog(cat);
    setCatalogValues(values);
    if (!skip) { setNextSkip(undefined); setItems([]); catalogItems.current = []; }
    const missing = catalogFilters(cat).find(f => f.required && !values[f.name]?.trim());
    if (missing) { catalogRequest.current = undefined; setItems([]); setBusy(false); return; }
    setBusy(true);
    try {
      const page = await api.discover({
        type: cat.type, catalog: cat.id, addonId: cat.addonId,
        search: values.search || undefined, genre: values.genre || undefined,
        extras: Object.fromEntries(Object.entries(values).filter(([name, value]) => name !== "search" && name !== "genre" && value !== "")),
        skip,
      }, scope.request());
      if (ticket !== epoch.current || scope.signal.aborted) return;
      if (page.unsupportedCount) notify("Some catalog items use an unsupported media type.");
      const result = appendCatalogPage(catalogItems.current, page.items, skip, page.hasMore, page.nextSkip);
      catalogItems.current = result.items;
      setItems(result.items);
      setNextSkip(result.nextSkip);
    } catch (error) {
      if (ticket === epoch.current && !scope.signal.aborted) { setNextSkip(undefined); fail(error); }
    } finally {
      if (catalogRequest.current?.scope === scope) catalogRequest.current = undefined;
      if (ticket === epoch.current) setBusy(false);
    }
  };
  useEffect(() => {
    if (screen !== "Search") return;
    const ticket = ++epoch.current;
    const scope = api.createScope();
    setItems([]);
    setSearchRows([]);
    setSearchPartial(false);
    if (!query.trim()) {
      setBusy(false);
      return;
    }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const results: MediaItem[] = [],
          rows: { name: string; items: readonly MediaItem[]; catalog?: Catalog }[] = [];
        const cats = catalogs
          .filter(
            (c) =>
              c.supportsSearch &&
              (searchScope === "all" || c.type === searchScope),
          )
          .slice(0, 128);
        for (let i = 0; i < cats.length; i += 3) {
          const pages = await Promise.all(
            cats.slice(i, i + 3).map((c) =>
              api
                .discover(
                  {
                    type: c.type,
                    catalog: c.id,
                    addonId: c.addonId,
                    search: query.trim(),
                  },
                  { signal: scope.signal },
                )
                .then((p) => ({ name: c.name, items: p.items, catalog: c }))
                .catch(() => {
                  if (ticket === epoch.current && !scope.signal.aborted)
                    setSearchPartial(true);
                  return { name: c.name, items: [], catalog: c };
                }),
            ),
          );
          if (ticket !== epoch.current) return;
          for (const page of pages) {
            const unique = page.items
              .filter(
                (item, index, all) =>
                  all.findIndex(
                    (other) => other.type === item.type && other.id === item.id,
                  ) === index,
              )
              .slice(0, 24);
            rows.push({ name: page.name, items: unique, catalog: page.catalog });
            for (const item of unique)
              if (
                !results.some((r) => r.type === item.type && r.id === item.id)
              )
                results.push(item);
          }
          setItems([...results]);
          setSearchRows([...rows]);
        }
        if (searchScope === "all" || searchScope === "live") {
          const live = await api.live(
            { view: "us", search: query.trim(), limit: 80 },
            { signal: scope.signal },
          );
          if (ticket !== epoch.current) return;
          rows.push({ name: "Live TV", items: live.channels.slice(0, 24) });
          results.push(...live.channels.slice(0, 24));
          setItems([...results]);
          setSearchRows([...rows]);
        }
      } catch (e) {
        if (!scope.signal.aborted && ticket === epoch.current)
          setSearchPartial(true);
      } finally {
        if (ticket === epoch.current) setBusy(false);
      }
    }, 650);
    return () => {
      clearTimeout(t);
      scope.abort();
    };
  }, [query, screen, catalogs, searchScope]);
  useEffect(() => {
    if (screen !== "sources" || modal || !sources.length) return;
    if (
      !sources.some(
        (s) =>
          (sourceQuality === "All" ||
            (s.quality ?? "Unknown") === sourceQuality) &&
          (sourceProvider === "All" ||
            (s.sourceName ?? s.name) === sourceProvider),
      )
    ) {
      const timer = setTimeout(() => focusElement("source-provider"), 35);
      return () => clearTimeout(timer);
    }
  }, [screen, modal, sources, sourceQuality, sourceProvider]);
  const [playerNotice, setPlayerNotice] = useState<{ message: string; key: number }>();
  // A refused seek is transient: the engine keeps playing, so the notice
  // dismisses itself instead of blocking playback or re-popping from the
  // session state.

  return { detail, discoverSources, previewSources, sourcePreview, toggle, manage, loadCatalog };
}
