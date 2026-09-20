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

export function usePlaybackEngine(app: AuthApi) {
  const { active, api, autoplayTest, autoResume, browser, canvas, catalog, controlActivity, controller, engineChoice, engineError, entry, episodes, epoch, error, fail, go, items, modal, nextScope, notify, overlay, platform, playbackCapabilities, player, profile, profiles, responsive, resumeRemainder, screen, season, seek, seekTarget, seekTimer, seekValue, selected, session, setBusy, setError, setModal, setOpeningSource, setOverlay, setPreparing, setScreen, setSeek, setSelected, setSession, setSnapshot, snapshot, sourceQuality, sources, stack, video } = app;

  useEffect(() => {
    let engine: Player;
    try {
      engine = createPlayer({ platform, video: video.current!, canvas: canvas.current!, engine: engineChoice });
      engineError.current = undefined;
    } catch (error) {
      engineError.current =
        error instanceof Error
          ? error
          : new Error("TV playback engine is unavailable");
      return;
    }
    player.current = engine;
    // Per-platform delivery profiles are declared once in @viptv/video
    // (platform-profiles.ts): TV engines and the desktop host resolve their
    // profile without a browser decoder probe; only the web entry measures.
    const capabilities = deliveryCapabilitiesFor(platform);
    playbackCapabilities.current = capabilities;
    const sessions = new PlaybackSessionController<MediaItem, MediaSource>({ player: engine, backend: api, capabilities });
    controller.current = sessions;
    const off = engine.subscribe((snapshot) => {
      setSnapshot(snapshot);

      if (autoplayTest.current.enabled) autoplayTest.current.log?.(snapshot);
      // A committed seek stays displayed until the engine actually lands on
      // its target; releasing early teleports the thumb back mid-flight.
      if (
        seekTarget.current !== undefined &&
        seekPinReleased(
          seekTarget.current,
          snapshot.time.positionSeconds,
          snapshot.state,
        )
      ) {
        seekTarget.current = undefined;
        setSeek(undefined);
      }
      void sessions.recoverPlayback(snapshot).then((handled) => {
        if (!handled && snapshot.error && engine.snapshot.error === snapshot.error)
          setError(snapshot.error.message);
      }).catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) fail(cause);
      });
    });
    const offSessions = sessions.subscribe((state) => {
      if (state.active) {
        const { intent, session } = state.active;
        active.current = {
          item: {
            ...intent.item,
            sourceAddonId:
              intent.source?.sourceAddonId ?? intent.item.sourceAddonId,
            sourceName: intent.source?.sourceName ?? intent.item.sourceName,
            sourceFingerprint:
              typeof intent.source?.raw.source_fingerprint === "string"
                ? intent.source.raw.source_fingerprint
                : intent.item.sourceFingerprint,
          },
          source: intent.source,
          session,
        };
        setSession(session);
        setSelected(intent.item);
      } else {
        active.current = undefined;
        setSession(undefined);
      }
    });
    return () => {
      off();
      offSessions();
      void sessions
        .stop()
        .catch(() => undefined)
        .then(() => engine.dispose())
        .catch(() => undefined);
    };
  }, [platform, api, engineChoice]);
  useEffect(() => {
    if (
      screen !== "player" ||
      !overlay ||
      snapshot?.state !== "playing" ||
      modal ||
      seek !== undefined
    )
      return;
    const t = setTimeout(() => setOverlay(false), 2500);
    return () => clearTimeout(t);
  }, [screen, overlay, snapshot?.state, modal, seek, controlActivity]);
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      void api.heartbeat(session.id).catch(fail);
      const a = active.current,
        p = player.current?.snapshot.time;
      if (a && p && a.item.type !== "live")
        void api
          .saveProgress(
            profile,
            a.item,
            p.positionSeconds,
            p.durationSeconds ?? a.session.duration,
          )
          .catch(fail);
    }, 15000);
    return () => clearInterval(t);
  }, [session, profile]);
  const play = async (item: MediaItem, source?: MediaSource, position = 0) => {
    if (!controller.current) {
      void desktopInvoker?.invoke("test_log", {
        message: `autoplay gate: no controller; engineError=${engineError.current?.message ?? "none"}`,
      }).catch(() => undefined);
      fail(
        engineError.current ?? new Error("TV playback engine is unavailable"),
      );
      return;
    }
    resumeRemainder.current = !!(
      position &&
      item.duration &&
      position >= item.duration - 10
    );
    const ticket = ++epoch.current;
    setError("");
    setBusy(true);
    setPreparing(true);
    setOpeningSource(source?.id);
    try {
      const enriched = {
        ...item,
        sourceAddonId: source?.sourceAddonId ?? item.sourceAddonId,
        sourceName: source?.sourceName ?? item.sourceName,
        sourceFingerprint:
          typeof source?.raw.source_fingerprint === "string"
            ? source.raw.source_fingerprint
            : item.sourceFingerprint,
        sourceQuality: source?.quality ?? item.sourceQuality,
        sourceAudio: source?.audio ?? item.sourceAudio,
      };
      const started = await controller.current!.start({
        item: enriched,
        source,
        position,
      });
      if (ticket !== epoch.current) {
        if (
          controller.current?.snapshot.active?.session.id === started.session.id
        )
          await controller.current.stop();
        return;
      }
      if (
        autoResume.current &&
        item.type !== "live" &&
        stack.current.at(-1)?.screen === "Home"
      ) {
        if (responsive) browser.current?.replaceRoute({ screen: "detail", media: { id: item.id, type: item.type, seriesId: item.seriesId, season: item.season, episode: item.episode } });
        stack.current.push({
          screen: "detail",
          focus: "detail-play",
          selected: item,
          items,
          episodes: [],
          sources: [],
        });
        setScreen("player");
      } else go("player");
      autoResume.current = false;
      setOverlay(true);
    } catch (e) {
      if (
        ticket !== epoch.current ||
        (e instanceof DOMException && e.name === "AbortError")
      )
        return;
      void desktopInvoker?.invoke("test_log", {
        message: `autoplay play-failed: ${e instanceof Error ? e.message : String(e)}`,
      }).catch(() => undefined);
      const failure = describeApiError(e);
      const engineSnapshot = player.current?.snapshot;
      const failureLines = [...failure.lines];
      if (engineSnapshot?.diagnostics)
        failureLines.push(
          `Engine: ${engineSnapshot.diagnostics.engine}${engineSnapshot.diagnostics.backend ? ` (${engineSnapshot.diagnostics.backend})` : ""}`,
        );
      if (engineSnapshot?.error)
        failureLines.push(
          `Engine error: ${engineSnapshot.error.code}: ${engineSnapshot.error.message}`,
        );
      setModal({
        title: "This source could not be played",
        message:
          failure.kind === "network"
            ? "The backend could not be reached, so the stream could not be opened."
            : failure.message,
        detail: { ...failure, lines: failureLines },
        choices: [
          {
            label: "Retry",
            action: () => {
              setModal(undefined);
              void play(item, source, position);
            },
          },
          ...(item.type === "live" ? [] : [{
            label: "Choose another source",
            action: () => {
              setModal(undefined);
              void (app as AppApi).discoverSources({ ...item, position });
            },
          }]),
          { label: item.type === "live" ? "Cancel" : "Back", action: () => setModal(undefined) },
        ],
      });
    } finally {
      setBusy(false);
      setPreparing(false);
      setOpeningSource(undefined);
    }
  };
  const retireBrowserPlayback = async () => {
    epoch.current++;
    nextScope.current?.abort(); nextScope.current = undefined;
    autoResume.current = false;
    clearTimeout(seekTimer.current); seekValue.current = undefined; setSeek(undefined);
    const outgoing = active.current, position = player.current?.snapshot.time;
    if (outgoing && position && outgoing.item.type !== "live") {
      void api.saveProgress(profile, outgoing.item, position.positionSeconds, position.durationSeconds ?? outgoing.session.duration).catch(() => notify("Playback stopped. Progress could not be saved."));
    }
    await controller.current?.stop().catch(fail);
    active.current = undefined;
    setSession(undefined); setBusy(false);
  };

  // Harness mode: once the home catalog is ready, autoplay the first

  return { play, retireBrowserPlayback };
}
