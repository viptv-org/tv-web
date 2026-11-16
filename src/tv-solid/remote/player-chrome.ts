import { createEffect, createMemo, createSignal, type Accessor, type Setter } from "solid-js";
import { SKIP_BUTTON } from "./player/skip-intro";
import { LAYOUT } from "./layout";

export interface PlayerButton { id: string; label: string }
export interface PlayerTool extends PlayerButton { x: number; width: number; icon: string }

/** The player's chrome: the control row's buttons, their geometry, and the
 * auto-hide clock.
 *
 * The row is one list with two layout groups. Play, Episodes, Tracks and Source
 * flow from the inset; Next episode and Skip are laid out from the right edge,
 * because they belong to a *moment* (the end of an episode, its opening) rather
 * than to the row's order. Skip keeps one rect whether the chrome is showing it
 * or the hidden-chrome button is.
 */
export function createPlayerChrome(options: {
  screen: Accessor<string>;
  overlay: Accessor<unknown>;
  choice: Accessor<number>;
  setChoice: Setter<number>;
  seek: Accessor<number | undefined>;
  setSeek: Setter<number | undefined>;
  setShowControls: Setter<boolean>;
  canPause: Accessor<boolean>;
  canSeek: Accessor<boolean>;
  canEpisodes: Accessor<boolean>;
  canTracks: Accessor<boolean>;
  canChangeSource: Accessor<boolean>;
  nextAvailable: Accessor<boolean>;
  segment: Accessor<unknown>;
  skipEnabled: Accessor<boolean>;
  skipText: () => string;
  seekBusy: Accessor<boolean>;
  pauseRequested: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string>;
  playing: Accessor<boolean>;
}) {
  const [timelineFocused, setTimelineFocused] = createSignal(true);
  const buttons = createMemo((): PlayerButton[] => [
    { id: options.canPause() || options.canSeek() ? "timeline" : "status", label: "" },
    ...(options.canEpisodes() ? [{ id: "episodes", label: "Episodes" }] : []),
    ...(options.canTracks() ? [{ id: "tracks", label: "Audio & subtitles" }] : []),
    ...(options.canChangeSource() ? [{ id: "sources", label: "Source" }] : []),
    ...(options.nextAvailable() ? [{ id: "next", label: "Next episode" }] : []),
    // Skip is a control-row button like Next episode: last, at the far right, so
    // it is one button in one place whatever the chrome does.
    ...(options.segment() && options.canSeek() && options.skipEnabled()
      ? [{ id: "skip", label: options.skipText() }]
      : []),
  ], undefined, { equals: (a, b) => a.length === b.length && a.every((button, index) => button.id === b[index].id && button.label === b[index].label) });
  const tools = createMemo<PlayerTool[]>(() => {
    let left = 268;
    const laid = buttons().slice(1).map(button => {
      if (button.id === "skip" || button.id === "next")
        return { ...button, x: 0, width: button.id === "next" ? 240 : SKIP_BUTTON.width, icon: "" };
      const width = button.id === "tracks" ? 304 : 228;
      const tool = { ...button, x: left, width, icon: button.id === "episodes" ? "episodes" : button.id === "tracks" ? "audio" : "settings" };
      left += width + LAYOUT.controlGap;
      return tool;
    });
    let edge = LAYOUT.rightEdge;
    for (let index = laid.length - 1; index >= 0; index--) {
      if (laid[index].id !== "skip" && laid[index].id !== "next") continue;
      edge -= laid[index].width;
      laid[index].x = edge;
      edge -= LAYOUT.controlGap;
    }
    return laid;
  });
  // Keep the selection inside the row: a segment ending removes Skip, and a
  // lease that cannot seek removes the timeline.
  createEffect(() => {
    const count = buttons().length;
    if (options.screen() === "player" && !options.overlay() && options.choice() >= count)
      options.setChoice(Math.max(0, count - 1));
    if (!options.canSeek()) options.setSeek(undefined);
  });

  let hideAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function hideControls(activity = true) {
    if (activity || !hideAt) hideAt = Date.now() + 5000;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!options.error() && !options.overlay() && !options.seekBusy() && !options.pauseRequested() &&
        !options.loading() && options.playing())
        options.setShowControls(false);
    }, Math.max(0, hideAt - Date.now()));
  }
  // A timer armed during buffering used to give up and never re-arm. Re-arm on
  // every transition back to playing so the chrome always clears itself.
  const canAutoHide = createMemo(() =>
    options.screen() === "player" && !options.overlay() && options.playing() &&
    !options.seekBusy() && !options.pauseRequested() && !options.loading() && !options.error());
  createEffect(() => {
    // Memo equality keeps position/buffer snapshots from rearming this timer.
    if (canAutoHide()) hideControls(false);
    else clearTimeout(timer);
  });
  const cancelHide = () => clearTimeout(timer);
  return { buttons, tools, timelineFocused, setTimelineFocused, hideControls, canAutoHide, cancelHide };
}

export type PlayerChrome = ReturnType<typeof createPlayerChrome>;
