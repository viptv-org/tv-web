import { batch, type Accessor, type Setter } from "solid-js";
import type { Overlay, Screen } from "./app-types";
import type { PlayerScene } from "./player-scene";
import type { SourcePlayScene } from "./source-play-scene";
import type { SourcePickerScene } from "./source-picker-scene";
import type { NavigationScene } from "./navigation-scene";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

/** The Back key: one decision tree over every layer the app can be showing.
 *
 * Order is the whole design. A pending stream outranks an overlay, an overlay
 * outranks the player chrome, the chrome outranks leaving the player, and only
 * then does Back walk the navigation history. Each branch either consumes the
 * press or delegates, so a press is never handled twice.
 */
export function createBackScene(options: {
  platform: string;
  screen: Accessor<Screen>;
  zone: Accessor<string>;
  setZone: Setter<string>;
  setColumn: Setter<number>;
  history: NavigationScene["history"];
  restorePrevious: NavigationScene["restore"];
  navigate: NavigationScene["navigate"];
  navs: Accessor<readonly { id: string }[]>;
  error: Accessor<string>;
  setError: Setter<string>;
  loading: Accessor<boolean>;
  setLoading: Setter<boolean>;
  overlay: Accessor<Overlay | undefined>;
  overlays: { close: (restoreFocus?: boolean) => void; restoreParent: () => boolean };
  picker: SourcePickerScene;
  sourceLoading: Accessor<boolean>;
  sourceActions: Accessor<boolean>;
  setSourceActions: Setter<boolean>;
  sourceMenu: Accessor<"quality" | "provider" | undefined>;
  setSourceMenu: Setter<"quality" | "provider" | undefined>;
  openingSource: Accessor<unknown>;
  setOpeningSource: (value: undefined) => void;
  sourcePlay: SourcePlayScene;
  libraryApplying: Accessor<boolean>;
  restartPaging: () => AbortSignal;
  player: { stop: () => Promise<void>; cancelPendingStart: () => boolean; leaseId?: string; flushProgress: () => Promise<void> | void };
  transport: { retire: () => void };
  playerScene: Pick<PlayerScene, "next" | "dismissedEnd" | "endScope" | "dismissNext">;
  playerNavigation: { cancel: () => void };
  segments: { clear: () => void };
  seeking: Accessor<boolean>;
  setSeeking: Setter<boolean>;
  seek: Accessor<number | undefined>;
  setSeek: Setter<number | undefined>;
  showControls: Accessor<boolean>;
  setShowControls: Setter<boolean>;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  countdown: { cancel: () => void };
  setAdvancing: Setter<boolean>;
  progressRefresh: { afterPlayback: (settled: never) => void };
  setPlaybackError: Setter<string>;
  setScreen: Setter<Screen>;
  setRow: Setter<number>;
  rememberHomeRow: () => void;
  rememberContentFocus: () => void;
  rememberDetailFocus: () => void;
  search: Accessor<string>;
  updateSearch: (value: string, immediate?: boolean) => void;
  searchMediaPending: Accessor<boolean>;
  searchChannelsPending: Accessor<boolean>;
  closeOverlay: () => void;
  dismissOverlay: () => void;
  confirmExit: () => void;
  finishSignIn: () => void;
  start: () => Promise<void>;
  startupAuthorityKnown: () => boolean;
  applyScreenInset: (value: number) => void;
  resetScope: () => AbortSignal;
  navIndex: (id: string) => number;
  hasProfile: () => boolean;
}) {
  /** Leaving the player puts the viewer back on the page that asked for it. */
  async function leavePlayer(): Promise<void> {
    options.transport.retire();
    options.resetScope();
    options.setSeek(undefined);
    options.setSeeking(false);
    options.segments.clear();
    options.setShowControls(false);
    await options.player.stop();
    const settled = options.player.flushProgress();
    options.setPlaybackError("");
    const back = options.sourcePlay.returnTo;
    batch(() => {
      options.setLoading(false);
      options.setScreen(back.screen() as Screen);
      options.setZone(back.focus().zone);
      options.setColumn(back.focus().column);
      options.setRow(back.focus().row);
      options.setError("");
    });
    options.progressRefresh.afterPlayback(settled as never);
    if (back.screen() === "search" && (options.searchMediaPending() || options.searchChannelsPending()))
      options.updateSearch(options.search(), true);
  }

  async function back(): Promise<void> {
    options.playerNavigation.cancel();
    options.rememberHomeRow();
    options.rememberContentFocus();
    options.rememberDetailFocus();
    options.playerScene.next.bump();
    options.setAdvancing(false);
    options.countdown.cancel();
    if (options.error()) {
      if (options.screen() === "welcome" && !options.startupAuthorityKnown()) await options.start();
      else options.setError("");
      return;
    }
    if (options.overlay()?.kind === "next") { options.playerScene.dismissNext(); return; }
    if ((options.sourceLoading() && !options.overlay()) || options.openingSource()) {
      const cancelInPlace = options.screen() !== "player" && !options.openingSource();
      options.sourcePlay.cancel();
      options.picker.operation.get()?.abort();
      options.picker.setSourceLoading(false);
      options.setLoading(false);
      if (options.player.cancelPendingStart()) {
        options.setOpeningSource(undefined);
        if (!options.player.leaseId && options.screen() === "player") {
          options.closeOverlay();
          await leavePlayer();
        }
        return;
      }
      if (cancelInPlace) return;
    }
    if (options.sourceActions()) { options.setSourceActions(false); return; }
    if (options.sourceMenu()) { options.setSourceMenu(undefined); return; }
    if (options.screen() === "signed-in") { options.finishSignIn(); return; }
    // A stream the drawer is opening is cancelled the way it always was: Back
    // leaves the player and returns to the page that asked for it.
    if (options.openingSource()) {
      options.setOpeningSource(undefined);
      await leavePlayer();
      return;
    }
    if (!options.overlay() &&
      (options.screen() === "welcome" || (options.screen() === "profiles" && !options.hasProfile()))) {
      if (options.platform === "webos" || options.platform === "tizen") options.confirmExit();
      return;
    }
    if (options.overlay()) {
      const current = options.overlay()!;
      if (current.kind === "calibration") {
        // Cancel restores the server-saved inset the overlay opened with.
        options.applyScreenInset(current.value);
        options.closeOverlay();
        return;
      }
      options.dismissOverlay();
      return;
    }
    if (options.screen() === "player") {
      if (options.seeking()) {
        if (options.showControls()) options.setShowControls(false);
        return;
      }
      if (options.seek() !== undefined) {
        options.setSeek(undefined);
        options.setShowControls(false);
        return;
      }
      if (options.showControls()) {
        if (options.snapshot()?.state === "ended")
          options.playerScene.dismissedEnd.set(options.playerScene.endScope());
        options.setShowControls(false);
        return;
      }
      await leavePlayer();
      return;
    }
    if (options.screen() === "pairing") {
      options.resetScope();
      options.setScreen("welcome");
      return;
    }
    if (options.screen() === "settings") {
      if (options.zone() !== "settings-nav") { options.setZone("settings-nav"); return; }
      if (!options.history.length) { await options.navigate("home"); return; }
    }
    const previous = options.history.pop();
    if (previous) {
      await options.restorePrevious(previous);
    } else if (options.platform === "tizen" && options.screen() === "home") {
      options.confirmExit();
    } else if (options.zone() !== "nav" && !["welcome", "profiles"].includes(options.screen())) {
      options.setZone("nav");
      options.setColumn(Math.max(0, options.navs().findIndex(item => item.id === options.screen())));
    } else if (options.platform === "webos" && options.screen() === "profiles") {
      options.setScreen("welcome");
    } else if (options.platform === "webos" && options.screen() === "home") {
      await options.navigate("profiles");
    } else {
      await options.navigate("home");
    }
  }

  return { back, leavePlayer };
}

export type BackScene = ReturnType<typeof createBackScene>;
