import type { MediaItem, MediaSource, TvApi } from "../api";
import { monitorPlaybackLease } from '../api/playback-lease';
import { TvApiError } from '../api';
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
  type PlaybackControllerSnapshot,
} from "@viptv/video";

export type TvPlatform = "tizen" | "vizio" | "webos";

export interface SolidTVPlaybackCallbacks {
  onControllerState?: (state: PlaybackControllerSnapshot<MediaItem, MediaSource>) => void;
  onTerminalError?: (error: Error, state: PlaybackControllerSnapshot<MediaItem, MediaSource>) => void;
}

export interface SolidTVPlaybackRuntime {
  readonly player: Player;
  readonly controller: PlaybackSessionController<MediaItem, MediaSource>;
  start(
    item: MediaItem,
    source: MediaSource | undefined,
    position: number,
  ): ReturnType<PlaybackSessionController<MediaItem, MediaSource>["start"]>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
}

/** One adapter/controller instance for the TV player, using the pinned video package. */
export function createSolidTVPlaybackRuntime(
  api: TvApi,
  platform: TvPlatform,
  video: HTMLVideoElement,
  onSnapshot: (snapshot: PlayerSnapshot) => void,
  callbacks: SolidTVPlaybackCallbacks = {},
): SolidTVPlaybackRuntime {
  // webOS is not yet a named video adapter; its browser-compatible HTML path
  // is a staged host fallback pending physical webOS capability qualification.
  const enginePlatform: PlayerPlatform =
    platform === "webos" ? "html5" : platform;
  const player = createPlayer({ platform: enginePlatform, video });
  const controller = new PlaybackSessionController<MediaItem, MediaSource>({
    player,
    backend: api,
    capabilities: deliveryCapabilitiesFor(enginePlatform),
  });
  let disposed = false;
  let generation = 0;
  let reportedError: unknown;
  let monitor: ReturnType<typeof monitorPlaybackLease> | undefined;
  let monitoredId: string | undefined;
  let activity = 0;
  const interaction = () => { activity++; };
  const reconnect = async () => {
    if (disposed || document.visibilityState !== 'visible' || !monitor) return;
    const current = monitor, id = monitoredId, revision = activity;
    const playing = player.snapshot.state === 'playing';
    if (playing) await player.pause().catch(() => undefined);
    const ready = await current.refresh();
    if (disposed || current !== monitor || id !== controller.snapshot.active?.session.id) return;
    if (ready && playing && revision === activity) await player.play().catch(error => report(error));
    else if (!ready && current.isActive()) report(new TvApiError(409, 'Playback could not reconnect. Retry playback.', 'playback_reconnect_failed'));
  };
  const report = (error: Error, identity: unknown = error) => {
    if (reportedError === identity) return;
    reportedError = identity;
    if (callbacks.onTerminalError) callbacks.onTerminalError(error, controller.snapshot);
    else console.error("TV playback recovery failed", error);
  };
  const unsubscribeController = controller.subscribe((state) => {
    const id = state.active?.session.id;
    if (id !== monitoredId) {
      monitor?.dispose(); monitor = undefined; monitoredId = id;
      const lease = id ? api.playbackLease?.(id) : undefined;
      if (id && lease) monitor = monitorPlaybackLease(lease, options => api.renewPlaybackV2(id, options), error => {
        if (disposed || controller.snapshot.active?.session.id !== id) return;
        const stopping = controller.stop();
        report(error instanceof Error ? error : new Error('Playback authorization was lost.'));
        void stopping.catch(() => undefined);
      });
    }
    if (!disposed) callbacks.onControllerState?.(state);
  });
  document.addEventListener('visibilitychange', reconnect);
  window.addEventListener('keydown', interaction);
  window.addEventListener('pointerdown', interaction);
  const unsubscribe = player.subscribe((snapshot) => {
    if (disposed) return;
    const ticket = generation;
    onSnapshot(snapshot);
    void controller.recoverPlayback(snapshot).then((handled) => {
      if (disposed || ticket !== generation) return;
      // Only the unresolved current decoder error is terminal. Recovery can
      // replace the adapter/session before its original event settles.
      if (!handled && snapshot.error && player.snapshot.error === snapshot.error &&
        player.snapshot.sessionId === snapshot.sessionId)
        report(new Error(snapshot.error.message), snapshot.error);
    }).catch((cause: unknown) => {
      if (disposed || ticket !== generation ||
        (typeof cause === "object" && cause !== null && "name" in cause && cause.name === "AbortError")) return;
      // A newer seek/track operation may supersede recovery without going
      // through runtime.start. Do not report its predecessor's stale failure.
      if (controller.snapshot.error !== cause &&
        !(snapshot.error && player.snapshot.error === snapshot.error && player.snapshot.sessionId === snapshot.sessionId)) return;
      report(cause instanceof Error ? cause : new Error(String(cause)), cause);
    });
  });
  return {
    player,
    controller,
    start(item, source, position) {
      generation++;
      reportedError = undefined;
      const enriched: MediaItem = {
        ...item,
        sourceAddonId: source?.sourceAddonId ?? item.sourceAddonId,
        sourceName: source?.sourceName ?? item.sourceName,
        sourceFingerprint:
          typeof source?.raw.source_fingerprint === "string"
            ? source.raw.source_fingerprint
            : item.sourceFingerprint,
        sourceQuality: source?.quality ?? item.sourceQuality,
        sourceAudio: source?.audio ?? item.sourceAudio,
      };
      return controller.start({ item: enriched, source, position });
    },
    stop() {
      generation++;
      return controller.stop();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      monitor?.dispose();
      document.removeEventListener('visibilitychange', reconnect);
      window.removeEventListener('keydown', interaction);
      window.removeEventListener('pointerdown', interaction);
      generation++;
      unsubscribe();
      unsubscribeController();
      await controller.stop().catch(() => undefined);
      await player.dispose();
    },
  };
}
