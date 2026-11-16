import type { Accessor, Setter } from "solid-js";
import type { RemoteTvApi } from "./api";
import { createSourceIntent } from "./source-picker/intent";
import { startSourceCandidate } from "./source-picker/start-candidate";
import { presentationCard } from "./presentation-card";
import { episodeKey } from "./episode-preparation";
import type { Card, Source, TitleAction } from "./types";
import type { Overlay } from "./app-types";
import type { PlayIntent } from "./source-picker/intent-types";
import type { PlayerScene } from "./player-scene";
import type { SourcePickerScene } from "./source-picker-scene";
import type { PlayerChrome } from "./player-chrome";
import type { AutoplayCountdown } from "./autoplay-countdown";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

/** Choosing a source, and what happens when it starts.
 *
 * `playIntent` is the remote's Play: it opens the picker with the intent to
 * play, and `playSource` is the picker's answer. Both are here because they are
 * one transaction — the intent's id, the operation it owns and the attempt that
 * started are compared in both directions so a cancelled or superseded start can
 * never take the UI away from the stream that actually runs.
 */
export function createSourcePlayScene(options: {
  api: RemoteTvApi;
  picker: SourcePickerScene;
  player: PlayerScene["player"];
  playerScene: PlayerScene;
  transport: PlayerScene["transport"];
  segments: { clear: () => void; refresh: () => Promise<void> };
  screen: Accessor<string>;
  setScreen: (value: any) => void;
  zone: Accessor<string>;
  setZone: Setter<string>;
  column: Accessor<number>;
  setColumn: Setter<number>;
  row: Accessor<number>;
  setRow: Setter<number>;
  setPlaybackError: Setter<string>;
  setError: Setter<string>;
  setLoading: Setter<boolean>;
  activeAction: Accessor<TitleAction | undefined>;
  setActiveAction: Setter<TitleAction | undefined>;
  activeChannel: Accessor<string | undefined>;
  setActiveChannel: Setter<string | undefined>;
  activeSource: Accessor<Source | undefined>;
  setActiveSource: Setter<Source | undefined>;
  openingSource: Accessor<Source | undefined>;
  setOpeningSource: Setter<Source | undefined>;
  overlays: { captureOrigin: () => void; hide: () => void; origin: () => { zone: string; column: number; row: number } };
  overlay: Accessor<Overlay | undefined>;
  notify: (message: string) => void;
  fail: (error: unknown) => void;
  retry: (work: () => void) => void;
  searchRequests: { scope?: AbortController; timer?: ReturnType<typeof setTimeout> };
  playerNavigation: { reset: () => void };
  setTimelineFocused: Setter<boolean>;
  setShowControls: Setter<boolean>;
  setChoice: Setter<number>;
  hideControls: () => void;
  chrome: PlayerChrome;
  countdown: AutoplayCountdown;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  deviceScope: () => string;
  deviceTitleKey: (scope: string, card: Card) => string;
  sourceChannel: () => string | undefined;
  signal: () => AbortSignal;
}) {
  let sourceIntent = 0;
  let sourceAttempt = 0;
  let returnScreen: string | undefined;
  let returnFocus = { zone: "hero", column: 0, row: 0 };

  const playIntent: PlayIntent = createSourceIntent({
    api: options.api,
    begin: (card, restart, channel, replaceCurrent, position) => {
      const id = ++sourceIntent, epoch = options.api.scopeEpoch;
      options.playerScene.manual.clear();
      options.countdown.cancel();
      options.picker.startPosition.begin(card, restart, position);
      options.picker.operation.get()?.abort();
      const operation = new AbortController();
      options.picker.beginSession(card, channel, replaceCurrent, operation);
      return { id, epoch, operation };
    },
    owner: {
      intent: () => sourceIntent, epoch: () => options.api.scopeEpoch,
      operation: () => options.picker.operation.get(),
      replace: operation => { options.picker.operation.set(operation); },
      aborted: () => options.signal().aborted,
    },
    position: options.picker.startPosition.current,
    manual: () => options.picker.manual.get(),
    playerScreen: () => options.screen() === "player",
    memory: card => options.playerScene.sourceMemory(card),
    presentation: { capture: options.overlays.captureOrigin, hide: options.overlays.hide, show: () => options.picker.open() },
    resolve: action => {
      options.picker.startPosition.adopt(action);
      options.picker.setAction(action);
      options.picker.setPickerCard(previous => presentationCard(previous, action.card));
    },
    retry: work => { options.retry(work); },
    page: options.picker.setPage, ids: options.picker.setIds, loading: options.setLoading,
    discovering: options.picker.setSourceLoading,
    failure: { current: options.picker.failure, set: options.picker.setFailure },
    rows: options.picker.rows, reconcile: options.picker.sourceRows.reconcile, publish: options.picker.publish,
    play: (source, direct, manual) => playSource(source, direct, manual),
    notify: options.notify, fail: options.fail,
  });

  async function playSource(source: Source, direct = false, manual = true): Promise<boolean> {
    const current = options.picker.action();
    if (!current) return false;
    options.transport.retire();
    const attempt = ++sourceAttempt;
    if (manual) sourceIntent++;
    const outgoing = {
      lease: options.player.leaseId, action: options.activeAction(), source: options.activeSource(),
      channel: options.activeChannel(),
    };
    if (manual)
      options.playerScene.manual.set({
        source: source.id, card: episodeKey(current.card), scope: options.deviceScope(),
        title: options.deviceTitleKey(options.deviceScope(), current.card),
      });
    else options.playerScene.manual.clear();
    const channel = options.sourceChannel();
    options.retry(() => void playIntent(current.card, true, false, channel, options.player.canReplaceSource));
    if (options.screen() !== "player") {
      returnScreen = options.screen();
      returnFocus = { zone: options.overlays.origin().zone, column: options.overlays.origin().column, row: options.overlays.origin().row };
    }
    options.picker.operation.get()?.abort();
    if (options.screen() === "search") {
      options.searchRequests.scope?.abort();
      clearTimeout(options.searchRequests.timer);
    }
    options.setScreen("player");
    options.setError("");
    options.setPlaybackError("");
    options.setTimelineFocused(true);
    options.playerNavigation.reset();
    options.setActiveSource(source);
    options.setActiveAction(current);
    options.setActiveChannel(options.sourceChannel());
    options.setShowControls(true);
    options.setChoice(0);
    options.picker.setFailure("");
    options.segments.clear();
    // The drawer stays up while the chosen stream opens, so its status line
    // reports the contract's `Opening stream…` from the player's real
    // preparation instead of a timer, and a second press cannot start a
    // duplicate stream.
    options.setOpeningSource(source);
    options.setLoading(true);
    document.getElementById("video-layer")!.style.display = "block";
    let started = false;
    try {
      await startSourceCandidate({
        player: options.player, source, action: current, direct, manual, replacing: options.picker.replacing(),
        position: options.picker.startPosition.current,
        positionIsAuthoritative: options.picker.startPosition.authoritative,
        current: () => attempt === sourceAttempt, notify: options.notify,
      });
      started = true;
      options.setLoading(false);
      void options.segments.refresh();
      options.hideControls();
    } catch (error) {
      // Cancellation can leave the outgoing lease alive too. Restore its UI only
      // while this attempt still owns it; never rewind a newer attempt.
      const retained = outgoing.lease && options.player.leaseId === outgoing.lease;
      if (retained && options.activeAction() === current && options.activeSource() === source) {
        options.setActiveAction(outgoing.action);
        options.setActiveSource(outgoing.source);
        options.setActiveChannel(outgoing.channel);
      }
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      // A replacement admission failure leaves the outgoing lease alive. Keep it
      // (and the retry) so the open picker can try another source.
      if (attempt === sourceAttempt) options.playerScene.manual.clear();
      if (!retained && (!options.picker.replacing() || !options.player.leaseId))
        await options.player.stop().catch(() => {});
      options.setLoading(false);
      options.setError("");
      options.setPlaybackError("");
      options.picker.setFailed(previous => new Set(previous).add(source.id));
      // Keep the picker over the page that requested the stream, exactly as the
      // TV drawer does, and mark the row instead of dead-ending in the player's
      // full-screen failure card.
      if (returnScreen && !options.player.leaseId) {
        options.setScreen(returnScreen);
        options.setZone(returnFocus.zone);
        options.setColumn(returnFocus.column);
        options.setRow(returnFocus.row);
      }
      options.picker.setFailure("This source couldn't start. Choose another source.");
    } finally {
      if (attempt === sourceAttempt) options.setOpeningSource(undefined);
      // Only the drawer this stream was successfully chosen from. A failed start
      // stays open so the next source is one press away.
      if (started && options.overlay()?.kind === "sources") options.overlays.hide();
    }
    return started;
  }

  return {
    playIntent, playSource,
    attempts: { current: () => sourceAttempt, next: () => ++sourceAttempt },
    intents: { current: () => sourceIntent, next: () => ++sourceIntent },
    cancel(): void { sourceAttempt++; sourceIntent++; },
    returnTo: { screen: () => returnScreen, focus: () => returnFocus },
  };
}

export type SourcePlayScene = ReturnType<typeof createSourcePlayScene>;
