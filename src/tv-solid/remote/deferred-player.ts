import {
  IDLE_SNAPSHOT,
  PlayerOperationError,
  type OpenPlayerRequest,
  type Player,
  type PlayerCapabilities,
  type PlayerListener,
  type PlayerSnapshot,
} from "../../../vendor/video/src/types";

/** A player whose engine is fetched the first time a session opens.
 *
 * The TV UI holds one player for the life of the app, so the engine cannot be
 * created through a promise the UI has to await before it can render. Only
 * `open()` pays the load. Presentation, track and lifecycle commands that
 * arrive before a session exists have nothing to act on, so they resolve
 * without fetching an engine.
 */
export class DeferredPlayer implements Player {
  private engine?: Player;
  private pending?: Promise<Player>;
  private detach?: () => void;
  private latest: PlayerSnapshot = IDLE_SNAPSHOT;
  private operation = 0;
  private disposed = false;
  private readonly listeners = new Set<PlayerListener>();

  constructor(private readonly create: () => Promise<Player>) {}

  /** Resolve the engine once. A failed load is retried by the next command. */
  load(): Promise<Player> {
    if (this.disposed) return Promise.reject(new DOMException('Player disposed', 'AbortError'));
    this.pending ??= this.create().then(
      async (engine) => {
        if (this.disposed) {
          await engine.dispose();
          throw new DOMException('Player disposed', 'AbortError');
        }
        this.engine = engine;
        this.detach = engine.subscribe((snapshot) => {
          this.latest = snapshot;
          for (const listener of [...this.listeners]) listener(snapshot);
        });
        this.latest = engine.snapshot;
        return engine;
      },
      (cause) => {
        this.pending = undefined;
        throw cause;
      },
    );
    return this.pending;
  }

  get capabilities(): PlayerCapabilities {
    const engine = this.engine;
    if (!engine)
      throw new PlayerOperationError(
        "engine-unavailable",
        "This player's engine loads when a session opens; its capabilities are unknown before then.",
      );
    return engine.capabilities;
  }

  get snapshot(): PlayerSnapshot {
    return this.latest;
  }

  subscribe(listener: PlayerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async open(request: OpenPlayerRequest) {
    const operation = ++this.operation;
    const engine = await this.load();
    if (operation !== this.operation) return;
    await engine.open(request);
  }

  async play() {
    await this.engine?.play();
  }

  async pause() {
    await this.engine?.pause();
  }

  async seek(positionSeconds: number) {
    await this.engine?.seek(positionSeconds);
  }

  async selectAudioTrack(trackId: string) {
    await this.engine?.selectAudioTrack(trackId);
  }

  async selectTextTrack(trackId: string | null) {
    await this.engine?.selectTextTrack(trackId);
  }

  async stop() {
    this.operation++;
    await this.engine?.stop();
  }

  async dispose() {
    this.operation++;
    this.disposed = true;
    this.detach?.();
    this.detach = undefined;
    this.listeners.clear();
    await this.engine?.dispose();
    this.engine = undefined;
    this.pending = undefined;
  }

  async loadTextTracks() {
    await this.engine?.loadTextTracks?.();
  }

  async loadAudioTracks() {
    await this.engine?.loadAudioTracks?.();
  }

  async selectQuality(id: string) {
    await this.engine?.selectQuality?.(id);
  }

  async setVolume(level: number) {
    await this.engine?.setVolume?.(level);
  }

  async setMuted(muted: boolean) {
    await this.engine?.setMuted?.(muted);
  }

  async setPictureMode(mode: "fit" | "fill") {
    await this.engine?.setPictureMode?.(mode);
  }

  /** A preview decodes media, which needs the engine; an unopened session has none. */
  async preview(positionSeconds: number): Promise<Blob | null> {
    return (await this.engine?.preview?.(positionSeconds)) ?? null;
  }
}
