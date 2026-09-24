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
import { nextFromEpisodes, UP_NEXT_SECONDS, UP_NEXT_TICK_MS } from "./upNext";

export function usePlaybackSession(app: PlaybackEngineApi) {
  const { setOverlay, upNext, setUpNext } = app;
  const { active, advancedSession, api, applyBrowserRoute, autoplayEnabled, autoplayStarted, autoplayTest, browser, browserApplyGeneration, browserApplying, browserFromRoute, browserReady, browserReplace, catalog, catalogValues, controller, episodes, epoch, error, fail, homeRequestScope, homeRows, items, nextScope, nextSkip, notify, play, playbackCapabilities, player, prefs, preparing, profile, query, responsive, restoredScroll, resumeRemainder, retireBrowserPlayback, screen, season, seek, selected, session, setBrowserRevision, setBusy, setCasting, setCatalog, setCatalogValues, setEditingProfile, setEntry, setEpisodes, setError, setItems, setModal, setNextSkip, setQuery, setScreen, setSeason, setSelected, setSettingsSubpage, setSources, snapshot, sources, stack } = app;

  // playable title so the engine, state, position and error stream to
  // stdout without anyone driving the UI.
  useEffect(() => {
    if (!autoplayEnabled || !autoplayTest.current.enabled || autoplayStarted.current) return;
    if (!homeRows.length || session) return;
    const item = homeRows.flatMap((row) => row.items).find((candidate) => candidate.type === "movie");
    if (!item) return;
    autoplayStarted.current = true;
    void desktopInvoker?.invoke("test_log", { message: `autoplay trigger item=${item.id}` }).catch(() => undefined);
    // VOD playback requires an explicit source, so the harness discovers
    // sources exactly like the sources screen (job + poll) and starts the
    // first one that arrives; failures surface through the [test] lines.
    void (async () => {
      try {
        const discovery = await api.sources(item);
        // The polling policy (cursor, dedup, budget, completion) is the
        // shared Rust reducer.
        let state: SourcesPollState = { after: 0, sources: [], polls: 0 };
        for (;;) {
          const poll = await api.pollSourcesStep(discovery.id, state);
          state = poll.state;
          const source = poll.sources[0];
          if (source) {
            void desktopInvoker?.invoke("test_log", { message: `autoplay source=${source.id}` }).catch(() => undefined);
            await play(item, source, 0);
            // Harness seek probes: the first seek of a session is the reported
            // broken case (restarts at the beginning). Targets are known.
            setTimeout(() => {
              void desktopInvoker?.invoke("test_log", { message: "harness seek #1 -> 90" }).catch(() => undefined);
              void (app as AppApi).commitSeek(90);
            }, 14000);
            setTimeout(() => {
              void desktopInvoker?.invoke("test_log", { message: "harness seek #2 -> 30" }).catch(() => undefined);
              void (app as AppApi).commitSeek(30);
            }, 32000);
            return;
          }
          if (poll.done) {
            void desktopInvoker?.invoke("test_log", { message: "autoplay no-sources" }).catch(() => undefined);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (e) {
        void desktopInvoker?.invoke("test_log", {
          message: `autoplay discover-failed: ${e instanceof Error ? e.message : String(e)}`,
        }).catch(() => undefined);
      }
    })();
  }, [homeRows, session, autoplayEnabled]);
  applyBrowserRoute.current = async (input, cached, reload = false) => {
    const applyGeneration = ++browserApplyGeneration.current;
    browserApplying.current = true;
    browserReplace.current = true;
    const route = safeRestoredRoute(input, reload);
    browser.current?.replaceRoute(route);
    setError(""); setModal(undefined); setEntry(undefined); setEditingProfile(undefined); setCasting(false);
    const generation = ++epoch.current;
    homeRequestScope.current?.abort();
    if (active.current || ["opening", "replacing", "preparing-next"].includes(controller.current?.snapshot.state ?? "")) await retireBrowserPlayback();
    if (applyGeneration !== browserApplyGeneration.current) return;
    const ticket = epoch.current;
    stack.current = [];
    setBusy(false);
    try {
      if (cached && route.screen === cached.screen && route.screen !== "player" && route.screen !== "sources") {
        setScreen(cached.screen);
        if (route.screen === "Settings") setSettingsSubpage(route.subpage ?? cached.subpage ?? "Settings");
        setSelected(cached.selected); setItems(cached.items); setEpisodes(cached.episodes); setSources(cached.sources);
        setQuery(cached.query); setSeason(cached.season); setCatalog(cached.catalog); setCatalogValues(cached.catalogValues); setNextSkip(cached.nextSkip);
        restoredScroll.current = cached.scroll ? { ...cached.scroll, focus: cached.focus } : undefined;
        if (!cached.scroll) setTimeout(() => focusElement(cached.focus), 30);
      } else if (route.media) {
        const reference: MediaItem = cached?.selected?.id === route.media.id ? cached.selected : { ...route.media, name: "", title: "", genres: [], episodes: [], raw: {} };
        setSelected(reference); setEpisodes([]); setSources([]);
        if (route.screen === "sources") {
          browserFromRoute.current = true;
          const pending = (app as AppApi).discoverSources(reference);
          browserFromRoute.current = false;
          browserApplying.current = false;
          await pending;
        } else {
          setScreen("detail"); setBusy(true);
          browserApplying.current = false;
          const value = await api.detail(reference);
          if (ticket !== epoch.current) return;
          const progress = value.item.type === "series" ? await api.seriesProgress(profile, value.item.seriesId ?? value.item.id).catch(() => []) : [];
          if (ticket !== epoch.current) return;
          const episodeItems = mergeEpisodeProgress(value.episodes, progress, value.item.seriesId ?? value.item.id);
          setSelected(enrichDetail(reference, value.item)); setEpisodes(episodeItems); setSeason(initialEpisode(episodeItems, reference)?.season ?? episodeItems[0]?.season);
        }
      } else {
        setQuery(route.query ?? "");
        if (route.screen === "Settings") setSettingsSubpage(route.subpage ?? "Settings");
        if (reload && route.screen === "Home") setScreen("Home");
        else {
          browserFromRoute.current = true;
          const pending = (app as AppApi).navigate(route.screen);
          browserFromRoute.current = false;
          browserApplying.current = false;
          await pending;
        }
      }
    } catch (error) { if (applyGeneration === browserApplyGeneration.current && (ticket === epoch.current || generation === epoch.current)) fail(error); }
    finally {
      if (applyGeneration === browserApplyGeneration.current) {
        browserApplying.current = false;
        setBusy(false); setBrowserRevision(value => value + 1);
      }
    }
  };
  const stop = async () => {
    if (responsive && browserReady.current) {
      await retireBrowserPlayback();
      if (!browser.current?.back()) await applyBrowserRoute.current({ screen: "Home" });
      return;
    }
    epoch.current++;
    nextScope.current?.abort();
    const a = active.current,
      p = player.current?.snapshot.time;
    if (a && p && a.item.type !== "live")
      await api
        .saveProgress(
          profile,
          a.item,
          p.positionSeconds,
          p.durationSeconds ?? a.session.duration,
        )
        .catch(fail);
    await controller.current?.stop().catch(fail);
    const old = stack.current.pop();
    restoredScroll.current = responsive && old?.scroll ? { ...old.scroll, focus: old.focus } : undefined;
    setScreen(old?.screen ?? "Home");
    if (old) {
      setSelected(old.selected);
      setItems(old.items);
      setEpisodes(old.episodes);
      setSources(old.sources);
      if (!restoredScroll.current) setTimeout(() => focusElement(old.focus), 50);
      if (old.screen === "detail" && old.selected) {
        const ticket = epoch.current;
        void api
          .detail(old.selected)
          .then((value) => {
            if (ticket === epoch.current) {
              // A Home episode Resume returns to its parent title. Optional
              // episode fields omitted by title metadata must not survive a
              // spread from the outgoing episode and turn Season into Play.
              setSelected(value.item.type === "series" && value.item.id !== old.selected!.id
                ? value.item : enrichDetail(old.selected!, value.item));
              setEpisodes(value.episodes);
              setSeason(
                value.episodes.find((e) => e.id === old.selected?.id)?.season ??
                  value.episodes[0]?.season,
              );
            }
          })
          .catch(fail);
      }
    }
  };
  const nextEpisode = async (previous = active.current?.item) => {
    if (!previous || nextScope.current) return;
    const scope = api.createScope();
    nextScope.current = scope;
    setBusy(true);
    setError("");
    const outgoing = active.current;
    const outgoingPosition =
      player.current?.snapshot.time.positionSeconds ??
      outgoing?.item.position ??
      0;
    const attempted = new Set<string>();
    const deadline = setTimeout(() => scope.abort(), 180000);
    try {
      const resolve = async () => {
        const next = await resolveNext(
          api,
          profile,
          previous,
          prefs,
          scope.signal,
          await playbackCapabilities.current!(),
          attempted,
        );
        if (next?.source) attempted.add(next.source.id);
        if (!next && !scope.signal.aborted)
          notify("No next episode is available.");
        return next;
      };
      if (outgoing) {
        const p = player.current?.snapshot.time;
        if (p)
          await api.saveProgress(
            profile,
            outgoing.item,
            p.positionSeconds,
            p.durationSeconds ?? outgoing.session.duration,
          );
        for (let attempt = 0; attempt < 3 && !scope.signal.aborted; attempt++) {
          try {
            await controller.current!.prepareNext(resolve);
            break;
          } catch (error) {
            if (attempt === 2 || !controller.current?.snapshot.active)
              throw error;
          }
        }
        if (
          controller.current?.snapshot.active?.intent.item.id !==
          outgoing.item.id
        )
          resumeRemainder.current = false;
      } else {
        const next = await resolve();
        if (next && !scope.signal.aborted)
          await play(next.item, next.source, 0);
      }
    } catch (e) {
      if (!scope.signal.aborted) {
        if (outgoing && controller.current?.snapshot.active)
          setError("This source could not be played");
        else
          fail(e);
      }
      if (
        outgoing &&
        controller.current?.snapshot.state === "error" &&
        !controller.current.snapshot.active
      ) {
        setModal({
          title: "Playback could not be restored",
          choices: [
            {
              label: "Retry",
              // The dialog's one accent action (DeskPlayerRestore; TV: a plain row).
              // (The drawn refresh icon waits on the generic modal: an icon makes it a menu.)
              tone: "primary",
              action: () => {
                setModal(undefined);
                void play(outgoing.item, outgoing.source, outgoingPosition);
              },
            },
            {
              label: "Choose source",
              action: () => {
                setModal(undefined);
                void (app as AppApi).discoverSources(outgoing.item);
              },
            },
            {
              label: "Back",
              action: () => {
                setModal(undefined);
                void stop();
              },
            },
          ],
        });
      }
    } finally {
      clearTimeout(deadline);
      if (nextScope.current === scope) nextScope.current = undefined;
      setBusy(false);
    }
  };
  // Auto-next (core policy canAutoNext: the final ten seconds while playing).
  // Instead of advancing silently, the Up Next card counts down; the episode
  // ending, the countdown reaching zero or Play now starts the next episode,
  // and Cancel keeps this one (no auto-next for it). An explicit final-ten
  // Resume (resumeRemainder) still waits for the end.
  const noNextSession = useRef<string>();
  useEffect(() => {
    if (
      screen !== "player" ||
      !prefs.autoplay ||
      selected?.type !== "series" ||
      nextScope.current ||
      seek !== undefined ||
      !session
    )
      return;
    const position = snapshot?.time.positionSeconds ?? 0,
      duration = snapshot?.time.durationSeconds ?? session.duration;
    if (advancedSession.current === session.id) return;
    if (snapshot?.state === "ended") {
      advancedSession.current = session.id;
      setUpNext(undefined);
      void nextEpisode();
      return;
    }
    const finalTen =
      !resumeRemainder.current &&
      snapshot?.state === "playing" &&
      duration > 10 &&
      normalizeCore<MediaPresentation>("presentation", { ...selected, position, duration }).canAutoNext;
    if (upNext?.sessionId === session.id) {
      // Seeking back out of the final seconds takes the card away again.
      if (duration - position > UP_NEXT_SECONDS + 1) setUpNext(undefined);
      return;
    }
    if (finalTen && noNextSession.current !== session.id) {
      const left = Math.max(1, Math.min(UP_NEXT_SECONDS, Math.ceil(duration - position)));
      setUpNext({ sessionId: session.id, item: nextFromEpisodes(episodes, active.current?.item ?? selected), left, total: left });
      setOverlay(true);
    }
  }, [
    screen,
    prefs.autoplay,
    selected?.type,
    session?.id,
    snapshot?.time.positionSeconds,
    snapshot?.state,
    seek,
    upNext?.sessionId,
  ]);
  // A card belongs to one session on the player screen.
  useEffect(() => {
    if (upNext && (screen !== "player" || upNext.sessionId !== session?.id)) setUpNext(undefined);
  }, [screen, session?.id, upNext?.sessionId]);
  // Next episode metadata the loaded episode list does not have.
  useEffect(() => {
    const card = upNext;
    const current = active.current?.item ?? selected;
    if (!card || card.item || !current) return;
    const scope = api.createScope();
    void api
      .nextEpisode(profile, current, { signal: scope.signal })
      .then((next) => {
        if (next.status === "next" && next.item)
          setUpNext((value) => (value?.sessionId === card.sessionId ? { ...value, item: next.item } : value));
        else {
          // Nothing follows: no card; the episode's end keeps the existing path.
          noNextSession.current = card.sessionId;
          setUpNext((value) => (value?.sessionId === card.sessionId ? undefined : value));
        }
      })
      .catch(() => undefined);
    return () => scope.abort();
  }, [upNext?.sessionId]);
  // Countdown: wall-clock ticks that hold while playback is paused.
  useEffect(() => {
    const id = upNext?.sessionId;
    if (!id) return;
    const step = UP_NEXT_TICK_MS / 1000;
    const tick = setInterval(() => {
      if (player.current?.snapshot.state === "paused") return;
      setUpNext((value) => (value?.sessionId === id ? { ...value, left: Math.max(0, value.left - step) } : value));
    }, UP_NEXT_TICK_MS);
    return () => clearInterval(tick);
  }, [upNext?.sessionId]);
  const playUpNext = () => {
    if (session) advancedSession.current = session.id;
    setUpNext(undefined);
    void nextEpisode();
  };
  const cancelUpNext = () => {
    if (session) advancedSession.current = session.id;
    setUpNext(undefined);
  };
  useEffect(() => {
    if (upNext && upNext.left <= 0) playUpNext();
  }, [upNext?.left]);

  return { stop, nextEpisode, playUpNext, cancelUpNext };
}
