import { SessionPlayer } from './session';
import {
  type OpenPlayerRequest,
  PlayerOperationError,
  type PlayerCapabilities,
  type PlayerTrack,
  type PlayerTracks,
} from './types';

export interface HtmlTextTrack {
  readonly kind: string;
  readonly label: string;
  readonly language: string;
  mode: 'disabled' | 'hidden' | 'showing';
}

export interface HtmlMediaLike {
  src: string;
  currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly error: { readonly code: number; readonly message?: string } | null;
  readonly textTracks?: ArrayLike<HtmlTextTrack>;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  removeAttribute?(name: string): void;
}

export const VIZIO_HTML5_CAPABILITIES: PlayerCapabilities = {
  platform: 'vizio',
  engine: 'HTMLMediaElement',
  directNative: 'probe-required',
  adaptiveStreaming: 'probe-required',
  drm: 'probe-required',
  canPause: true,
  canSeek: true,
  canSelectAudioTrack: false,
  canSelectTextTrack: true,
  canDisableTextTrack: true,
  canUseCookies: false,
  canUseUserAgent: false,
  limitations: [
    'No public Vizio playback capability table is assumed; test the exact TV, firmware, source and duration.',
    'This adapter does not set request headers, cookies or audio tracks. Supply a backend-compatible signed/direct URL.',
    'Adaptive, DRM, seek and subtitle behavior are runtime probes, not platform-wide claims.',
  ],
};

/**
 * Vizio SmartCast uses the browser-native path. It owns no delivery fallback:
 * the backend selects direct/copy/remux/audio/full transcode before this URL is
 * handed to the adapter and records the selected rung.
 */
export class VizioHtml5Adapter extends SessionPlayer {
  readonly capabilities = VIZIO_HTML5_CAPABILITIES;
  private readonly handlers: Record<string, () => void>;
  private activeKind: OpenPlayerRequest['kind'] | null = null;
  private timelineOffsetSeconds = 0;
  private pendingOpen: { readonly sessionId: number; readonly cancel: () => void } | null = null;

  constructor(private readonly media: HtmlMediaLike) {
    super();
    this.handlers = {
      loadedmetadata: () => this.onMetadata(),
      canplay: () => this.onCanPlay(),
      play: () => this.onPlay(),
      pause: () => this.onPause(),
      waiting: () => this.onWaiting(),
      playing: () => this.onPlay(),
      timeupdate: () => this.onTimeUpdate(),
      ended: () => this.onEnded(),
      error: () => this.onError(),
    };
    for (const [event, handler] of Object.entries(this.handlers)) this.media.addEventListener(event, handler);
  }

  open(request: OpenPlayerRequest): Promise<void> {
    if (request.authorization?.cookie || request.authorization?.userAgent) {
      return Promise.reject(new PlayerOperationError(
        'unsupported-operation',
        'The Vizio HTML player cannot attach credentials. Use a backend-compatible URL instead.',
      ));
    }
    this.cancelPendingOpen();
    this.invalidateSession();
    const sessionId = this.startSession(request.kind);
    this.activeKind = request.kind;
    this.timelineOffsetSeconds = nonNegative(request.timelineOffsetSeconds ?? 0);
    this.media.pause();
    this.media.src = request.url;
    this.media.load();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.media.removeEventListener('loadedmetadata', onReady);
        this.media.removeEventListener('error', onFailure);
      };
      const onReady = () => {
        if (!this.isCurrent(sessionId)) {
          cleanup();
          resolve();
          return;
        }
        cleanup();
        this.pendingOpen = null;
        const target = boundedPosition(request.startAtSeconds ?? 0, knownDuration(this.media.duration));
        try { this.media.currentTime = target; } catch { /* browser may delay seek until a later ready state */ }
        this.update(sessionId, {
          state: request.paused ? 'paused' : 'ready',
          time: { positionSeconds: this.timelineOffsetSeconds + target, durationSeconds: knownDuration(this.media.duration) },
          tracks: tracksFromMedia(this.media),
          error: null,
        });
        if (request.paused) {
          resolve();
          return;
        }
        this.media.play().then(
          () => { if (this.isCurrent(sessionId)) resolve(); },
          (cause) => {
            if (!this.isCurrent(sessionId)) return resolve();
            const error = new PlayerOperationError('prepare-failed', 'The browser could not start the selected source.', cause);
            this.fail(sessionId, error.toFailure());
            reject(error);
          },
        );
      };
      const onFailure = () => {
        if (!this.isCurrent(sessionId)) {
          cleanup();
          resolve();
          return;
        }
        cleanup();
        const error = mediaError(this.media, 'prepare-failed');
        this.fail(sessionId, error.toFailure());
        this.pendingOpen = null;
        reject(error);
      };
      // Metadata is the earliest portable point at which the resume target and
      // finite VOD duration are meaningful. Old TV browsers need not emit the
      // later canplay event before play() is allowed.
      this.media.addEventListener('loadedmetadata', onReady);
      this.media.addEventListener('error', onFailure);
      this.pendingOpen = { sessionId, cancel: () => { cleanup(); resolve(); } };
    });
  }

  async play(): Promise<void> {
    const sessionId = this.activeSessionOrThrow();
    try {
      await this.media.play();
      this.update(sessionId, { state: 'playing', error: null });
    } catch (cause) {
      const error = new PlayerOperationError('prepare-failed', 'The browser could not resume playback.', cause);
      this.fail(sessionId, error.toFailure());
      throw error;
    }
  }

  async pause(): Promise<void> {
    const sessionId = this.activeSessionOrThrow();
    this.media.pause();
    this.update(sessionId, { state: 'paused' });
  }

  async seek(positionSeconds: number): Promise<void> {
    const sessionId = this.activeSessionOrThrow();
    if (this.activeKind === 'live') throw new PlayerOperationError('unsupported-operation', 'Live playback does not expose VOD seeking.');
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) throw new PlayerOperationError('seek-failed', 'Seek position must be a non-negative number.');
    try {
      const target = boundedPosition(positionSeconds - this.timelineOffsetSeconds, knownDuration(this.media.duration));
      this.media.currentTime = target;
      this.update(sessionId, { time: { positionSeconds: this.timelineOffsetSeconds + target, durationSeconds: knownDuration(this.media.duration) } });
    } catch (cause) {
      const error = new PlayerOperationError('seek-failed', 'The browser could not seek the selected source.', cause);
      this.fail(sessionId, error.toFailure());
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.cancelPendingOpen();
    this.invalidateSession();
    this.activeKind = null;
    this.media.pause();
    this.media.removeAttribute?.('src');
    this.media.load();
    this.terminal('stopped');
  }

  async dispose(): Promise<void> {
    await this.stop();
    for (const [event, handler] of Object.entries(this.handlers)) this.media.removeEventListener(event, handler);
    this.terminal('disposed');
  }

  async selectAudioTrack(_: string): Promise<void> {
    throw new PlayerOperationError('unsupported-operation', 'The Vizio HTML player does not expose audio-track selection.');
  }

  async selectTextTrack(trackId: string | null): Promise<void> {
    const sessionId = this.activeSessionOrThrow();
    const textTracks = listTextTracks(this.media);
    if (trackId === null) {
      for (const track of textTracks) track.mode = 'disabled';
      this.update(sessionId, { tracks: { ...this.snapshot.tracks, selectedTextId: null } });
      return;
    }
    const selected = textTracks.find((_, index) => `text:${index}` === trackId);
    if (!selected) throw new PlayerOperationError('unsupported-operation', `Subtitle track ${trackId} is not available.`);
    for (const track of textTracks) track.mode = track === selected ? 'showing' : 'disabled';
    this.update(sessionId, { tracks: { ...tracksFromMedia(this.media), selectedTextId: trackId } });
  }

  private onMetadata(): void {
    const sessionId = this.snapshot.sessionId;
    if (!this.isCurrent(sessionId)) return;
    this.update(sessionId, { time: { positionSeconds: this.timelineOffsetSeconds + this.media.currentTime, durationSeconds: knownDuration(this.media.duration) }, tracks: tracksFromMedia(this.media) });
  }

  private onCanPlay(): void { this.onMetadata(); }
  private onPlay(): void {
    const sessionId = this.snapshot.sessionId;
    this.update(sessionId, { state: 'playing', error: null });
  }
  private onPause(): void {
    const sessionId = this.snapshot.sessionId;
    if (!this.media.ended) this.update(sessionId, { state: 'paused' });
  }
  private onWaiting(): void {
    const sessionId = this.snapshot.sessionId;
    this.update(sessionId, { state: 'buffering' });
  }
  private onTimeUpdate(): void {
    const sessionId = this.snapshot.sessionId;
    this.update(sessionId, { time: { positionSeconds: this.timelineOffsetSeconds + this.media.currentTime, durationSeconds: knownDuration(this.media.duration) } });
  }
  private onEnded(): void {
    const sessionId = this.snapshot.sessionId;
    this.update(sessionId, { state: 'ended' });
  }
  private onError(): void {
    const sessionId = this.snapshot.sessionId;
    this.fail(sessionId, mediaError(this.media, 'connection-failed').toFailure());
  }

  private activeSessionOrThrow(): number {
    if (this.snapshot.sessionId === 0 || !this.isCurrent(this.snapshot.sessionId)) {
      throw new PlayerOperationError('invalid-state', 'No active playback session.');
    }
    return this.snapshot.sessionId;
  }

  private cancelPendingOpen(): void {
    if (this.pendingOpen) {
      this.pendingOpen.cancel();
      this.pendingOpen = null;
    }
  }
}

function listTextTracks(media: HtmlMediaLike): HtmlTextTrack[] {
  if (!media.textTracks) return [];
  return Array.from({ length: media.textTracks.length }, (_, index) => media.textTracks![index]);
}

function tracksFromMedia(media: HtmlMediaLike): PlayerTracks {
  const text = listTextTracks(media)
    .filter((track) => track.kind === 'captions' || track.kind === 'subtitles')
    .map((track, index): PlayerTrack => ({
      id: `text:${index}`,
      label: track.label || `Subtitle ${index + 1}`,
      language: track.language || undefined,
      available: true,
    }));
  const selectedTextId = listTextTracks(media).findIndex((track) => track.mode === 'showing');
  return { audio: [], text, selectedAudioId: null, selectedTextId: selectedTextId < 0 ? null : `text:${selectedTextId}` };
}

function knownDuration(duration: number): number | null {
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function boundedPosition(position: number, duration: number | null): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  return duration === null ? position : Math.min(position, duration);
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function mediaError(media: HtmlMediaLike, code: 'prepare-failed' | 'connection-failed'): PlayerOperationError {
  const message = media.error?.message ?? `HTML media error ${media.error?.code ?? 'unknown'}.`;
  return new PlayerOperationError(code, message, media.error);
}
