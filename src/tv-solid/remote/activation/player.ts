import type { Accessor, Setter } from "solid-js";
import type { PlayerSnapshot } from "../../../../vendor/video/src/types";
import type { RemotePlayback } from "../playback";
import type { Card, Detail, PlaybackSegment, TitleAction } from "../types";
import type { DialogActions } from "../feature-ports";
import type { PlayIntent } from "../source-picker/intent-types";

export function createPlayerActivation(options: {
  player: Pick<RemotePlayback, "seek" | "player">; snapshot: Accessor<PlayerSnapshot | undefined>; actions: Accessor<RemotePlayback["actions"]>;
  action: Accessor<TitleAction | undefined>; channel: Accessor<string | undefined>; choice: Accessor<number>; buttons: Accessor<{id: string}[]>;
  timeline: {value: Accessor<number | undefined>; set: Setter<number | undefined>; seeking: Setter<boolean>};
  chrome: {visible: Accessor<boolean>; set: Setter<boolean>; hide: () => void};
  segments: {active: Accessor<PlaybackSegment | undefined>; clear: () => void; refresh: () => Promise<void>};
  setPlaying: (playing: boolean) => Promise<void>;
  skipEnabled: Accessor<boolean>; next: () => Promise<void>; tracks: () => void; play: PlayIntent;
  details: (card: Card) => Promise<Detail>; dialogs: Pick<DialogActions, "open">;
}) {
  const {player, snapshot, actions: playerActions, action: activeAction, channel: activeChannel, choice, buttons: playerButtons,
    next: advanceEpisode, tracks: openTracks, play: playIntent} = options;
  const {value: seek, set: setSeek, seeking: setSeeking} = options.timeline;
  const {visible: showControls, set: setShowControls, hide: hideControls} = options.chrome;
  const {active: activeSegment, clear: clearSegments, refresh: refreshPlaybackSegments} = options.segments;
  const openOverlay = options.dialogs.open;
  return async () => {
    if (!showControls()) {
      setSeek(undefined);
    } else if (seek() !== undefined) {
      const position = seek()!;
      if (!playerActions().seek) return;
      if (
        Math.abs(
          position - (snapshot()?.time.positionSeconds ?? 0),
        ) < 0.5
      ) {
        setSeek(undefined);
        return;
      }
      setShowControls(true);
      setSeeking(true);
      clearSegments();
      try {
        await player.seek(position);
        void refreshPlaybackSegments();
      } finally {
        setSeeking(false);
        setSeek(undefined);
        hideControls();
      }
      return;
    }
    const control = !showControls()
      ? activeSegment() && playerActions().seek && options.skipEnabled() ? "skip" : "timeline"
      : playerButtons()[choice()]?.id;
    if (snapshot()?.state === "ended" && control === "timeline") {
      await playIntent(activeAction()!.card, false, true);
      return;
    }
    if (control === "next") {
      await advanceEpisode();
    } else if (control === "skip") {
      const segment = activeSegment();
      if (segment) {
        setShowControls(true);
        setSeeking(true);
        clearSegments();
        try {
          await player.seek(segment.end_ms / 1000);
          void refreshPlaybackSegments();
        } finally {
          setSeeking(false);
          hideControls();
        }
      }
    } else if (control === "tracks") {
      openTracks();
    } else if (control === "sources") {
      await playIntent(
        activeAction()!.card,
        true,
        false,
        activeChannel(),
        true,
      );
    } else if (control === "episodes") {
      const result = await options.details(activeAction()!.card);
      openOverlay({
        kind: "choices",
        title: "Episodes",
        items: result.episodes.map((card) => ({
          id: card.identity.id,
          label: card.subtitle ?? card.title,
          run: () => playIntent(card),
        })),
      });
    } else if (control === "timeline" && playerActions().pause) {
      await options.setPlaying(snapshot()?.state !== "playing");
    }
  };
}
