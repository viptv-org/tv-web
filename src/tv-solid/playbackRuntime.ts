import type { MediaItem, MediaSource, TvApi } from "../api";
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
  const report = (error: Error, identity: unknown = error) => {
    if (reportedError === identity) return;
    reportedError = identity;
    if (callbacks.onTerminalError) callbacks.onTerminalError(error, controller.snapshot);
    else console.error("TV playback recovery failed", error);
  };
  const unsubscribeController = controller.subscribe((state) => {
    if (!disposed) callbacks.onControllerState?.(state);
  });
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
      generation++;
      unsubscribe();
      unsubscribeController();
      await controller.stop().catch(() => undefined);
      await player.dispose();
    },
  };
}
