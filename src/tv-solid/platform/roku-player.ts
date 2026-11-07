/**
 * Native SceneGraph Video backend for the shared playback controller.
 *
 * The shared RemotePlayback owns the lease, heartbeats, events and resume
 * policy. This adapter only translates its Player contract to the host's
 * native Video node.
 */
import {
  IDLE_SNAPSHOT,
  type OpenPlayerRequest,
  type Player,
  type PlayerCapabilities,
  type PlayerListener,
  type PlayerSnapshot,
  type PlayerState,
} from "../../../vendor/video/src/types";
import * as nativeVideo from "../../../roku/src/roku/video";

function mapState(value: string): PlayerState {
  switch (String(value || "")) {
    case "playing":
      return "playing";
    case "paused":
      return "paused";
    case "buffering":
      return "buffering";
    case "finished":
    case "ended":
      return "ended";
    case "error":
      return "error";
    case "stopped":
      return "stopped";
    case "loading":
      return "opening";
    default:
      return "ready";
  }
}

export class RokuPlayer implements Player {
  readonly capabilities: PlayerCapabilities = {
    platform: "html5",
    engine: "roku-native",
    directNative: "supported",
    adaptiveStreaming: "supported",
    drm: "unsupported",
    canPause: true,
    canSeek: true,
    canSelectAudioTrack: false,
    canSelectTextTrack: false,
    canDisableTextTrack: false,
    canUseCookies: false,
    canUseUserAgent: false,
    limitations: ["Native SceneGraph Video selects the stream's audio and subtitle tracks."],
  };

  private listeners = new Set<PlayerListener>();
  private latest: PlayerSnapshot = { ...IDLE_SNAPSHOT, sessionId: 1 };
  private detach: () => void;

  constructor() {
    this.detach = nativeVideo.subscribe((event) => {
      const state = mapState(event.state);
      this.latest = {
        ...this.latest,
        state,
        time: {
          positionSeconds: Number(event.position) || 0,
          durationSeconds: Number(event.duration) > 0 ? Number(event.duration) : null,
        },
        diagnostics:
          state === "playing"
            ? {
                engine: "native-html",
                transport: "hls",
                networkTransport: "native-http",
                firstFrameMs: 0,
              }
            : this.latest.diagnostics,
        error: event.error
          ? { code: "unknown", message: String(event.error) }
          : null,
      };
      this.emit();
    });
  }

  private emit() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.latest);
      } catch (error) {
        console.error("ROKU_PLAYER listener failure " + String(error));
      }
    });
  }

  get snapshot(): PlayerSnapshot {
    return this.latest;
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async open(request: OpenPlayerRequest): Promise<void> {
    this.latest = {
      ...this.latest,
      state: "opening",
      kind: request.kind,
      error: null,
      time: {
        positionSeconds: Number(request.startAtSeconds) || 0,
        durationSeconds: request.timelineDurationSeconds ?? null,
      },
    };
    this.emit();
    try {
      await nativeVideo.init();
      await nativeVideo.load({ streamUrl: request.url });
    } catch (error: any) {
      throw error;
    }
    if (request.startAtSeconds !== undefined)
      nativeVideo.seek(Number(request.startAtSeconds) || 0);
    if (request.paused) nativeVideo.pause();
    else nativeVideo.play();
  }

  async play(): Promise<void> {
    nativeVideo.play();
  }

  async pause(): Promise<void> {
    nativeVideo.pause();
  }

  async seek(positionSeconds: number): Promise<void> {
    nativeVideo.seek(positionSeconds);
  }

  async stop(): Promise<void> {
    await nativeVideo.destroy();
    this.latest = { ...this.latest, state: "stopped", error: null };
    this.emit();
  }

  async dispose(): Promise<void> {
    await this.stop();
    this.detach();
    this.listeners.clear();
    this.latest = { ...this.latest, state: "disposed" };
  }

  async selectAudioTrack(): Promise<void> {
    throw new Error("Native SceneGraph Video selects audio from the stream.");
  }

  async selectTextTrack(): Promise<void> {
    throw new Error("Native SceneGraph Video selects subtitles from the stream.");
  }
}

export function createRokuPlayer(): Player {
  return new RokuPlayer();
}
