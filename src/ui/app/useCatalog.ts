import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { BrowserNavigation, readBrowserRoute, safeRestoredRoute, type BrowserRoute, type SettingsSubpage } from "../browserNavigation";
import { seekPinReleased, type BufferedRange } from "../SeekBar";
import type { Screen } from "../screens";
import { normalizeCore } from "../../core";
import { captureScroll, desktopInvoker, initialPrefs, type BrowserSnapshot, type Choice, type ScrollAnchor } from "./appShared";
import type { AppApi, CoreApi, DialogsApi, AuthApi, PlaybackEngineApi, PlaybackSessionApi, CatalogApi, NavigationApi } from "./useTvApp";

export function useCatalog(app: PlaybackSessionApi) {
  const { api, autoResume, catalog, catalogs, catalogValues, currentScreen, episodes, epoch, error, fail, favorites, go, items, loadHome, modal, nextEpisode, nextSkip, notify, play, profile, query, queue, screen, searchScope, season, seek, session, setBusy, setCatalog, setCatalogValues, setEpisodes, setError, setFavorites, setItems, setModal, setNextSkip, setQueue, setSearchPartial, setSearchRows, setSeason, setSelected, setSourceProvider, setSourceQuality, setSources, sourceFocusPending, sourceProvider, sourceQuality, sources } = app;

  const detail = async (item: MediaItem) => {
    if (item.type === "live") { await play(item); return; }
    go("detail");
    setSelected(item);
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
        setSeason(initial?.season ?? enrichedEpisodes[0]?.season);
        if (initial)
          setTimeout(() => {
            if (ticket !== epoch.current || currentScreen.current !== "detail")
              return;
            const index = enrichedEpisodes
              .filter((episode) => episode.season === initial.season)
              .findIndex((episode) => episode.id === initial.id);
            if (index >= 0) focusElement(`episode-${index}`);
          }, 50);
      }
    } catch (e) {
      if (ticket === epoch.current) fail(e);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
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
    try {
      const discovery = await api.sources(item);
      // The polling policy (cursor, dedup, budget, completion) is the shared
      // Rust reducer; this loop owns only cancellation, focus and resume.
      let step: SourcesPollState = { after: 0, sources: [], polls: 0 };
      while (ticket === epoch.current) {
        const poll = await api.pollSourcesStep(discovery.id, step);
        if (ticket !== epoch.current) return;
        step = poll.state;
        const all = poll.sources;
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
        if (poll.done) {
          if (resume)
            notify(
              "Your previous source is unavailable. Choose a source to continue.",
            );
          break;
        }
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
  const manage = (item: MediaItem) => {
    if (item.type === "live") {
      setModal({
        title: item.name,
        choices: [
          {
            label: "Watch channel",
            action: () => {
              setModal(undefined);
              void play(item);
            },
          },
          {
            label: favorites.some((f) => f.id === item.id)
              ? "Remove from My List"
              : "Add to My List",
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
    const inQueue = queue.some((q) => q.id === item.id);
    setModal({
      title: item.name,
      choices: [
        ...(item.previousEpisode
          ? [
              {
                label: "Resume previous episode",
                action: () => {
                  setModal(undefined);
                  void discoverSources(item.previousEpisode!, true);
                },
              },
            ]
          : []),
        {
          label: "Choose source",
          action: () => {
            setModal(undefined);
            void discoverSources(item);
          },
        },
        {
          label: item.watched ? "Mark unwatched" : "Mark watched",
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
          action: () => {
            setModal(undefined);
            // Source choice is explicit; do not reuse the queue Resume offset.
            void discoverSources({ ...item, position: 0 });
          },
        },
        ...(inQueue
          ? [
              {
                label: "Hide from Continue Watching",
                action: () => {
                  setModal(undefined);
                  void api
                    .setQueueVisibility(profile, item, true)
                    .then(() => {
                      setQueue((q) => q.filter((i) => i.id !== item.id));
                      setModal({
                        title: "Hidden from Continue Watching",
                        choices: [
                          {
                            label: "Undo",
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
          label: favorites.some((f) => f.id === item.id)
            ? "Remove from My List"
            : "Add to My List",
          action: () => {
            setModal(undefined);
            void toggle(item);
          },
        },
        { label: "Cancel", action: () => setModal(undefined) },
      ],
    });
  };
  const loadCatalog = async (
    cat: Catalog,
    skip = 0,
    values = skip ? catalogValues : catalogDefaults(cat),
  ) => {
    const ticket = ++epoch.current;
    setCatalog(cat);
    setCatalogValues(values);
    if (!skip) setNextSkip(undefined);
    const missing = catalogFilters(cat).find(
      (f) => f.required && !values[f.name]?.trim(),
    );
    if (missing) {
      setItems([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const page = await api.discover({
        type: cat.type,
        catalog: cat.id,
        addonId: cat.addonId,
        search: values.search || undefined,
        genre: values.genre || undefined,
        extras: Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) =>
              key !== "search" && key !== "genre" && value !== "",
          ),
        ),
        skip,
      });
      if (ticket !== epoch.current) return;
      if (page.unsupportedCount) notify("Some catalog items use an unsupported media type.");
      setItems((old) =>
        skip
          ? [
              ...old,
              ...page.items.filter(
                (i) => !old.some((o) => o.type === i.type && o.id === i.id),
              ),
            ]
          : page.items,
      );
      setNextSkip(
        page.hasMore ? (page.nextSkip ?? skip + page.items.length) : undefined,
      );
    } catch (e) {
      fail(e);
    } finally {
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
          rows: { name: string; items: readonly MediaItem[] }[] = [];
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
                .then((p) => ({ name: c.name, items: p.items }))
                .catch(() => {
                  if (ticket === epoch.current && !scope.signal.aborted)
                    setSearchPartial(true);
                  return { name: c.name, items: [] };
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
            rows.push({ name: page.name, items: unique });
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

  return { detail, discoverSources, toggle, manage, loadCatalog };
}
