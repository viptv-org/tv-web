import type { Accessor, Setter } from "solid-js";
import type { PlayerSnapshot } from "../../../../vendor/video/src/types";
import type { RemotePlayback } from "../playback";
import type { TitleAction } from "../types";
import type { PlayIntent } from "../source-picker/intent-types";

export function createPlayerMediaKeys(options: {
  player: Pick<RemotePlayback, "player" | "seek">; snapshot: Accessor<PlayerSnapshot | undefined>; actions: Accessor<RemotePlayback["actions"]>;
  active: Accessor<TitleAction | undefined>; seeking: {current: Accessor<boolean>; set: Setter<boolean>}; revealEnded: () => boolean; play: PlayIntent;
  setPlaying: (playing: boolean) => Promise<void>;
  chrome: {show: Setter<boolean>; hide: () => void}; segments: {clear: () => void; refresh: () => Promise<void>}; fail: (error: unknown) => void;
}) {
  const {player, snapshot, actions: playerActions, active: activeAction, revealEnded: revealEndedControls, play: playIntent, fail} = options;
  const {current: seeking, set: setSeeking} = options.seeking;
  const {show: setShowControls, hide: hideControls} = options.chrome;
  const {clear: clearSegments, refresh: refreshPlaybackSegments} = options.segments;
  return (event: KeyboardEvent) => {
    if (
      ["MediaPlayPause", "MediaPlay", "MediaPause", " "].includes(
        event.key,
      ) ||
      [10252, 415, 19].includes(event.keyCode)
    ) {
      event.preventDefault();
      if (event.repeat) return true;
      if (revealEndedControls()) return true;
      if (snapshot()?.state === "ended") {
        const pause = event.key === "MediaPause" || event.keyCode === 19;
        if (!pause && playerActions().restart && activeAction())
          void playIntent(activeAction()!.card, false, true).catch(fail);
        return true;
      }
      if (!playerActions().pause) return true;
      const play =
        event.key === "MediaPlay" ||
        event.keyCode === 415 ||
        (!(["MediaPause"].includes(event.key) || event.keyCode === 19) &&
          snapshot()?.state !== "playing");
      void options.setPlaying(play).catch(fail);
      return true;
    }
    if (
      ["MediaFastForward", "MediaRewind"].includes(event.key) ||
      [412, 417].includes(event.keyCode)
    ) {
      event.preventDefault();
      if (event.repeat || revealEndedControls() || !playerActions().seek || seeking()) return true;
      const direction =
        event.key === "MediaRewind" || event.keyCode === 412 ? -1 : 1;
      const duration = Number(snapshot()?.time.durationSeconds);
      const target =
        (snapshot()?.time.positionSeconds ?? 0) + direction * 10;
      const position = Math.max(
        0,
        Number.isFinite(duration) && duration > 0
          ? Math.min(duration, target)
          : target,
      );
      if (Math.abs(position - (snapshot()?.time.positionSeconds ?? 0)) < 0.5)
        return true;
      setShowControls(true);
      setSeeking(true);
      clearSegments();
      void player
        .seek(position)
        .then(() => void refreshPlaybackSegments())
        .catch(fail)
        .finally(() => {
          setSeeking(false);
          hideControls();
        });
      return true;
    }
    return false;
  };
}
