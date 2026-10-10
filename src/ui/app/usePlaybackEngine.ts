import { useEffect, useRef } from "react";
import { monitorPlaybackLease } from '../../api/playback-lease';
import {
  TvApiError,
  type MediaItem,
  type MediaSource,
} from "../../api";
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  type Player,
} from "@viptv/video";
import { describeApiError } from "../errors";
import { seekPinReleased } from "../SeekBar";
import { desktopInvoker } from "./appShared";
import type { AppApi, AuthApi } from "./useTvApp";
import { useNativeShutdown } from "./useNativeShutdown";

export function usePlaybackEngine(app: AuthApi) {
  const { active, api, autoplayTest, autoResume, browser, canvas, controlActivity, controller, engineChoice, engineError, epoch, fail, go, items, modal, nextScope, notify, overlay, platform, playbackCapabilities, player, profile, responsive, resumeRemainder, screen, seek, seekTarget, seekTimer, seekValue, session, setBusy, setError, setModal, setOpeningSource, setOverlay, setPreparing, setPlaybackStage, setScreen, setSeek, setSelected, setSession, setSnapshot, snapshot, stack, video } = app;
  useNativeShutdown(controller);

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
    const sessions = new PlaybackSessionController<MediaItem, MediaSource>({ player: engine, retireOnReplace: platform === "tauri", backend: api, capabilities });
    controller.current = sessions;
    let lastIntent: { item: MediaItem; source?: MediaSource } | undefined;
    let lastPlayerNotice = '';
    let disposed = false;
    let lastReportedFailure = '';
    const reportFailure = (key: string, report: () => void) => {
      if (disposed || key === lastReportedFailure) return;
      lastReportedFailure = key;
      report();
    };
    let frameSession: string | undefined;
    const reportFrame = () => {
      const current = sessions.snapshot;
      const id = current.active?.session.id;
      if (!id || disposed || current.state === 'replacing' || current.state === 'opening'
        || (engine.snapshot.diagnostics?.presentedFrames ?? 0) <= 0 || frameSession === id) return;
      frameSession = id;
      void api.playbackFirstFrame(id).catch(error => {
        if (disposed || sessions.snapshot.active?.session.id !== id) return;
        fail(error); void sessions.stop().catch(() => undefined);
      });
    };
    const off = engine.subscribe((snapshot) => {
      setSnapshot(snapshot);
      reportFrame();
      const noticeKey = `${snapshot.sessionId}:${snapshot.notice ?? ''}`;
      if (snapshot.notice && noticeKey !== lastPlayerNotice) notify(snapshot.notice);
      lastPlayerNotice = noticeKey;

      if (autoplayTest.current.enabled) autoplayTest.current.log?.(snapshot);
      // A committed seek stays displayed until the engine actually lands on
      // its target; releasing early teleports the thumb back mid-flight.
      if (
        seekTarget.current !== undefined &&
        sessions.snapshot.state !== "replacing" &&
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
        if (!handled && snapshot.error && engine.snapshot.error === snapshot.error && engine.snapshot.sessionId === snapshot.sessionId)
          reportFailure(`${snapshot.sessionId}:${snapshot.error.code}:${snapshot.error.message}`, () => setError(snapshot.error!.message));
      }).catch((cause) => {
        if (disposed || (cause instanceof DOMException && cause.name === "AbortError")) return;
        if (sessions.snapshot.error !== cause &&
          !(snapshot.error && engine.snapshot.error === snapshot.error && engine.snapshot.sessionId === snapshot.sessionId)) return;
        const message = cause instanceof Error ? cause.message : 'Playback recovery failed.';
        reportFailure(`${snapshot.sessionId}:recovery:${message}`, () => fail(cause));
      });
    });
    const offSessions = sessions.subscribe((state) => {
      const intent = state.active?.intent;
      if (intent?.item !== lastIntent?.item || intent?.source !== lastIntent?.source || !state.active) {
        seekTarget.current = undefined;
        setSeek(undefined);
      }
      lastIntent = intent;
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
        reportFrame();
        setSelected(intent.item);
      } else {
        active.current = undefined;
        setSession(undefined);
      }
    });
    const offNative = api.nativePlaybackEvents?.(event => {
      if (disposed) return;
      if (event.stage) setPlaybackStage(event.stage);
      if (event.error && event.id === sessions.snapshot.active?.session.id) {
        fail(event.error); void sessions.stop().catch(() => undefined);
      }
    });
    return () => {
      disposed = true;
      offNative?.();
      off();
      offSessions();
      void sessions
        .stop()
        .catch(() => undefined)
        .then(() => engine.dispose())
        .catch(() => undefined);
    };
  }, [platform, api, engineChoice]);
  // Controls hide after 2.5 s of playing, but not while a dialog, a seek
  // preview, a player popup or the Up Next card is up.
  const { activeTrackPopup, playerInfoOpen, upNext } = app;
  const holdControls = !!(activeTrackPopup || playerInfoOpen || upNext);
  const latestControlActivity = useRef(controlActivity);
  latestControlActivity.current = controlActivity;
  useEffect(() => {
    if (
      screen !== "player" ||
      !overlay ||
      snapshot?.state !== "playing" ||
      modal ||
      seek !== undefined ||
      holdControls
    )
      return;
    const t = setTimeout(() => setOverlay(false), 2500);
    return () => clearTimeout(t);
  }, [screen, overlay, snapshot?.state, modal, seek, controlActivity, holdControls]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const owner = controller.current;
    const lease = api.playbackLease?.(session.id);
    const retire = (error: unknown) => {
      if (cancelled || owner?.snapshot.active?.session.id !== session.id) return;
      fail(error);
      void owner.stop().catch(() => undefined);
    };
    const native = api.isNativePlayback?.(session.id) ?? false;
    const monitor = lease && !native ? monitorPlaybackLease(lease, options => api.renewPlaybackV2(session.id, options), retire) : undefined;
    const reconnect = async () => {
      if (document.visibilityState !== 'visible' || (!monitor && !native) || cancelled) return;
      const engine = player.current;
      const activity = latestControlActivity.current;
      const playing = engine?.snapshot.state === 'playing';
      if (playing) await engine.pause().catch(() => undefined);
      const ready = native ? await api.renewPlaybackV2(session.id).then(()=>true,()=>false) : await monitor!.refresh();
      if (!cancelled && ready && playing && activity === latestControlActivity.current && engine === player.current && owner?.snapshot.active?.session.id === session.id)
        await engine?.play().catch(fail);
      else if (!cancelled && !ready && (native || monitor!.isActive()) && owner?.snapshot.active?.session.id === session.id)
        fail(new TvApiError(409, 'Playback could not reconnect. Retry playback.', 'playback_reconnect_failed'));
    };
    document.addEventListener('visibilitychange', reconnect);
    const t = setInterval(() => {
      if (!monitor) void api.heartbeat(session.id, undefined, player.current?.snapshot.time.positionSeconds).catch(fail);
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
    return () => { cancelled = true; clearInterval(t); monitor?.dispose(); document.removeEventListener('visibilitychange', reconnect); };
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
    setPlaybackStage(undefined);
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
            // The dialog's one accent action (Ph/DeskPlayerError; TV: a plain row).
            // (The drawn refresh icon waits on the generic modal: an icon makes it a menu.)
            tone: "primary",
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
