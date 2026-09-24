import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  AudioLines,
  Captions,
  ChevronLeft,
  FastForward,
  Info,
  LogOut,
  Maximize,
  Minimize,
  Pause,
  Rewind,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AudioSelectorPopup, PlayerPopup, type TrackChoice } from "../components/player/AudioSelectorPopup";
import { UpNextCard } from "../components/player/UpNextCard";
import { usePlayerFullscreen } from "../hooks/usePlayerFullscreen";
import { RokuText } from "../ui/RokuText";
import { SeekBar, formatPlaybackTime, type BufferedRange } from "../ui/SeekBar";
import { TvButton, focusElement } from "../ui/remote";
import { KeyLegend, type LegendItem } from "../ui/primitives/Keys";
import { Notice } from "../ui/primitives/Feedback";
import { PlayIcon } from "../ui/primitives/icons";
import type { UpNextCard as UpNextState } from "../ui/app/upNext";
import type { Player, PlayerSnapshot } from "@viptv/video";
import type { MediaItem } from "../api";

/**
 * The player (components.md §10; Ph/Desk/TvPlayer*, Ph/Desk/TvUpNext). All
 * playback state and engine access stay owned by the app's hooks; this renders
 * the controls overlay (while `overlay` is up) and the states that show with
 * or without it: buffering ring / preparing panel, the notice pill and the Up
 * Next card. The TV track list is the generic modal (usePlaybackControls).
 */
type PlayerScreenProps = {
  responsive: boolean;
  /** The controls are up (they auto-hide while playing). */
  overlay: boolean;
  /** A dialog (generic modal) is open over the player. */
  dialogOpen: boolean;
  selected: MediaItem | undefined;
  busy: boolean;
  snapshot: PlayerSnapshot | undefined;
  playerNotice: { message: string; key: number } | undefined;
  seek: number | undefined;
  /** A committed seek is still in flight (buffering ring / BUFFERING). */
  seekPending: boolean;
  setSeek: Dispatch<SetStateAction<number | undefined>>;
  setOverlay: Dispatch<SetStateAction<boolean>>;
  commitSeek: (seconds: number) => unknown;
  togglePlayback: () => void;
  toggleLiveMute: () => void;
  fullscreenControl: ReturnType<typeof usePlayerFullscreen>;
  player: MutableRefObject<Player | undefined>;
  fail: (e: unknown) => void;
  nextEpisode: () => unknown;
  stop: () => unknown;
  trackChoices: (kind: "audio" | "text") => void;
  activeTrackPopup: "audio" | "text" | null;
  setActiveTrackPopup: Dispatch<SetStateAction<"audio" | "text" | null>>;
  playerInfoOpen: boolean;
  setPlayerInfoOpen: Dispatch<SetStateAction<boolean>>;
  audioTrackList: TrackChoice[];
  textTrackList: TrackChoice[];
  subtitleOffOption: { selected: boolean; onSelect: () => void };
  playerInfoRows: { label: string; value: string }[];
  readBufferedRanges: () => BufferedRange[] | null;
  lastControlActivity: MutableRefObject<number>;
  setControlActivity: Dispatch<SetStateAction<number>>;
  upNext: UpNextState | undefined;
  playUpNext: () => void;
  cancelUpNext: () => void;
};

/** Playback has stopped or failed: nothing for the controls to act on. */
const INACTIVE = ["idle", "stopped", "error", "disposed"];

/** "S1 · E1 · Episode One" (episodes only). */
function episodeContext(selected: MediaItem | undefined) {
  if (!selected?.season) return "";
  return `S${selected.season} · E${selected.episode ?? 1}${selected.episodeTitle ? ` · ${selected.episodeTitle}` : ""}`;
}

/** Rewind 10 / forward 30: the circular arrow with its seconds inside (as drawn). */
function SkipIcon({ seconds, back }: { seconds: number; back?: boolean }) {
  const Arrow = back ? RotateCcw : RotateCw;
  return (
    <Arrow aria-hidden="true" strokeWidth={2}>
      {/* Icon geometry from the reference SVG (PhPlayer / DeskPlayer). */}
      <text
        x={back ? 12.4 : 11.6}
        y={15.2}
        textAnchor="middle"
        fontSize={7.6}
        fontWeight={700}
        fill="currentColor"
        stroke="none"
        className="vx-player__skip-text"
      >
        {seconds}
      </text>
    </Arrow>
  );
}

const INTERACTIVE = "button, input, [role=slider], .vx-player__popup, .vx-up-next";

/**
 * Pointer / touch player (phone, desktop web, desktop app). Header: Back +
 * title + context. Bottom: the timeline, then the transport (−10, Play, +30,
 * Next) and the tools (audio, subtitles, volume, info, fullscreen): one row on
 * desktop, a centred transport row over a tools row on phone. A tap on the
 * bare overlay hides the controls (or closes an open popup); the bare video
 * brings them back (surfaceClick); a double-click toggles fullscreen.
 */
function ResponsivePlayer({
  overlay: controlsUp,
  dialogOpen,
  selected,
  busy,
  snapshot,
  playerNotice,
  seek,
  seekPending,
  setSeek,
  setOverlay,
  commitSeek,
  togglePlayback,
  fullscreenControl,
  player,
  fail,
  nextEpisode,
  stop,
  activeTrackPopup,
  setActiveTrackPopup,
  playerInfoOpen,
  setPlayerInfoOpen,
  audioTrackList,
  textTrackList,
  subtitleOffOption,
  playerInfoRows,
  readBufferedRanges,
  lastControlActivity,
  setControlActivity,
  upNext,
  playUpNext,
  cancelUpNext,
}: PlayerScreenProps) {
  const live = selected?.type === "live";
  const paused = snapshot?.state === "paused";
  const position = snapshot?.time.positionSeconds ?? 0;
  const duration = snapshot?.time.durationSeconds ?? 0;
  const context = episodeContext(selected);
  const volume = snapshot?.volume;
  const buffering = busy || seekPending || snapshot?.state === "buffering";
  const card = upNext && !busy && !live ? upNext : undefined;
  // "Playback could not be restored" (DeskPlayerRestore): the dialog sits over
  // the bare picture, the dead controls hide behind it.
  const overlay = controlsUp && !(dialogOpen && INACTIVE.includes(snapshot?.state ?? ""));

  // Popups sit above the timeline, centred on their button and clamped to
  // the controls area (DeskPlayerAudio); the phone makes them full width.
  const bottom = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLElement>(null);
  const anchor = activeTrackPopup === "audio" ? "audio" : activeTrackPopup === "text" ? "subtitles" : playerInfoOpen ? "player-info" : undefined;
  const [popupLeft, setPopupLeft] = useState<number>();
  useLayoutEffect(() => {
    if (!anchor || !overlay) return;
    const place = () => {
      const area = bottom.current;
      const panel = popup.current;
      const button = area?.querySelector<HTMLElement>(`[data-focus-id="${anchor}"]`);
      if (!area || !panel || !button) return;
      const box = area.getBoundingClientRect();
      const target = button.getBoundingClientRect();
      const width = panel.offsetWidth;
      setPopupLeft(Math.max(0, Math.min(box.width - width, target.left + target.width / 2 - box.left - width / 2)));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [anchor, overlay]);
  const popupStyle = (popupLeft === undefined ? undefined : { "--vx-popup-left": `${popupLeft}px` }) as CSSProperties | undefined;

  const toggleTrackPopup = (kind: "audio" | "text") => {
    setActiveTrackPopup(activeTrackPopup === kind ? null : kind);
    setPlayerInfoOpen(false);
  };

  return (
    <>
      {buffering && (
        <div className="vx-player__buffering" role="status" aria-label="Loading video">
          <span className="vx-spinner vx-spinner--buffering" aria-hidden="true" />
        </div>
      )}
      {playerNotice && (
        <Notice top className="vx-player__notice" key={playerNotice.key}>
          {playerNotice.message}
        </Notice>
      )}
      {overlay && (
        <div
          className={`player-overlay vx-player vx-player--responsive${live ? " vx-player--live" : ""}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
            if (activeTrackPopup || playerInfoOpen) {
              setActiveTrackPopup(null);
              setPlayerInfoOpen(false);
              return;
            }
            setOverlay(false);
          }}
          onDoubleClick={(event) => {
            if (!(event.target as HTMLElement).closest(INTERACTIVE)) void fullscreenControl.toggle();
          }}
        >
          <header className="vx-player__header">
            <TvButton id="player-back" className="vx-player__back" aria-label="Back" title="Back" onActivate={() => void stop()}>
              <ChevronLeft aria-hidden="true" strokeWidth={2.4} />
            </TvButton>
            <div className="vx-player__heading">
              <h1 className="vx-player__title">{selected?.name ?? ""}</h1>
              {live ? (
                <p className="vx-player__context">
                  <span className="vx-live-dot" aria-hidden="true" />
                  Live TV
                </p>
              ) : context ? (
                <p className="vx-player__context">{context}</p>
              ) : null}
            </div>
          </header>
          <div className="vx-player__bottom" ref={bottom}>
            {!live && (
              <div className="vx-timeline vx-player__timeline">
                <SeekBar
                  id="timeline"
                  position={position}
                  duration={duration}
                  seekable={snapshot?.time.seekable}
                  preview={seek}
                  onPreview={setSeek}
                  onSeek={(seconds) => void commitSeek(seconds)}
                  onActivate={togglePlayback}
                  onActivity={() => {
                    if (Date.now() - lastControlActivity.current < 1000) return;
                    lastControlActivity.current = Date.now();
                    setControlActivity((value) => value + 1);
                  }}
                  getBufferedRanges={readBufferedRanges}
                  remoteKeys={false}
                />
                <p className="vx-timeline__times player-time">
                  <span>{formatPlaybackTime(seek ?? position)}</span>
                  <span>{formatPlaybackTime(duration)}</span>
                </p>
              </div>
            )}
            <div className="vx-player__controls">
              {!live && (
                <div className="vx-player__transport">
                  <TvButton id="rewind" className="vx-player__control vx-player__control--skip" aria-label="Rewind 10 seconds" title="Back 10 seconds" onActivate={() => void commitSeek(Math.max(0, position - 10))}>
                    <SkipIcon seconds={10} back />
                  </TvButton>
                  <TvButton
                    id="pause"
                    className="vx-btn vx-btn--primary vx-btn--icon vx-player__play"
                    aria-label={paused ? "Play" : "Pause"}
                    title={paused ? "Play" : "Pause"}
                    onActivate={() => void (paused ? player.current?.play() : player.current?.pause())}
                  >
                    {paused ? <PlayIcon /> : <Pause aria-hidden="true" strokeWidth={2.2} />}
                  </TvButton>
                  <TvButton id="forward" className="vx-player__control vx-player__control--skip" aria-label="Forward 30 seconds" title="Forward 30 seconds" onActivate={() => void commitSeek(Math.min(duration || Infinity, position + 30))}>
                    <SkipIcon seconds={30} />
                  </TvButton>
                  {selected?.type === "series" && (
                    <TvButton id="next" className="vx-player__control" aria-label="Next episode" title="Next episode" aria-busy={busy || undefined} onActivate={() => void nextEpisode()}>
                      <SkipForward aria-hidden="true" strokeWidth={2.2} />
                    </TvButton>
                  )}
                </div>
              )}
              <div className="vx-player__tools">
                <TvButton id="audio" className="vx-player__control vx-player__tool" aria-label="Audio" title="Audio" aria-expanded={activeTrackPopup === "audio"} onActivate={() => toggleTrackPopup("audio")}>
                  <AudioLines aria-hidden="true" strokeWidth={2.2} />
                </TvButton>
                <TvButton id="subtitles" className="vx-player__control vx-player__tool" aria-label="Subtitles" title="Subtitles" aria-expanded={activeTrackPopup === "text"} onActivate={() => toggleTrackPopup("text")}>
                  <Captions aria-hidden="true" strokeWidth={2.2} />
                </TvButton>
                {player.current?.capabilities.canSetVolume && volume ? (
                  <div className="vx-player__volume">
                    <button
                      type="button"
                      className="vx-player__control"
                      aria-label={volume.muted ? "Unmute" : "Mute"}
                      title={volume.muted ? "Unmute" : "Mute"}
                      onClick={() => void player.current?.setMuted?.(!volume.muted).catch(fail)}
                    >
                      {volume.muted ? <VolumeX aria-hidden="true" strokeWidth={2.2} /> : <Volume2 aria-hidden="true" strokeWidth={2.2} />}
                    </button>
                    <span className="vx-player__slider">
                      <span className="vx-player__slider-track" aria-hidden="true">
                        <span className="vx-player__slider-fill" style={{ width: `${(volume.muted ? 0 : volume.level) * 100}%` }} />
                      </span>
                      <input
                        className="vx-player__slider-input"
                        type="range"
                        aria-label="Volume"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume.muted ? 0 : volume.level}
                        onChange={(event) => {
                          setOverlay(true);
                          void player.current?.setVolume?.(Number(event.target.value)).catch(fail);
                        }}
                      />
                      <span className="vx-player__slider-knob" aria-hidden="true" style={{ left: `${(volume.muted ? 0 : volume.level) * 100}%` }} />
                    </span>
                  </div>
                ) : (
                  <span className="vx-player__system-volume">Use device volume buttons</span>
                )}
                <TvButton
                  id="player-info"
                  className="vx-player__control vx-player__tool"
                  aria-label="Playback info"
                  title="Playback info"
                  aria-expanded={playerInfoOpen}
                  onActivate={() => {
                    setPlayerInfoOpen((open) => !open);
                    setActiveTrackPopup(null);
                  }}
                >
                  <Info aria-hidden="true" strokeWidth={2.2} />
                </TvButton>
                <TvButton
                  id="fullscreen"
                  className="vx-player__control vx-player__fullscreen"
                  aria-label={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  title={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
                  onActivate={() => void fullscreenControl.toggle()}
                >
                  {fullscreenControl.fullscreen ? <Minimize aria-hidden="true" strokeWidth={2.2} /> : <Maximize aria-hidden="true" strokeWidth={2.2} />}
                </TvButton>
              </div>
            </div>
            {activeTrackPopup && (
              <AudioSelectorPopup
                ref={popup}
                title={activeTrackPopup === "audio" ? "Audio Tracks" : "Subtitles"}
                tracks={activeTrackPopup === "audio" ? audioTrackList : textTrackList}
                offOption={activeTrackPopup === "text" ? subtitleOffOption : undefined}
                onClose={() => setActiveTrackPopup(null)}
                style={popupStyle}
              />
            )}
            {playerInfoOpen && (
              <PlayerPopup ref={popup} title="Playback info" onClose={() => setPlayerInfoOpen(false)} style={popupStyle}>
                <dl className="vx-player__info">
                  {playerInfoRows.map((row) => (
                    <div className="vx-player__info-row" key={row.label}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </PlayerPopup>
            )}
            {card && <UpNextCard card={card} current={selected} onPlay={playUpNext} onCancel={cancelUpNext} />}
          </div>
        </div>
      )}
    </>
  );
}

export function PlayerScreen(props: PlayerScreenProps) {
  if (props.responsive) return <ResponsivePlayer {...props} />;
  return <TvPlayer {...props} />;
}

/**
 * The remote-driven TV player (TvPlayer*): title + status word across the top;
 * (while the next episode is prepared, AppDialogs draws the centred
 * "Preparing playback…" panel and only the top bar and legend show here);
 * NOW PLAYING / S·E / title, the timeline and one row of 72 controls at the
 * bottom (transport left; audio, subtitles and exit right); the key legend of
 * the current state bottom-right. Live channels show LIVE NOW and audio + exit.
 */
function TvPlayer({
  overlay: controlsUp,
  dialogOpen,
  selected,
  busy,
  snapshot,
  playerNotice,
  seek,
  seekPending,
  setSeek,
  commitSeek,
  togglePlayback,
  toggleLiveMute,
  player,
  nextEpisode,
  stop,
  trackChoices,
  readBufferedRanges,
  lastControlActivity,
  setControlActivity,
  upNext,
  playUpNext,
  cancelUpNext,
}: PlayerScreenProps) {
  const live = selected?.type === "live";
  const paused = snapshot?.state === "paused";
  const position = snapshot?.time.positionSeconds ?? 0;
  const duration = snapshot?.time.durationSeconds ?? 0;
  const context = episodeContext(selected);
  const card = upNext && !busy && !live ? upNext : undefined;
  const overlay = controlsUp && !(dialogOpen && INACTIVE.includes(snapshot?.state ?? ""));
  const [focused, setFocused] = useState<string>();

  // The card takes focus on Play now when it appears (TvUpNext); if it goes
  // while it holds focus, focus returns to Play / Pause.
  const cardId = card?.sessionId;
  const shownCard = useRef<string>();
  useLayoutEffect(() => {
    if (cardId && shownCard.current !== cardId) focusElement("up-next-play");
    else if (!cardId && shownCard.current) {
      const active = document.activeElement as HTMLElement | null;
      if (!active || active === document.body || !active.isConnected) focusElement(live ? "audio" : "pause");
    }
    shownCard.current = cardId;
  }, [cardId]);

  const status = busy
    ? "LOADING"
    : seekPending || snapshot?.state === "buffering"
      ? "BUFFERING"
      : paused
        ? "PAUSED"
        : "PLAYING";
  const back = card ? "Cancel" : "Hide controls";
  // A remote seek preview (not yet committed); a committed seek in flight is
  // BUFFERING, not seeking (TvPlayerSeek vs TvPlayerBuffering).
  const previewing = seek !== undefined && !seekPending;
  const legend: LegendItem[] = busy
    ? [{ key: "BACK", label: "Cancel" }]
    : previewing
      ? [
          { key: "◀ ▶", label: "Seek" },
          { key: "OK", label: "Jump" },
          { key: "BACK", label: "Cancel" },
        ]
      : card && focused === "up-next-play"
        ? [
            { key: "OK", label: "Play now" },
            { key: "BACK", label: "Cancel" },
          ]
        : live
          ? [
              { key: "OK", label: "Select" },
              { key: "PLAY", label: "Mute" },
              { key: "BACK", label: back },
            ]
          : [
              { key: "OK", label: "Select" },
              { key: "◀ ▶", label: "Move" },
              { key: "BACK", label: back },
            ];

  return (
    <>
      {(overlay || busy) && (
        <div
          className={`player-overlay vx-player vx-player--tv${live ? " vx-player--live" : ""}${previewing ? " vx-player--seeking" : ""}`}
          onFocus={(event) => setFocused((event.target as HTMLElement).dataset.focusId)}
          onClick={(event) => {
            // The backdrop around the controls is the play/pause surface,
            // matching the video; interactive elements keep their clicks.
            if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
            if (live) toggleLiveMute();
            else togglePlayback();
          }}
        >
          <div className="vx-player__top">
            <span className="vx-player__top-title">{selected?.name}</span>
            <span className="vx-status-word player-status" role="status">
              {status}
            </span>
          </div>
          {!busy && (
            <div className="vx-player__bottom">
              <div className="vx-player__info">
                <span className="vx-player__eyebrow">
                  {live && <span className="vx-live-dot" aria-hidden="true" />}
                  {live ? "LIVE NOW" : "NOW PLAYING"}
                </span>
                {context && <span className="vx-player__context player-context">{context}</span>}
                <h1 className="vx-player__title">
                  <RokuText>{selected?.name ?? ""}</RokuText>
                </h1>
              </div>
              {!live && (
                <div className="vx-timeline vx-player__timeline">
                  <SeekBar
                    id="timeline"
                    position={position}
                    duration={duration}
                    seekable={snapshot?.time.seekable}
                    preview={previewing ? seek : undefined}
                    onPreview={setSeek}
                    onSeek={(seconds) => void commitSeek(seconds)}
                    onActivate={togglePlayback}
                    onActivity={() => {
                      if (Date.now() - lastControlActivity.current < 1000) return;
                      lastControlActivity.current = Date.now();
                      setControlActivity((value) => value + 1);
                    }}
                    getBufferedRanges={readBufferedRanges}
                    // The app's remote key layer owns arrows/OK while this
                    // bar is focused; only the pointer acts directly here.
                    remoteKeys
                  />
                  <p className="vx-timeline__times player-time">
                    <span>{formatPlaybackTime(position)}</span>
                    <span>{formatPlaybackTime(duration)}</span>
                  </p>
                </div>
              )}
              <div className="vx-player__controls">
                <div className="vx-player__transport">
                  {!live && (
                    <>
                      <TvButton id="rewind" className="vx-btn vx-btn--icon" aria-label="Rewind 10 seconds" onActivate={() => void commitSeek(Math.max(0, position - 10))}>
                        <Rewind aria-hidden="true" strokeWidth={2} />
                      </TvButton>
                      <TvButton
                        id="pause"
                        className="vx-btn vx-btn--icon vx-player__play"
                        aria-label={paused ? "Play" : "Pause"}
                        onActivate={() => void (paused ? player.current?.play() : player.current?.pause())}
                      >
                        {paused ? <PlayIcon /> : <Pause aria-hidden="true" strokeWidth={2} />}
                      </TvButton>
                      <TvButton id="forward" className="vx-btn vx-btn--icon" aria-label="Forward 30 seconds" onActivate={() => void commitSeek(Math.min(duration || Infinity, position + 30))}>
                        <FastForward aria-hidden="true" strokeWidth={2} />
                      </TvButton>
                      {selected?.type === "series" && (
                        <TvButton id="next" className="vx-btn vx-btn--icon" aria-label="Next episode" onActivate={() => void nextEpisode()}>
                          <SkipForward aria-hidden="true" strokeWidth={2} />
                        </TvButton>
                      )}
                    </>
                  )}
                </div>
                <div className="vx-player__tools">
                  <TvButton id="audio" className="vx-btn vx-btn--icon" aria-label="Audio" onActivate={() => trackChoices("audio")}>
                    <AudioLines aria-hidden="true" strokeWidth={2} />
                  </TvButton>
                  {!live && (
                    <TvButton id="subtitles" className="vx-btn vx-btn--icon" aria-label="Subtitles" onActivate={() => trackChoices("text")}>
                      <Captions aria-hidden="true" strokeWidth={2} />
                    </TvButton>
                  )}
                  <TvButton id="exit" className="vx-btn vx-btn--icon" aria-label="Exit" onActivate={() => void stop()}>
                    <LogOut aria-hidden="true" strokeWidth={2} />
                  </TvButton>
                </div>
              </div>
            </div>
          )}
          {card && <UpNextCard card={card} current={selected} onPlay={playUpNext} onCancel={cancelUpNext} />}
          <KeyLegend corner items={legend} />
        </div>
      )}
      {playerNotice && (
        <Notice top className="vx-player__notice" key={playerNotice.key}>
          {playerNotice.message}
        </Notice>
      )}
    </>
  );
}
