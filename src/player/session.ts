import type {
  MediaItem,
  MediaSource,
  PlaybackCapabilities,
  PlaybackSession,
  PlaybackStart,
  TvApi,
} from '../api';
import {
  EMPTY_TRACKS,
  IDLE_SNAPSHOT,
  type PlaybackKind,
  type Player,
  type PlayerFailure,
  type PlayerListener,
  type PlayerSnapshot,
  type PlayerState,
  type PlayerTime,
  type PlayerTracks,
} from './types';

/** Internal session gate: adapters call `isCurrent` from every async callback. */
export abstract class SessionPlayer implements Player {
  abstract readonly capabilities: Player['capabilities'];

  private listeners = new Set<PlayerListener>();
  private currentSession = 0;
  private nextSession = 0;
  private currentSnapshot: PlayerSnapshot = IDLE_SNAPSHOT;

  get snapshot(): PlayerSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  protected startSession(kind: PlaybackKind): number {
    const sessionId = ++this.nextSession;
    this.currentSession = sessionId;
    this.publish({
      sessionId,
      state: 'opening',
      kind,
      time: { positionSeconds: 0, durationSeconds: null },
      tracks: EMPTY_TRACKS,
      error: null,
    });
    return sessionId;
  }

  protected isCurrent(sessionId: number): boolean {
    return this.currentSession === sessionId;
  }

  /** Makes every previous callback inert. */
  protected invalidateSession(): void {
    this.currentSession = 0;
  }

  protected update(sessionId: number, patch: {
    state?: PlayerState;
    time?: PlayerTime;
    tracks?: PlayerTracks;
    error?: PlayerFailure | null;
  }): void {
    if (!this.isCurrent(sessionId)) return;
    this.publish({ ...this.currentSnapshot, ...patch });
  }

  protected terminal(state: Extract<PlayerState, 'stopped' | 'disposed'>): void {
    const sessionId = ++this.nextSession;
    this.currentSession = 0;
    this.publish({
      sessionId,
      state,
      kind: null,
      time: { positionSeconds: 0, durationSeconds: null },
      tracks: EMPTY_TRACKS,
      error: null,
    });
  }

  protected fail(sessionId: number, error: PlayerFailure): void {
    this.update(sessionId, { state: 'error', error });
  }

  private publish(snapshot: PlayerSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  abstract open(request: Parameters<Player['open']>[0]): Promise<void>;
  abstract play(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract seek(positionSeconds: number): Promise<void>;
  abstract stop(): Promise<void>;
  abstract dispose(): Promise<void>;
  abstract selectAudioTrack(trackId: string): Promise<void>;
  abstract selectTextTrack(trackId: string | null): Promise<void>;
}

/** A source is always explicit for ordinary VOD and Resume flows. */
export interface SessionStartIntent {
  readonly item: MediaItem;
  readonly source?: MediaSource;
  readonly position?: number;
}

export interface TrackReplacement {
  readonly audioTrackIndex?: number;
  readonly subtitleTrackIndex?: number;
  readonly subtitlesOff?: boolean;
}

export interface PlaybackControllerActive {
  readonly intent: SessionStartIntent;
  readonly session: PlaybackSession;
  readonly request: PlaybackStart;
}

export type PlaybackControllerState = 'idle' | 'opening' | 'playing' | 'replacing' | 'preparing-next' | 'stopped' | 'error';

export interface PlaybackControllerSnapshot {
  readonly state: PlaybackControllerState;
  readonly active: PlaybackControllerActive | null;
  readonly error: Error | null;
}

export type PlaybackControllerListener = (snapshot: PlaybackControllerSnapshot) => void;

export interface PlaybackSessionControllerOptions {
  readonly player: Player;
  readonly backend: Pick<TvApi, 'startPlayback' | 'stopPlayback'>;
  readonly capabilities: PlaybackCapabilities | (() => Promise<PlaybackCapabilities>);
}

/**
 * Coordinates the server's opaque playback session with one device adapter.
 * It never discovers or ranks a replacement source. On managed seeks/tracks it
 * starts one replacement for the same selected source and restores the old
 * session if the device cannot open the candidate.
 */
export class PlaybackSessionController {
  private readonly listeners = new Set<PlaybackControllerListener>();
  private current: PlaybackControllerActive | null = null;
  private nextGeneration = 0;
  private operationGeneration = 0;
  /** The one next-operation Back is allowed to restore after adapter open. */
  private restoreRequestedOperation: number | null = null;
  private currentSnapshot: PlaybackControllerSnapshot = { state: 'idle', active: null, error: null };

  constructor(private readonly options: PlaybackSessionControllerOptions) {}

  get snapshot(): PlaybackControllerSnapshot {
    return this.currentSnapshot;
  }

  subscribe(listener: PlaybackControllerListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  async start(intent: SessionStartIntent): Promise<PlaybackControllerActive> {
    this.cancelNext(false);
    const operation = ++this.operationGeneration;
    this.publish({ state: this.current ? 'replacing' : 'opening', active: this.current, error: null });
    try {
      const capabilities = await this.resolveCapabilities();
      if (operation !== this.operationGeneration) return this.cancelledResult();
      const request = playbackRequest(intent, capabilities, intent.position ?? 0);
      return await this.transition(intent, request, this.current, () => operation === this.operationGeneration);
    } catch (error) {
      if (operation !== this.operationGeneration) return this.cancelledResult();
      this.publish({ state: this.current ? 'playing' : 'error', active: this.current,
        error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  async seek(position: number): Promise<void> {
    this.cancelNext(false);
    const operation = ++this.operationGeneration;
    const active = this.requireActive();
    if (!Number.isFinite(position) || position < 0) throw new Error('Seek position must be a non-negative number.');
    if (active.session.mode === 'direct') {
      await this.options.player.seek(position);
      return;
    }
    const request = { ...active.request, position };
    await this.transition({ ...active.intent, position }, request, active, () => operation === this.operationGeneration);
  }

  async replaceTracks(selection: TrackReplacement): Promise<void> {
    this.cancelNext(false);
    const operation = ++this.operationGeneration;
    const active = this.requireActive();
    const position = this.options.player.snapshot.time.positionSeconds;
    const request: PlaybackStart = { ...active.request, position, ...selection };
    await this.transition({ ...active.intent, position }, request, active, () => operation === this.operationGeneration);
  }

  /**
   * The resolver is supplied by the UI/backend continuation flow. It must
   * provide the bounded next source already chosen by that flow; this module
   * never falls through to a different provider.
   */
  async prepareNext(resolveNext: () => Promise<SessionStartIntent | null>): Promise<void> {
    const active = this.requireActive();
    const generation = ++this.nextGeneration;
    const operation = ++this.operationGeneration;
    this.restoreRequestedOperation = null;
    this.publish({ state: 'preparing-next', active, error: null });
    try {
      const next = await resolveNext();
      if (generation !== this.nextGeneration) return;
      if (!next) {
        this.publish({ state: playerState(this.options.player), active: this.current, error: null });
        return;
      }
      const capabilities = await this.resolveCapabilities();
      if (generation !== this.nextGeneration || operation !== this.operationGeneration) return;
      const request = playbackRequest(next, capabilities, next.position ?? 0);
      await this.transition(
        next,
        request,
        active,
        () => generation === this.nextGeneration && operation === this.operationGeneration,
        () => this.restoreRequestedOperation === operation,
      );
    } catch (cause) {
      if (generation !== this.nextGeneration) return;
      const error = asError(cause);
      this.publish({ state: 'error', active: this.current, error });
      throw error;
    } finally {
      if (this.restoreRequestedOperation === operation) this.restoreRequestedOperation = null;
    }
  }

  /**
   * Back requests restoration if AVPlay/HTML media has already switched to a
   * next candidate. Internal replacement and stop callers pass false: their
   * newer operation owns the adapter and an old operation must stay inert.
   */
  cancelNext(restoreOutgoing = true): void {
    if (!restoreOutgoing) this.restoreRequestedOperation = null;
    else if (this.currentSnapshot.state === 'preparing-next' || this.currentSnapshot.state === 'replacing') {
      this.restoreRequestedOperation = this.operationGeneration;
    }
    this.nextGeneration += 1;
    if (this.currentSnapshot.state === 'preparing-next' || this.currentSnapshot.state === 'replacing') {
      this.operationGeneration += 1;
      this.publish({ state: playerState(this.options.player), active: this.current, error: null });
    }
  }

  async stop(): Promise<void> {
    this.cancelNext(false);
    this.operationGeneration += 1;
    const active = this.current;
    this.current = null;
    await this.options.player.stop();
    if (active) await this.options.backend.stopPlayback(active.session.id);
    this.publish({ state: 'stopped', active: null, error: null });
  }

  private async transition(
    intent: SessionStartIntent,
    request: PlaybackStart,
    previous: PlaybackControllerActive | null,
    stillWanted: () => boolean = () => true,
    restoreOnCancellation: () => boolean = () => false,
  ): Promise<PlaybackControllerActive> {
    const wasPaused = this.options.player.snapshot.state === 'paused';
    const previousPosition = this.options.player.snapshot.time.positionSeconds;
    this.publish({ state: previous ? 'replacing' : 'opening', active: previous, error: null });
    let session: PlaybackSession;
    try {
      session = await this.options.backend.startPlayback(request);
    } catch (cause) {
      if (!stillWanted()) return this.cancelledResult();
      const error = asError(cause);
      this.publish({ state: 'error', active: this.current, error });
      throw error;
    }
    if (!stillWanted()) {
      await this.options.backend.stopPlayback(session.id);
      return this.cancelledResult();
    }
    const candidate: PlaybackControllerActive = { intent, request, session };
    try {
      await this.options.player.open(adapterRequest(session, itemKind(intent.item), request.position ?? 0, wasPaused));
      if (!stillWanted()) {
        await this.options.backend.stopPlayback(session.id);
        if (restoreOnCancellation()) {
          await this.restore(previous, previousPosition, wasPaused, restoreOnCancellation);
        }
        return this.cancelledResult();
      }
      this.current = candidate;
      // A cleanup failure leaks a backend session but must never undo a
      // candidate already proven playable on the device.
      if (previous) await this.options.backend.stopPlayback(previous.session.id).catch(() => undefined);
      this.publish({ state: playerState(this.options.player), active: candidate, error: null });
      return candidate;
    } catch (cause) {
      const error = asError(cause);
      await this.options.backend.stopPlayback(session.id).catch(() => undefined);
      const shouldRestore = () => stillWanted() || restoreOnCancellation();
      if (shouldRestore()) {
        try {
          await this.restore(previous, previousPosition, wasPaused, shouldRestore);
        } catch {
          this.current = null;
          await this.options.player.stop().catch(() => undefined);
          if (previous) await this.options.backend.stopPlayback(previous.session.id).catch(() => undefined);
        }
      }
      if (!stillWanted()) return this.cancelledResult();
      this.publish({ state: 'error', active: this.current, error });
      throw error;
    }
  }

  private async restore(
    previous: PlaybackControllerActive | null,
    position: number,
    paused: boolean,
    stillRestore: () => boolean = () => true,
  ): Promise<void> {
    if (!previous) {
      this.current = null;
      return;
    }
    if (!stillRestore()) return;
    await this.options.player.open(adapterRequest(previous.session, itemKind(previous.intent.item), position, paused));
    if (!stillRestore()) return;
    this.current = previous;
    this.publish({ state: playerState(this.options.player), active: previous, error: null });
  }

  /** An invalidated UI operation either yields the current owner or AbortError. */
  private cancelledResult(): PlaybackControllerActive {
    if (this.current) {
      this.publish({ state: playerState(this.options.player), active: this.current, error: null });
      return this.current;
    }
    throw new DOMException('Playback operation was cancelled.', 'AbortError');
  }

  private async resolveCapabilities(): Promise<PlaybackCapabilities> {
    return typeof this.options.capabilities === 'function'
      ? this.options.capabilities() : this.options.capabilities;
  }

  private requireActive(): PlaybackControllerActive {
    if (!this.current) throw new Error('No active playback session.');
    return this.current;
  }

  private publish(snapshot: PlaybackControllerSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}

/** Resume must never select a similarly named source from another provider. */
export function exactResumeSource(item: MediaItem, sources: readonly MediaSource[]): MediaSource | undefined {
  if (!item.sourceAddonId || !item.sourceFingerprint) return undefined;
  return sources.find((source) =>
    source.sourceAddonId === item.sourceAddonId
    && source.raw.source_fingerprint === item.sourceFingerprint,
  );
}

function playbackRequest(intent: SessionStartIntent, capabilities: PlaybackCapabilities, position: number): PlaybackStart {
  if (intent.item.type === 'live') return { channelId: intent.item.id, position, capabilities };
  if (!intent.source) throw new Error('VOD playback requires an explicit source.');
  return { streamId: intent.source.id, position, capabilities };
}

function adapterRequest(session: PlaybackSession, kind: PlaybackKind, position: number, paused: boolean): Parameters<Player['open']>[0] {
  const direct = session.mode === 'direct';
  const deliveryStart = direct ? 0 : Math.max(0, session.position);
  return {
    url: session.url,
    kind,
    startAtSeconds: direct ? position : Math.max(0, position - deliveryStart),
    timelineOffsetSeconds: deliveryStart,
    paused,
  };
}

function itemKind(item: MediaItem): PlaybackKind {
  return item.type === 'live' ? 'live' : 'vod';
}

function playerState(player: Player): Extract<PlaybackControllerState, 'playing' | 'opening' | 'error'> {
  return player.snapshot.state === 'paused' ? 'playing' : player.snapshot.state === 'error' ? 'error' : 'playing';
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error('Playback operation failed.');
}
