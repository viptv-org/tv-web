import type { Card, SourcePage, TitleAction } from './types';

async function bounded<T>(operation: AbortController, run: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort!: () => void;
  const cancelled = new Promise<T>((_, reject) => {
    abort = () => reject(new DOMException('Preparation cancelled', 'AbortError'));
    operation.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => operation.abort(), 45000);
  });
  try {
    if (operation.signal.aborted) throw new DOMException('Preparation cancelled', 'AbortError');
    return await Promise.race([Promise.resolve().then(run), cancelled]);
  } finally { clearTimeout(timer);operation.signal.removeEventListener('abort', abort); }
}

export const episodeKey = (card: Card) => JSON.stringify([card.provider_id, card.identity, card.parent_identity, card.metadata_origin]);
export function sourceStartIds(page: SourcePage, memory: boolean): string[] {
  return memory ? page.source_reuse_supported === true ? page.source_reuse_ids ?? [] : []
    : page.automatic_source_ids ?? (page.best_match_id ? [page.best_match_id] : []);
}
/** Read only the server's readiness decision; never compare source ranking keys here. */
export function sourcePageReady(page: SourcePage, memory: boolean, preferredOnly = true): boolean {
  const ready = memory
    ? (!preferredOnly || page.source_reuse_preferred === true) && page.source_reuse_fully_matches === true
    : page.best_match_fully_matches === true;
  return ready && sourceStartIds(page, memory).some(id => page.streams.some(row => row.id === id));
}
export interface PreparedEpisode {
  card: Card;
  action: TitleAction;
  page: SourcePage;
  ids: string[];
  memory: boolean;
  created: number;
}
export interface EpisodePreparationState {
  status: 'idle' | 'loading' | 'ready' | 'none' | 'error';
  item?: Card;
  prepared?: PreparedEpisode;
  preparing: boolean;
}
/** Network lifetimes/cache only. Continuation and candidate IDs come from Rust. */
export class EpisodePreparation {
  private key?: string;
  private card?: Card;
  private generation = 0;
  private parent?: AbortSignal;
  private parentCancel = () => this.clear();
  private resolving?: AbortController;
  private preparing?: AbortController;
  private resolveFlight?: Promise<Card | undefined>;
  private prepareFlight?: Promise<void>;
  private attempted = false;
  state: EpisodePreparationState = { status: 'idle', preparing: false };
  constructor(
    private resolve: (card: Card, signal: AbortSignal) => Promise<{ status: string; item?: Card }>,
    private discover: (card: Card, signal: AbortSignal) => Promise<Omit<PreparedEpisode, 'created'>>,
    private changed: (state: EpisodePreparationState) => void,
    private now = () => Date.now(),
  ) {}
  private publish(patch: Partial<EpisodePreparationState>) {
    this.state = { ...this.state, ...patch };this.changed(this.state);
  }
  configure(key: string, card: Card, signal: AbortSignal): boolean {
    if (key === this.key && signal === this.parent) return false;
    this.clear();this.key = key;this.card = card;this.parent = signal;
    signal.addEventListener('abort', this.parentCancel, { once: true });
    return true;
  }
  clear() {
    if (!this.key && this.state.status === 'idle') return;
    this.parent?.removeEventListener('abort', this.parentCancel);
    this.parent = undefined;this.key = undefined;this.card = undefined;this.generation++;
    this.resolving?.abort();this.preparing?.abort();
    this.resolveFlight = undefined;this.prepareFlight = undefined;this.attempted = false;
    this.state = { status: 'idle', preparing: false };this.changed(this.state);
  }
  refresh(): Promise<Card | undefined> {
    if (this.resolveFlight) return this.resolveFlight;
    if (!this.card || this.parent?.aborted) return Promise.resolve(undefined);
    const generation = this.generation, operation = new AbortController(), card = this.card;
    this.resolving = operation;
    if (!this.state.item) this.publish({ status: 'loading' });
    const flight = Promise.resolve().then(async () => {
      try {
        const result = await bounded(operation, () => this.resolve(card, operation.signal));
        if (generation !== this.generation || operation.signal.aborted) return;
        if (!['Next', 'Pending', 'CaughtUp', 'Upcoming', 'Unavailable'].includes(result.status))
          throw new Error('The next episode is unavailable.');
        const item = result.status === 'Next' ? result.item : undefined;
        if (result.status === 'Next' && (!item?.identity.episode || item.identity.kind !== 'series' || !item.parent_identity))
          throw new Error('The next episode is unavailable.');
        const changed = this.state.item && (!item || episodeKey(this.state.item) !== episodeKey(item));
        if (changed) { this.preparing?.abort();this.attempted = false; }
        this.publish({ status: item ? 'ready' : result.status === 'Pending' ? 'loading' : 'none', item, ...(changed ? { prepared: undefined, preparing: false } : {}) });
        return item;
      } catch {
        if (generation === this.generation) this.publish({ status: 'error' });
        return undefined;
      } finally { if (this.resolveFlight === flight) this.resolveFlight = undefined; }
    });
    this.resolveFlight = flight;return flight;
  }
  prepare(): Promise<void> {
    if (this.state.prepared && this.now() - this.state.prepared.created >= 15 * 60 * 1000) {
      this.attempted = false;this.publish({ prepared: undefined });
    }
    if (this.prepareFlight) return this.prepareFlight;
    if (this.attempted || !this.state.item || this.parent?.aborted) return Promise.resolve();
    const card = this.state.item, generation = this.generation, operation = new AbortController();
    this.attempted = true;this.preparing = operation;this.publish({ preparing: true });
    const flight = Promise.resolve().then(async () => {
      try {
        const value = await bounded(operation, () => this.discover(card, operation.signal));
        if (generation !== this.generation || operation.signal.aborted || !this.state.item || episodeKey(this.state.item) !== episodeKey(card)) return;
        const ids = sourceStartIds(value.page, value.memory);
        if ((value.memory || value.page.best_match_fully_matches === true) &&
            ids.some(id => value.page.streams.some(source => source.id === id)) && episodeKey(value.card) === episodeKey(card))
          this.publish({ prepared: { ...value, created: this.now() } });
      } catch { /* Preparation is optional; Next owns fresh discovery/recovery. */ }
      finally {
        if (this.prepareFlight === flight) this.prepareFlight = undefined;
        if (generation === this.generation) this.publish({ preparing: false });
      }
    });
    this.prepareFlight = flight;return flight;
  }
  take(card: Card): PreparedEpisode | undefined {
    const value = this.state.prepared;
    if (!value || this.now() - value.created >= 15 * 60 * 1000 || episodeKey(value.card) !== episodeKey(card)) return;
    this.publish({ prepared: undefined });return value;
  }
}
