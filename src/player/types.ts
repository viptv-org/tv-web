/**
 * The only playback seam used by the shared TV UI.  It deliberately accepts an
 * already-selected delivery URL: choosing a source and choosing a server
 * delivery rung belong to the product/backend, never to a device adapter.
 */
export type PlayerPlatform = 'tizen' | 'vizio' | 'html5';
export type PlaybackKind = 'vod' | 'live';
export type PlayerState =
  | 'idle'
  | 'opening'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'stopped'
  | 'error'
  | 'disposed';

export type CapabilityResult = 'supported' | 'unsupported' | 'probe-required';

export interface PlayerCapabilities {
  readonly platform: PlayerPlatform;
  readonly engine: string;
  readonly directNative: CapabilityResult;
  readonly adaptiveStreaming: CapabilityResult;
  readonly drm: CapabilityResult;
  readonly canSetVolume?: boolean;
  readonly canPause: boolean;
  readonly canSeek: boolean;
  readonly canSelectAudioTrack: boolean;
  readonly canSelectTextTrack: boolean;
  readonly canDisableTextTrack: boolean;
  readonly canUseCookies: boolean;
  readonly canUseUserAgent: boolean;
  readonly limitations: readonly string[];
}

export interface PlayerTrack {
  readonly id: string;
  readonly label: string;
  readonly language?: string;
  readonly available: boolean;
}

export interface PlayerTracks {
  readonly audio: readonly PlayerTrack[];
  readonly text: readonly PlayerTrack[];
  readonly selectedAudioId: string | null;
  readonly selectedTextId: string | null;
}

export interface PlayerTime {
  readonly positionSeconds: number;
  /** Null represents a live or engine-unknown duration. */
  readonly durationSeconds: number | null;
}

export type PlayerErrorCode =
  | 'authorization-unsupported'
  | 'connection-failed'
  | 'engine-unavailable'
  | 'invalid-state'
  | 'prepare-failed'
  | 'seek-failed'
  | 'unsupported-operation'
  | 'unsupported-format'
  | 'unknown';

export interface PlayerFailure {
  readonly code: PlayerErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export interface PlayerDiagnostics {
  readonly engine: 'mediabunny' | 'native-html' | 'hls.js' | 'avplay';
  readonly transport: 'hls' | 'file';
  readonly networkTransport?: 'browser-proxy' | 'direct' | 'native-http';
  readonly videoCodec?: string;
  readonly audioCodec?: string;
  readonly width?: number;
  readonly height?: number;
  readonly fallbackReason?: string;
}

export interface PlayerSnapshot {
  readonly diagnostics?: PlayerDiagnostics;
  readonly volume?: { readonly level: number; readonly muted: boolean };
  readonly sessionId: number;
  readonly state: PlayerState;
  readonly kind: PlaybackKind | null;
  readonly time: PlayerTime;
  readonly tracks: PlayerTracks;
  readonly error: PlayerFailure | null;
}

export interface PlaybackAuthorization {
  /** A server-provided Cookie header. The Vizio/HTML adapter cannot apply it. */
  readonly cookie?: string;
  /** A server-provided User-Agent. The Vizio/HTML adapter cannot apply it. */
  readonly userAgent?: string;
}

export interface OpenPlayerRequest {
  /** The exact source/delivery result selected outside this adapter. */
  readonly url: string;
  readonly kind: PlaybackKind;
  /** Native timeline position within this delivered URL. */
  readonly startAtSeconds?: number;
  /** Explicit audio-only consumers may opt out of first-video-frame validation. */
  readonly expectedVideo?: boolean;
  /** Absolute title time represented by native position zero for managed output. */
  readonly timelineOffsetSeconds?: number;
  readonly paused?: boolean;
  readonly authorization?: PlaybackAuthorization;
}

export type PlayerListener = (snapshot: PlayerSnapshot) => void;

export interface Player {
  readonly capabilities: PlayerCapabilities;
  readonly snapshot: PlayerSnapshot;
  setVolume?(level: number): Promise<void>;
  setMuted?(muted: boolean): Promise<void>;
  open(request: OpenPlayerRequest): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionSeconds: number): Promise<void>;
  stop(): Promise<void>;
  dispose(): Promise<void>;
  selectAudioTrack(trackId: string): Promise<void>;
  selectTextTrack(trackId: string | null): Promise<void>;
  subscribe(listener: PlayerListener): () => void;
}

export class PlayerOperationError extends Error {
  readonly code: PlayerErrorCode;

  constructor(code: PlayerErrorCode, message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'PlayerOperationError';
    this.code = code;
  }

  toFailure(): PlayerFailure {
    return { code: this.code, message: this.message, cause: this.cause };
  }
}

export const EMPTY_TRACKS: PlayerTracks = {
  audio: [],
  text: [],
  selectedAudioId: null,
  selectedTextId: null,
};

export const IDLE_SNAPSHOT: PlayerSnapshot = {
  sessionId: 0,
  state: 'idle',
  kind: null,
  time: { positionSeconds: 0, durationSeconds: null },
  tracks: EMPTY_TRACKS,
  error: null,
};
