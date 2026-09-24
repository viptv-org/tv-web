import type { MediaItem, MediaSource, TvApi } from "../api";
import {
  createPlayer,
  deliveryCapabilitiesFor,
  PlaybackSessionController,
  type Player,
  type PlayerPlatform,
  type PlayerSnapshot,
} from "@viptv/video";

export type TvPlatform = "tizen" | "vizio" | "webos";

export interface SolidTVPlaybackRuntime {
  readonly player: Player;
  readonly controller: PlaybackSessionController<MediaItem, MediaSource>;
  start(
    item: MediaItem,
    source: MediaSource,
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
  const unsubscribe = player.subscribe((snapshot) => {
    onSnapshot(snapshot);
    void controller.recoverPlayback(snapshot).catch(() => undefined);
  });
  return {
    player,
    controller,
    start(item, source, position) {
      const enriched: MediaItem = {
        ...item,
        sourceAddonId: source.sourceAddonId ?? item.sourceAddonId,
        sourceName: source.sourceName ?? item.sourceName,
        sourceFingerprint:
          typeof source.raw.source_fingerprint === "string"
            ? source.raw.source_fingerprint
            : item.sourceFingerprint,
        sourceQuality: source.quality ?? item.sourceQuality,
        sourceAudio: source.audio ?? item.sourceAudio,
      };
      return controller.start({ item: enriched, source, position });
    },
    stop: () => controller.stop(),
    async dispose() {
      unsubscribe();
      await controller.stop().catch(() => undefined);
      await player.dispose();
    },
  };
}
