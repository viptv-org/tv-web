import { batch, createEffect, createMemo, onCleanup, type Accessor, type Setter } from "solid-js";
import { RemotePlayback } from "./playback";
import { createPlayerTransport } from "./player-transport";
import { EpisodePreparation, type EpisodePreparationState } from "./episode-preparation";
import { createEpisodeDiscovery } from "./source-picker/prepare-episode";
import { whenIdle } from "./idle";
import type { RemoteTvApi } from "./api";
import type { DevicePlayback } from "./device-playback";
import type { AutoplayCountdown } from "./autoplay-countdown";
import type { Card, Detail, Preferences, TitleAction } from "./types";
import type { Overlay } from "./app-types";
import type { PlayIntent } from "./source-picker/intent-types";
import type { PlayerSnapshot } from "../../../vendor/video/src/types";

type ManualPresentation = { source: string; card: string; scope: string; title: string };

/** The playback engine and what happens between its frames.
 *
 * One object owns the engine, the transport keys, the episode that will play
 * next and the countdown that decides whether it does. The end of an episode is
 * a *scope*, not a flag: `dismissedEnd` and the continuation poll both compare
 * the lease that ended, so a dismissal cannot silence a different episode and a
 * refresh cannot revive the one the viewer dismissed.
 */
export function createPlayerScene(options: {
  api: RemoteTvApi;
  platform: string;
  video: () => HTMLVideoElement;
  snapshot: Accessor<PlayerSnapshot | undefined>;
  setSnapshot: Setter<PlayerSnapshot | undefined>;
  setPauseRequested: Setter<boolean>;
  activeSource: Accessor<{ id: string } | undefined>;
  deviceRevision: Accessor<number>;
  screen: Accessor<string>;
  home: Accessor<unknown>;
  preferences: Accessor<Preferences | undefined>;
  deviceScope: () => string;
  devicePlayback: DevicePlayback;
  notify: (message: string) => void;
  fail: (error: unknown) => void;
  retry: (work: () => void) => void;
  openingSource: Accessor<unknown>;
  overlay: Accessor<Overlay | undefined>;
  setShowControls: Setter<boolean>;
  showControls: Accessor<boolean>;
  setChoice: Setter<number>;
  hideControls: () => void;
  activeAction: Accessor<TitleAction | undefined>;
  activeChannel: Accessor<string | undefined>;
  setPresentationRevision: Setter<number>;
  sourceMemoryPending: Accessor<number>;
  setSourceMemoryPending: Setter<number>;
  episodeKey: (card: Card) => string;
  deviceTitleKey: (scope: string, card: Card) => string;
  playIntent: PlayIntent;
  checkPlaybackRevision: () => Promise<void>;
  countdown: AutoplayCountdown;
  episodeState: Accessor<EpisodePreparationState>;
  setEpisodeState: Setter<EpisodePreparationState>;
  advancing: Accessor<boolean>;
  setAdvancing: Setter<boolean>;
  overlays: { hide: () => void };
  openOverlay: (value: Overlay) => void;
  playbackRevision: Accessor<string>;
  sourceLoading: Accessor<boolean>;
  loading: Accessor<boolean>;
  error: Accessor<string>;
  scopeSignal: Accessor<AbortSignal>;
  detail: Accessor<Detail | undefined>;
}) {
  let engineWarmed = false;
  let nextIntent = 0;
  let dismissedEnd = "";
  let manual: ManualPresentation | undefined;

  const player = new RemotePlayback(
    options.api, options.platform, options.video(), options.setSnapshot,
    (error, position) => {
      // A failed source start belongs to the picker, which stays open and marks
      // the row. Only a player failure outside that window owns the page card.
      if (options.openingSource() || options.overlay()?.kind === "sources") return;
      options.fail(error);
      const current = options.activeAction();
      if (current)
        options.retry(() => void options.playIntent(current.card, true, false, options.activeChannel(), false, position));
      options.setShowControls(true);
    },
    (_lease, card, source) => {
      const observation = manual;
      const remember = observation && observation.source === source.id && observation.card === options.episodeKey(card) &&
        observation.scope === options.deviceScope() && options.preferences()?.preferences.remembered_source_reuse !== false &&
        source.source_addon_id;
      if (!remember) { options.setPresentationRevision(v => v + 1); return; }
      manual = undefined;
      batch(() => { options.setSourceMemoryPending(v => v + 1); options.setPresentationRevision(v => v + 1); });
      const language = player.tracks.audio.find(track => track.selected && track.language)?.language;
      void options.devicePlayback.rememberSource(observation.scope, observation.title, source, language)
        .catch(() => options.notify("Couldn’t save this source choice on this device."))
        .finally(() => options.setSourceMemoryPending(v => Math.max(0, v - 1)));
    },
  );
  const transport = createPlayerTransport({
    play: () => player.player.play(), pause: () => player.player.pause(), pending: options.setPauseRequested,
    reveal: () => { options.setShowControls(true); options.setChoice(0); },
    activity: () => options.hideControls(), active: () => options.screen() === "player",
  });
  // Warm the playback engine at the first moment the user could plausibly press
  // Play: Home is on screen and the browser has nothing better to do. The fetch
  // never sits between that press and the first frame.
  createEffect(() => {
    if (engineWarmed || options.screen() !== "home" || !options.home()) return;
    engineWarmed = true;
    whenIdle(() => player.prewarm());
  });

  async function sourceMemory(card: Card) {
    if (options.preferences()?.preferences.remembered_source_reuse === false) return {};
    return options.devicePlayback.context(options.deviceScope(), options.deviceTitleKey(options.deviceScope(), card));
  }
  const discovery = createEpisodeDiscovery({ api: options.api, memory: sourceMemory });
  const episodes = new EpisodePreparation((card, signal) => options.api.next(card, signal), discovery, options.setEpisodeState);

  createEffect(() => {
    const current = options.activeAction()?.card;
    const state = options.screen();
    const source = options.activeSource()?.id;
    const revision = options.preferences()?.revision;
    const device = options.deviceRevision();
    if (state !== "player" || options.activeChannel() || !current?.identity.episode || !current.parent_identity || !source) {
      episodes.clear(); options.countdown.cancel(); return;
    }
    const key = JSON.stringify([options.api.scopeEpoch, options.api.profile, options.episodeKey(current), source, revision,
      device, options.playbackRevision()]);
    if (episodes.configure(key, current, options.scopeSignal())) void episodes.refresh();
  });
  createEffect(() => {
    const time = options.snapshot()?.time;
    const next = options.episodeState();
    if (options.screen() === "player" && next.item && time && Number.isFinite(time.durationSeconds) &&
      (time.durationSeconds ?? 0) > 0 && (time.durationSeconds ?? 0) - time.positionSeconds <= 180 &&
      player.hasPresentedFrame && !options.sourceMemoryPending() && !options.openingSource() && !options.advancing())
      void episodes.prepare();
  });

  const endScope = () => `${options.api.scopeEpoch}:${player.leaseId ?? ""}`;
  function revealEndedControls(): boolean {
    if (options.screen() !== "player" || options.overlay() || options.showControls() || options.error() ||
      options.snapshot()?.state !== "ended" || dismissedEnd !== endScope()) return false;
    options.setShowControls(true); options.setChoice(0);
    return true;
  }
  function dismissNext() {
    nextIntent++; options.setAdvancing(false);
    options.countdown.cancel(); dismissedEnd = endScope();
    options.overlays.hide(); options.setShowControls(false);
  }
  createEffect(() => {
    const next = options.episodeState();
    if (options.screen() !== "player" || options.snapshot()?.state !== "ended" || options.advancing() ||
      options.openingSource() || options.sourceLoading() || options.loading() || options.error()) return;
    if (next.status !== "ready") options.countdown.cancel();
    if (!next.item) {
      if (options.overlay()?.kind === "next") dismissNext();
      return;
    }
    if (next.status !== "ready" || dismissedEnd === endScope() ||
      (options.overlay() && options.overlay()?.kind !== "next")) return;
    if (!options.overlay()) options.openOverlay({ kind: "next", title: "Up next", items: [] });
    const target = options.episodeKey(next.item), ended = endScope();
    options.countdown.start(ended, options.devicePlayback.autoplay,
      () => options.screen() === "player" && options.snapshot()?.state === "ended" &&
        options.overlay()?.kind === "next" && !options.advancing() &&
        options.episodeState().status === "ready" && !!options.episodeState().item &&
        options.episodeKey(options.episodeState().item!) === target,
      () => { void advanceEpisode().catch(options.fail); });
  });
  const endedPresentation = createMemo(() =>
    options.screen() === "player" && options.snapshot()?.state === "ended" ? endScope() : "");
  createEffect(() => {
    const ended = endedPresentation();
    if (ended && dismissedEnd !== ended) options.setShowControls(true);
  });
  const continuationPoll = setInterval(() => {
    const time = options.snapshot()?.time;
    const due = options.snapshot()?.state === "ended" ||
      (!!time?.durationSeconds && time.durationSeconds - time.positionSeconds <= 180);
    const retry = due && ["loading", "error"].includes(options.episodeState().status);
    if (options.screen() === "player" && !options.advancing() &&
      (options.overlay()?.kind === "next" || retry)) void episodes.refresh();
  }, 2000);
  onCleanup(() => { clearInterval(continuationPoll); options.countdown.cancel(); episodes.clear(); });

  async function advanceEpisode(forcePicker = false): Promise<void> {
    if (options.advancing()) return;
    const ticket = ++nextIntent;
    options.countdown.cancel(); options.setAdvancing(true);
    try {
      const expected = options.episodeState().item;
      await options.checkPlaybackRevision();
      if (ticket !== nextIntent || options.scopeSignal().aborted || options.screen() !== "player") return;
      const card = await episodes.refresh();
      if (ticket !== nextIntent || options.scopeSignal().aborted || options.screen() !== "player") return;
      if (!card) { options.notify("There’s no next episode available."); return; }
      if (expected && options.episodeKey(expected) !== options.episodeKey(card)) {
        options.notify("The next episode changed. Press Next to continue."); return;
      }
      const prepared = forcePicker ? undefined : episodes.take(card);
      options.overlays.hide();
      await options.playIntent(card, forcePicker, true, undefined, false, 0, !forcePicker, prepared);
    } finally {
      if (ticket === nextIntent) options.setAdvancing(false);
    }
  }

  return {
    player, transport, episodes, discovery, sourceMemory, advanceEpisode, revealEndedControls, dismissNext,
    endedPresentation, endScope,
    next: { bump: () => ++nextIntent, current: () => nextIntent },
    dismissedEnd: { set: (value: string) => { dismissedEnd = value; }, get: () => dismissedEnd },
    manual: {
      get: () => manual,
      set: (value: ManualPresentation) => { manual = value; },
      clear: () => { manual = undefined; },
    },
  };
}
