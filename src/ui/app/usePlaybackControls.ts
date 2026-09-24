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
import type { TrackChoice } from "../../components/player/AudioSelectorPopup";

export function usePlaybackControls(app: NavigationApi) {
  const { active, back, controller, editingProfile, entry, fail, modal, notify, overlay, play, player, profile, responsive, screen, seek, seekRepeat, seekTarget, seekTimer, seekValue, selected, session, setEditingProfile, setModal, setOverlay, setSeek, snapshot, stop, toggle, video } = app;
  const [playerNotice, setPlayerNotice] = useState<{ message: string; key: number }>();

  useEffect(() => {
    if (!playerNotice) return;
    const timer = setTimeout(() => setPlayerNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [playerNotice]);

  // A committed seek still in flight (a managed seek waits for the server):
  // the player shows its buffering ring / BUFFERING status meanwhile.
  const [seekPending, setSeekPending] = useState(false);
  const seeksInFlight = useRef(0);
  const commitSeek = async (position: number) => {
    // The target stays displayed until the engine actually lands there;
    // clearing it up front teleports the thumb back to the pre-seek spot.
    setSeek(position);
    seekTarget.current = position;
    if (Math.abs(position - (snapshot?.time.positionSeconds ?? 0)) < 0.5) {
      setSeek(undefined);
      seekTarget.current = undefined;
      return;
    }
    seeksInFlight.current++;
    setSeekPending(true);
    try {
      await controller.current?.seekFrom(
        () => position,
        () => snapshot?.time.positionSeconds ?? 0,
      );
    } catch {
      setSeek(undefined);
      seekTarget.current = undefined;
      // The player notice pill (copy.md): the engine / server reason is not
      // user copy (a refused managed seek reads "VIPTV could not complete…").
      setPlayerNotice({ message: "The stream could not seek there.", key: Date.now() });
    } finally {
      seeksInFlight.current--;
      if (!seeksInFlight.current) setSeekPending(false);
    }
  };

  const togglePlayback = () =>
    void (snapshot?.state === "paused"
      ? player.current?.play()
      : player.current?.pause());

  const toggleLiveMute = () => {
    if (snapshot?.volume) {
      void player.current?.setMuted?.(!snapshot.volume.muted).catch(fail);
    }
  };

  // The buffer layer is real data from whichever engine is active: the HTML
  // element exposes its buffered ranges directly, and MediaBunny / Tauri native reports its
  // decoded-ahead window on the snapshot. Nothing is ever fabricated.
  const readBufferedRanges = () => {
    const end = snapshot?.time.bufferedEndSeconds;
    const duration = snapshot?.time.durationSeconds ?? 0;
    const position = snapshot?.time.positionSeconds ?? 0;
    if (end != null && end > 0) {
      return [
        {
          start: 0,
          end: Math.min(end, duration > 0 ? duration : end),
        },
      ];
    }
    const media = video.current;
    if (!media || duration <= 0 || !media.buffered) return null;
    // Managed deliveries start their element clock at a timeline offset; the
    // live snapshot position minus that clock recovers it.
    const offset = Math.max(0, position - media.currentTime);
    const ranges: BufferedRange[] = [];
    for (let i = 0; i < media.buffered.length; i++) {
      const start = Math.max(0, media.buffered.start(i) + offset);
      const bEnd = Math.min(duration, media.buffered.end(i) + offset);
      if (bEnd > start) ranges.push({ start, end: bEnd });
    }
    return ranges.length > 0 ? ranges : null;
  };
  // The video surface and the backdrop around the controls toggle playback;
  // the seek bar and buttons keep their own clicks.
  const surfaceClick = () => {
    if (screen !== "player") return;
    setOverlay(true);
    // Pointer/touch layouts: a tap on the bare video only brings the
    // controls back; play/pause is its own button (and the Space key).
    if (responsive) return;
    if (selected?.type === "live") {
      toggleLiveMute();
    } else {
      togglePlayback();
    }
  };
  const mediaKey = (key: string) => {
    if (screen !== "player" || modal || entry || editingProfile) return false;
    setOverlay(true);
    const live = selected?.type === "live";
    const focused = (document.activeElement as HTMLElement)?.dataset.focusId;
    const timeline = focused === "timeline" || !overlay;
    if (key === "Info" || key === "ContextMenu" || key === "*") {
      setTimeout(() => focusElement("audio"), 0);
      return true;
    }
    if (key === "MediaStop") {
      void stop();
      return true;
    }
    if (key === "ArrowUp" && !live) {
      focusElement("timeline");
      return true;
    }
    if (key === "ArrowDown" && timeline) {
      focusElement(live ? "audio" : "pause");
      return true;
    }
    if (
      !live &&
      (["MediaRewind", "MediaFastForward"].includes(key) ||
        (timeline && ["ArrowLeft", "ArrowRight"].includes(key)))
    ) {
      const repeat = seekRepeat.current;
      repeat.count = repeat.key === key ? repeat.count + 1 : 0;
      repeat.key = key;
      const multiplier =
        repeat.count >= 15
          ? 60
          : repeat.count >= 9
            ? 15
            : repeat.count >= 5
              ? 6
              : repeat.count >= 2
                ? 3
                : 1;
      const step = key.startsWith("Arrow") ? 10 : 60;
      const sign = key === "ArrowLeft" || key === "MediaRewind" ? -1 : 1;
      const value = Math.max(
        0,
        Math.min(
          snapshot?.time.durationSeconds ?? Infinity,
          (seekValue.current ?? snapshot?.time.positionSeconds ?? 0) +
            step * multiplier * sign,
        ),
      );
      seekValue.current = value;
      setSeek(value);
      clearTimeout(seekTimer.current);
      return true;
    }
    if (key === "Enter" && seekValue.current !== undefined) {
      clearTimeout(seekTimer.current);
      const value = seekValue.current;
      seekValue.current = undefined;
      void commitSeek(value);
      return true;
    }
    if (!live && key === "MediaTrackPrevious") {
      void commitSeek(Math.max(0, (snapshot?.time.positionSeconds ?? 0) - 10));
      return true;
    }
    if (!live && ["MediaPlayPause", "MediaPlay", "MediaPause"].includes(key)) {
      void (snapshot?.state === "paused"
        ? player.current?.play()
        : player.current?.pause());
      return true;
    }
    if (live && ["MediaPlayPause", "MediaPlay", "MediaPause"].includes(key)) {
      toggleLiveMute();
      return true;
    }
    if (live && ["MediaRewind", "MediaFastForward"].includes(key)) return true;
    if (!overlay) {
      setTimeout(() => focusElement(live ? "audio" : "timeline"), 0);
      return true;
    }
    return false;
  };
  const mediaKeyUp = (key: string) => {
    if (
      !["ArrowLeft", "ArrowRight", "MediaRewind", "MediaFastForward"].includes(
        key,
      )
    )
      return;
    seekRepeat.current = { key: "", count: 0 };
    const value = seekValue.current;
    if (value !== undefined) {
      clearTimeout(seekTimer.current);
      seekTimer.current = setTimeout(() => {
        seekValue.current = undefined;
        void commitSeek(value);
      }, 800);
    }
  };
  const editProfile = (p?: TvProfile) => setEditingProfile({ profile: p });
  /**
   * TV track selector: one scrolling list in the right panel (the generic
   * modal), opened focused on the current track. Unavailable tracks stay
   * visible and focusable; choosing one explains why it cannot play here.
   */
  const trackChoices = (kind: "audio" | "text") => {
    const tracks = kind === "audio" ? audioTrackList : textTrackList;
    const choices: Choice[] = [];
    if (kind === "text" && subtitlesCanTurnOff)
      choices.push({
        label: "Off",
        current: subtitleOffOption.selected,
        action: () => {
          setModal(undefined);
          subtitleOffOption.onSelect();
        },
      });
    for (const track of tracks)
      choices.push({
        label: track.label,
        current: track.selected,
        unavailable: !track.available,
        action: () => {
          if (!track.available) {
            notify("This track is not supported on this TV.");
            return;
          }
          setModal(undefined);
          track.onSelect();
        },
      });
    const current = choices.find((choice) => choice.current);
    setModal({
      title: kind === "audio" ? "Audio Tracks" : "Subtitles",
      view: { kind: "choices" },
      choices,
      focus: current?.label,
      legend: [
        { key: "▲ ▼", label: "Move" },
        { key: "OK", label: "Select" },
        { key: "BACK", label: "Close" },
      ],
      className: "vx-player-tracks",
    });
  };
  // Latest card action closures for the memoized card row: the row reads the
  const nativeAudio = snapshot?.tracks.audio;
  const serverAudio = session?.audioTracks;
  const canNativeAudio =
    session?.mode === "direct" &&
    player.current?.capabilities.canSelectAudioTrack;
  const currentAudioId = snapshot?.tracks.selectedAudioId;

  const audioTrackList: TrackChoice[] =
    canNativeAudio && nativeAudio?.length
      ? nativeAudio.map((t) => ({
          id: t.id,
          label: t.label,
          language: t.language,
          available: t.available,
          selected: currentAudioId === t.id,
          onSelect: () => void player.current!.selectAudioTrack(t.id).catch(fail),
        }))
      : (serverAudio ?? []).map((t) => ({
          id: String(t.inputIndex),
          label: t.title || t.language || `Track ${t.inputIndex + 1}`,
          language: t.language,
          available: t.selectable,
          selected: t.selected,
          onSelect: () =>
            void controller.current!.replaceTracks({
              audioTrackIndex: t.inputIndex,
            }).catch(fail),
        }));

  const nativeText = snapshot?.tracks.text;
  const serverText = session?.subtitleTracks;
  const canNativeText =
    session?.mode === "direct" &&
    player.current?.capabilities.canSelectTextTrack;
  const currentTextId = snapshot?.tracks.selectedTextId;
  const subtitlesOff = canNativeText
    ? !currentTextId
    : !(serverText ?? []).some((t) => t.selected);

  const textTrackList: TrackChoice[] =
    canNativeText && nativeText?.length
      ? nativeText.map((t) => ({
          id: t.id,
          label: t.label,
          language: t.language,
          available: t.available,
          selected: currentTextId === t.id,
          onSelect: () => void player.current!.selectTextTrack(t.id).catch(fail),
        }))
      : (serverText ?? []).map((t) => ({
          id: String(t.inputIndex),
          label: t.title || t.language || `Track ${t.inputIndex + 1}`,
          language: t.language,
          available: t.selectable,
          selected: t.selected,
          onSelect: () =>
            void controller.current!.replaceTracks({
              subtitleTrackIndex: t.inputIndex,
              subtitlesOff: false,
            }).catch(fail),
        }));

  const subtitleOffOption = {
    selected: subtitlesOff,
    onSelect: () => {
      void (canNativeText
        ? player.current!.selectTextTrack(null)
        : controller.current!.replaceTracks({ subtitlesOff: true })
      ).catch(fail);
    },
  };

  // The server can burn subtitles off only when it says so; direct play needs
  // an engine that can disable a text track (TV "Off" row).
  const subtitlesCanTurnOff = !!(
    session?.subtitlesSupported ||
    (session?.mode === "direct" && player.current?.capabilities.canDisableTextTrack)
  );

  /** Playback info as key / value rows (monospace values). */
  const playerInfoRows: { label: string; value: string }[] = [
    {
      label: "Decoder",
      value: snapshot?.diagnostics
        ? `${snapshot.diagnostics.engine}${snapshot.diagnostics.backend ? ` (${snapshot.diagnostics.backend})` : ""}`
        : player.current?.capabilities.engine ?? "Unknown",
    },
    { label: "Transport", value: snapshot?.diagnostics?.networkTransport ?? "Unknown" },
    { label: "Container", value: snapshot?.diagnostics?.transport ?? session?.format ?? "Unknown" },
    {
      label: "Delivery",
      value: session?.videoMode === "transcode" || session?.audioMode === "transcode" ? "Transcode" : session?.mode || "Unknown",
    },
    { label: "Video delivery", value: session?.videoMode ?? "" },
    { label: "Audio delivery", value: session?.audioMode ?? "" },
    { label: "Video codec", value: snapshot?.diagnostics?.videoCodec ?? "" },
    { label: "Audio codec", value: snapshot?.diagnostics?.audioCodec ?? "" },
    {
      label: "Resolution",
      value: snapshot?.diagnostics?.width ? `${snapshot.diagnostics.width} × ${snapshot.diagnostics.height}` : "",
    },
    { label: "Fallback", value: snapshot?.diagnostics?.fallbackReason ?? "" },
  ].filter((row) => row.value);

  return { commitSeek, togglePlayback, toggleLiveMute, readBufferedRanges, surfaceClick, mediaKey, mediaKeyUp, editProfile, trackChoices, audioTrackList, textTrackList, subtitleOffOption, subtitlesCanTurnOff, playerInfoRows, playerNotice, setPlayerNotice, seekPending };
}
