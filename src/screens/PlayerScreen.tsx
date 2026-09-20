import { type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { AudioLines, Info, Maximize, Minimize, Volume2, VolumeX, X } from "lucide-react";
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
export function PlayerScreen({
  responsive,
  selected,
  busy,
  snapshot,
  playerNotice,
  seek,
  setSeek,
  setOverlay,
  commitSeek,
  togglePlayback,
  toggleLiveMute,
  fullscreenControl,
  player,
  fail,
  nextEpisode,
  stop,
  trackChoices,
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
}: {
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
}) {
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
      {responsive && (
        <div className="player-top-right">
          <TvButton
            id="player-top-fullscreen"
            className="player-top-btn"
            aria-label={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={fullscreenControl.fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onActivate={() => void fullscreenControl.toggle()}
          >
            {fullscreenControl.fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </TvButton>
        </div>
      )}
      {!responsive && (
        <span className="player-status">
          {busy
            ? "LOADING"
            : snapshot?.state === "buffering"
              ? "BUFFERING"
              : snapshot?.state === "paused"
                ? "PAUSED"
                : "PLAYING"}
        </span>
      )}
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
              remoteKeys={!responsive}
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
            onActivate={() => {
              if (responsive) {
                setActiveTrackPopup(activeTrackPopup === "audio" ? null : "audio");
                setPlayerInfoOpen(false);
              } else {
                trackChoices("audio");
              }
            }}
          >
            <AudioLines size={26} color="#f5f5f5" aria-hidden="true" />
          </TvButton>
          <TvButton
            id="subtitles"
            aria-label="Subtitles"
            onActivate={() => {
              if (responsive) {
                setActiveTrackPopup(activeTrackPopup === "text" ? null : "text");
                setPlayerInfoOpen(false);
              } else {
                trackChoices("text");
              }
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/ui-nav-player-captions.png`}
              alt=""
            />
          </TvButton>
          {responsive && activeTrackPopup && (
            <AudioSelectorPopup
              title={activeTrackPopup === "audio" ? "Audio Tracks" : "Subtitles"}
              tracks={activeTrackPopup === "audio" ? audioTrackList : textTrackList}
              offOption={activeTrackPopup === "text" ? subtitleOffOption : undefined}
              onClose={() => setActiveTrackPopup(null)}
            />
          )}
          </div>
          {responsive && <div className="responsive-player-tools">
            {player.current?.capabilities.canSetVolume && snapshot?.volume ? (
              <div
                className="player-volume"
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  aria-label={snapshot.volume.muted ? "Unmute" : "Mute"}
                  onClick={(e) => {
                    e.stopPropagation();
                    void player.current?.setMuted?.(!snapshot.volume?.muted).catch(fail);
                  }}
                >
                  {snapshot.volume.muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                </button>
                <input
                  type="range"
                  aria-label="Volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={snapshot.volume.muted ? 0 : snapshot.volume.level}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
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
              <button type="button" aria-label="Playback info" title="Playback info" onClick={() => { setPlayerInfoOpen((open) => !open); setActiveTrackPopup(null); }}><Info size={22} /></button>
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
          </div>}
          {!responsive && <TvButton
            id="exit"
            aria-label="Exit"
            onActivate={() => void stop()}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/ui-nav-player-exit.png`}
              alt=""
            />
          </TvButton>}
        </div>
      </div>
    </div>
  );
}
