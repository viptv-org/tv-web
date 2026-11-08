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
  private timelineOffset = 0;
  private timelineDuration: number | null = null;
  private seekTarget: number | null = null;
  private openGeneration = 0;
  private opening = false;
  private openingFailure: Error | undefined;

  constructor() {
    this.detach = nativeVideo.subscribe((event) => {
      const state = mapState(event.state);
      const nativePosition = Number(event.position) || 0;
      const nativeDuration = Number(event.duration) || 0;
      let positionSeconds = this.timelineOffset + nativePosition;
      const durationSeconds =
        this.timelineDuration ??
        (nativeDuration > 0 ? this.timelineOffset + nativeDuration : null);
      // A native seek clears the decoder before the new position is reported.
      // Hold the requested title time until the host acknowledges it.
      if (this.seekTarget !== null) {
        if (
          (state === "playing" || state === "paused") &&
          Math.abs(positionSeconds - this.seekTarget) <= 2.5
        ) {
          this.seekTarget = null;
        } else {
          positionSeconds = this.seekTarget;
        }
      }
      // Firmware may finish between one-second clock notifications. The
      // known VOD end is authoritative for the UI and completion observation.
      if (state === "ended" && this.latest.kind === "vod" && durationSeconds !== null && Number.isFinite(durationSeconds)) {
        this.seekTarget = null;
        positionSeconds = durationSeconds;
      }
      const bufferedRanges = (event.bufferedRanges ?? []).map(range => ({
        start: Math.max(0, this.timelineOffset + range.start),
        end: Math.min(durationSeconds ?? Infinity, this.timelineOffset + range.end),
      })).filter(range => range.end > range.start);
      this.latest = {
        ...this.latest,
        state,
        time: {
          positionSeconds,
          durationSeconds,
          bufferedRanges,
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
      if (this.opening && state === "error") {
        this.openingFailure = new Error(event.error || "Roku could not open this source.");
        return;
      }
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
    const generation = ++this.openGeneration;
    this.opening = true;
    this.openingFailure = undefined;
    this.timelineOffset = Number(request.timelineOffsetSeconds) || 0;
    this.timelineDuration =
      Number(request.timelineDurationSeconds) > 0
        ? Number(request.timelineDurationSeconds)
        : null;
    this.seekTarget = null;
    this.latest = {
      ...this.latest,
      state: "opening",
      kind: request.kind,
      error: null,
      time: {
        positionSeconds:
          this.timelineOffset + (Number(request.startAtSeconds) || 0),
        durationSeconds: this.timelineDuration,
        bufferedRanges: [],
      },
    };
    this.emit();
    try {
      await nativeVideo.init();
      await nativeVideo.load({
        streamUrl: request.url,
        paused: request.paused,
        captionsEnabled: request.preferredSubtitleLanguage !== undefined && request.textTrackId !== null,
      });
      if (generation !== this.openGeneration)
        throw new DOMException("Playback replaced", "AbortError");
      if (this.openingFailure) throw this.openingFailure;
    } finally {
      if (generation === this.openGeneration) this.opening = false;
    }
    if (request.kind !== "live" && Number(request.startAtSeconds) > 0)
      nativeVideo.seek(Number(request.startAtSeconds));
    if (request.paused) nativeVideo.pause();
  }

  async play(): Promise<void> {
    if (this.latest.state === "playing") return;
    const generation = this.openGeneration;
    this.opening = true;
    this.openingFailure = undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        let detach = () => {};
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          detach();
          if (error) reject(error); else resolve();
        };
        const timer = setTimeout(() => finish(new Error("Roku playback did not start.")), 15000);
        detach = nativeVideo.subscribe(event => {
          if (generation !== this.openGeneration) finish(new DOMException("Playback replaced", "AbortError"));
          else if (event.state === "error") finish(new Error(event.error || "Roku could not decode this source."));
          else if (event.state === "playing") finish();
        });
        if (settled) detach();
        else nativeVideo.play();
      });
    } finally {
      if (generation === this.openGeneration) this.opening = false;
    }
  }

  async pause(): Promise<void> {
    nativeVideo.pause();
  }

  async seek(positionSeconds: number): Promise<void> {
    const target = Math.max(0, Number(positionSeconds) || 0);
    this.seekTarget = target;
    this.latest = {
      ...this.latest,
      time: {
        ...this.latest.time,
        positionSeconds: target,
      },
    };
    this.emit();
    nativeVideo.seek(Math.max(0, target - this.timelineOffset));
  }

  async stop(): Promise<void> {
    this.openGeneration++;
    this.opening = false;
    this.openingFailure = undefined;
    await nativeVideo.destroy();
    this.timelineOffset = 0;
    this.timelineDuration = null;
    this.seekTarget = null;
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
