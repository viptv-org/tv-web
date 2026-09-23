import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { AudioLines, Captions, ChevronLeft, Info, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { AudioSelectorPopup, type TrackChoice } from "../components/player/AudioSelectorPopup";
import { usePlayerFullscreen } from "../hooks/usePlayerFullscreen";
import { RokuText } from "../ui/RokuText";
import { SeekBar, formatPlaybackTime, type BufferedRange } from "../ui/SeekBar";
import { TvButton } from "../ui/remote";
import type { Player, PlayerSnapshot } from "@viptv/video";
import type { MediaItem } from "../api";

/**
 * The player overlay: identity, seek bar, transport controls, track
 * selectors, volume and playback info. All playback state and engine access
 * stay owned by the App state machine; this component renders the overlay
 * from the given snapshot and handlers, with the DOM contract (class names,
 * focus ids, roles) frozen.
 */
type PlayerScreenProps = {
  responsive: boolean;
  selected: MediaItem | undefined;
  busy: boolean;
  snapshot: PlayerSnapshot | undefined;
  playerNotice: { message: string; key: number } | undefined;
  seek: number | undefined;
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
  trackChoices: (kind: "audio" | "text", page?: number) => void;
  activeTrackPopup: "audio" | "text" | null;
  setActiveTrackPopup: Dispatch<SetStateAction<"audio" | "text" | null>>;
  playerInfoOpen: boolean;
  setPlayerInfoOpen: Dispatch<SetStateAction<boolean>>;
  audioTrackList: TrackChoice[];
  textTrackList: TrackChoice[];
  subtitleOffOption: { selected: boolean; onSelect: () => void };
  playerInfoLines: string[];
  readBufferedRanges: () => BufferedRange[] | null;
  lastControlActivity: MutableRefObject<number>;
  setControlActivity: Dispatch<SetStateAction<number>>;
};

const INTERACTIVE = "button, input, .seekbar, .audio-selector-popup";

/**
 * The pointer/touch player overlay for web and desktop: Back and the title
 * across the top; the timeline and one row of same-sized icon controls at
 * the bottom (transport on the left; tracks, volume, info and fullscreen on
 * the right). A tap on the picture hides the controls and a tap on the bare
 * video brings them back (App's surfaceClick); a double-click toggles
 * fullscreen. Play/pause stays on its button and the Space key.
 */
function ResponsivePlayer({
  selected,
  snapshot,
  playerNotice,
  seek,
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
  playerInfoLines,
  readBufferedRanges,
  lastControlActivity,
  setControlActivity,
}: PlayerScreenProps) {
  const live = selected?.type === "live";
  const paused = snapshot?.state === "paused";
  const position = snapshot?.time.positionSeconds ?? 0;
  const duration = snapshot?.time.durationSeconds ?? 0;
  const context = selected?.season
    ? `S${selected.season} · E${selected.episode ?? 1}${selected.episodeTitle ? ` · ${selected.episodeTitle}` : ""}`
    : live
      ? "Live TV"
      : "";
  const volume = snapshot?.volume;
  return (
    <div
      className={`player-overlay responsive-player ${live ? "live-overlay" : ""}`}
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
      <div className="rp-top">
        <TvButton id="player-back" className="rp-button" aria-label="Back" title="Back" onActivate={() => void stop()}>
          <ChevronLeft size={28} aria-hidden="true" />
        </TvButton>
        <div className="rp-title">
          <h1>{selected?.name ?? ""}</h1>
          {context && <p>{context}</p>}
        </div>
      </div>
      {playerNotice && (
        <div className="player-notice" role="status">
          {playerNotice.message}
        </div>
      )}
      <div className="rp-bottom">
        {!live && (
          <div className="rp-timeline">
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
            <p className="player-time">
              <span>{formatPlaybackTime(seek ?? position)}</span>
              <span>{formatPlaybackTime(duration)}</span>
            </p>
          </div>
        )}
        <div className="controls rp-controls">
          <div className="rp-group">
            {!live && (
              <>
                <TvButton id="rewind" className="rp-button" aria-label="Rewind 10 seconds" title="Back 10 seconds" onActivate={() => void commitSeek(Math.max(0, position - 10))}>
                  <span className="rp-skip" aria-hidden="true"><RotateCcw size={26} /><b>10</b></span>
                </TvButton>
                <TvButton id="pause" className="rp-button rp-play" aria-label={paused ? "Play" : "Pause"} title={paused ? "Play" : "Pause"} onActivate={() => void (paused ? player.current?.play() : player.current?.pause())}>
                  {paused ? <Play size={28} fill="currentColor" aria-hidden="true" /> : <Pause size={28} fill="currentColor" aria-hidden="true" />}
                </TvButton>
                <TvButton id="forward" className="rp-button" aria-label="Forward 30 seconds" title="Forward 30 seconds" onActivate={() => void commitSeek(Math.min(duration || Infinity, position + 30))}>
                  <span className="rp-skip" aria-hidden="true"><RotateCw size={26} /><b>30</b></span>
                </TvButton>
                {selected?.type === "series" && (
                  <TvButton id="next" className="rp-button" aria-label="Next episode" title="Next episode" onActivate={() => void nextEpisode()}>
                    <SkipForward size={24} aria-hidden="true" />
                  </TvButton>
                )}
              </>
            )}
          </div>
          <div className="rp-group rp-end">
            <div className="track-buttons">
              <TvButton id="audio" className="rp-button" aria-label="Audio" title="Audio" aria-expanded={activeTrackPopup === "audio"} onActivate={() => { setActiveTrackPopup(activeTrackPopup === "audio" ? null : "audio"); setPlayerInfoOpen(false); }}>
                <AudioLines size={24} aria-hidden="true" />
              </TvButton>
              <TvButton id="subtitles" className="rp-button" aria-label="Subtitles" title="Subtitles" aria-expanded={activeTrackPopup === "text"} onActivate={() => { setActiveTrackPopup(activeTrackPopup === "text" ? null : "text"); setPlayerInfoOpen(false); }}>
                <Captions size={24} aria-hidden="true" />
              </TvButton>
              {activeTrackPopup && (
                <AudioSelectorPopup
                  title={activeTrackPopup === "audio" ? "Audio Tracks" : "Subtitles"}
                  tracks={activeTrackPopup === "audio" ? audioTrackList : textTrackList}
                  offOption={activeTrackPopup === "text" ? subtitleOffOption : undefined}
                  onClose={() => setActiveTrackPopup(null)}
                />
              )}
            </div>
            {player.current?.capabilities.canSetVolume && volume ? (
              <div className="player-volume">
                <button
                  type="button"
                  className="rp-button"
                  aria-label={volume.muted ? "Unmute" : "Mute"}
                  title={volume.muted ? "Unmute" : "Mute"}
                  onClick={() => void player.current?.setMuted?.(!volume.muted).catch(fail)}
                >
                  {volume.muted ? <VolumeX size={24} aria-hidden="true" /> : <Volume2 size={24} aria-hidden="true" />}
                </button>
                <input
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
              </div>
            ) : (
              <span className="system-volume">Use device volume buttons</span>
            )}
            <div className="player-info-anchor">
              <button type="button" className="rp-button" aria-label="Playback info" title="Playback info" aria-expanded={playerInfoOpen} onClick={() => { setPlayerInfoOpen((open) => !open); setActiveTrackPopup(null); }}>
                <Info size={24} aria-hidden="true" />
              </button>
              {playerInfoOpen && (
                <div className="audio-selector-popup player-info-popup" role="dialog" aria-label="Playback info">
                  <div className="audio-selector-header">
                    <span className="audio-selector-title">Playback info</span>
                    <button type="button" className="audio-selector-close" aria-label="Close" onClick={() => setPlayerInfoOpen(false)} tabIndex={-1}><X size={16} /></button>
                  </div>
                  <div className="player-info-body">
                    {playerInfoLines.map((line) => <p key={line}>{line}</p>)}
                  </div>
                </div>
              )}
            </div>
            <TvButton
              id="fullscreen"
              className="rp-button"
              aria-label={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
              title={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
              onActivate={() => void fullscreenControl.toggle()}
            >
              {fullscreenControl.fullscreen ? <Minimize size={24} aria-hidden="true" /> : <Maximize size={24} aria-hidden="true" />}
            </TvButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayerScreen(props: PlayerScreenProps) {
  if (props.responsive) return <ResponsivePlayer {...props} />;
  return <TvPlayer {...props} />;
}

/** The remote-driven TV overlay, unchanged by the pointer/touch overlay above. */
function TvPlayer({
  selected,
  busy,
  snapshot,
  playerNotice,
  seek,
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
}: PlayerScreenProps) {
  return (
    <div
      className={`player-overlay ${selected?.type === "live" ? "live-overlay" : ""}`}
      onClick={(event) => {
        // The backdrop around the controls is the play/pause surface,
        // matching the video; interactive elements keep their clicks.
        if ((event.target as HTMLElement).closest("button, input, .seekbar, .audio-selector-popup"))
          return;
        if (selected?.type === "live") {
          toggleLiveMute();
        } else {
          togglePlayback();
        }
      }}
    >
      <div
        className={`player-identity ${selected?.type === "live" ? "channel-identity" : ""}`}
      >
        <span>{selected?.name}</span>
      </div>
      {
        <span className="player-status">
          {busy
            ? "LOADING"
            : snapshot?.state === "buffering"
              ? "BUFFERING"
              : snapshot?.state === "paused"
                ? "PAUSED"
                : "PLAYING"}
        </span>
      }
      <span className="player-eyebrow">
        {selected?.type === "live" ? "LIVE NOW" : "NOW PLAYING"}
      </span>
      <div className="player-context">
        {selected?.season
          ? `S${selected.season} · E${selected.episode ?? 1} · ${selected.episodeTitle ?? ""}`
          : ""}
      </div>
      <h1>
        <RokuText>{selected?.name ?? ""}</RokuText>
      </h1>
      {playerNotice && (
        <div className="player-notice" role="status">
          {playerNotice.message}
        </div>
      )}

      <div className="playback-bottom">
        {selected?.type !== "live" && (
          <>
            <SeekBar
              id="timeline"
              position={snapshot?.time.positionSeconds ?? 0}
              duration={snapshot?.time.durationSeconds ?? 0}
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
              // The app's remote key layer owns arrows/OK while this
              // bar is focused; only the pointer acts directly here.
              remoteKeys
            />
            <p className="player-time">
              <span>
                {formatPlaybackTime(
                  seek ?? snapshot?.time.positionSeconds ?? 0,
                )}
              </span>
              <span>
                {formatPlaybackTime(
                  snapshot?.time.durationSeconds ?? 0,
                )}
              </span>
            </p>
          </>
        )}
        <div className="controls">
          {selected?.type !== "live" && (
            <>
              <TvButton
                id="rewind"
                aria-label="Rewind 10 seconds"
                onActivate={() =>
                  void commitSeek(
                    Math.max(
                      0,
                      (snapshot?.time.positionSeconds ?? 0) - 10,
                    ),
                  )
                }
              >
                <img
                  src={`${import.meta.env.BASE_URL}assets/ui-nav-player-rewind.png`}
                  alt=""
                />
              </TvButton>
              <TvButton
                id="pause"
                aria-label={
                  snapshot?.state === "paused" ? "Play" : "Pause"
                }
                onActivate={() =>
                  void (snapshot?.state === "paused"
                    ? player.current?.play()
                    : player.current?.pause())
                }
              >
                <img
                  src={`${import.meta.env.BASE_URL}assets/ui-nav-player-${snapshot?.state === "paused" ? "play" : "pause"}.png`}
                  alt=""
                />
              </TvButton>
              <TvButton
                id="forward"
                aria-label="Forward 30 seconds"
                onActivate={() =>
                  void commitSeek(
                    Math.min(
                      snapshot?.time.durationSeconds ?? Infinity,
                      (snapshot?.time.positionSeconds ?? 0) + 30,
                    ),
                  )
                }
              >
                <img
                  src={`${import.meta.env.BASE_URL}assets/ui-nav-player-forward.png`}
                  alt=""
                />
              </TvButton>
              {selected?.type === "series" && (
                <TvButton
                  id="next"
                  onActivate={() => void nextEpisode()}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}assets/ui-nav-player-forward.png`}
                    alt="Next episode"
                  />
                </TvButton>
              )}
            </>
          )}
          <div className="track-buttons">
          <TvButton
            id="audio"
            aria-label="Audio"
            onActivate={() => trackChoices("audio")}
          >
            <AudioLines size={26} color="#f5f5f5" aria-hidden="true" />
          </TvButton>
          <TvButton
            id="subtitles"
            aria-label="Subtitles"
            onActivate={() => trackChoices("text")}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/ui-nav-player-captions.png`}
              alt=""
            />
          </TvButton>
          </div>
          <TvButton
            id="exit"
            aria-label="Exit"
            onActivate={() => void stop()}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/ui-nav-player-exit.png`}
              alt=""
            />
          </TvButton>
        </div>
      </div>
    </div>
  );
}
