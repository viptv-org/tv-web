import type { CatalogPage, HomeSnapshot, LibraryImportStatus, LibraryMembershipSnapshot, ContinuationPage } from '../../vendor/engine/wire';
import type { RequestOptions } from './client-shared';
import { TvApiError, expectObject, throwIfAborted } from './client-shared';
import type { JsonValue, JsonObject } from './types';

export interface EngineBootstrap {
  readonly identity: { readonly profile_id: string | number | null; readonly account_id?: string | number };
  readonly home: HomeSnapshot | null;
  readonly library?: CatalogPage | null;
  readonly library_membership?: LibraryMembershipSnapshot | null;
  readonly library_import?: LibraryImportStatus | null;
  readonly continuation?: ContinuationPage | null;
  readonly subtitle_availability?: { readonly available: boolean; readonly provider_count: number } | null;
}
export type EngineRequest = (path: string, input?: { method?: string; body?: JsonObject }, options?: RequestOptions) => Promise<JsonValue>;

/** One host aggregate per profile scope, shared by Home, shelves, library membership and controls. */
export class EngineBootstrapCache {
  private current?: EngineBootstrap;
  private flight?: Promise<EngineBootstrap>;
  private scope = new AbortController();
  private generation = 0;
  private loadedAt = 0;
  constructor(private readonly request: EngineRequest) {}
  invalidate(): void {
    this.generation++;
    this.scope.abort(); this.scope = new AbortController();
    this.current = undefined; this.flight = undefined;
  }
  async get(options?: RequestOptions): Promise<EngineBootstrap> {
    throwIfAborted(options?.signal);
    if (this.current && Date.now() - this.loadedAt < 20_000) return this.current;
    if (!this.flight) {
      const generation = this.generation;
      const work = this.request('/api/v3/bootstrap', {}, { signal: this.scope.signal }).then(value => {
        if (generation !== this.generation) throw new DOMException('Scope changed', 'AbortError');
        const body = expectObject(value);
        if (!body.identity || typeof body.identity !== 'object') throw new TvApiError(502, 'The server returned an invalid startup response.');
        this.current = body as unknown as EngineBootstrap;
        this.loadedAt = Date.now();
        return this.current;
      }).finally(() => { if (this.flight === work) this.flight = undefined; });
      this.flight = work;
    }
    const work = this.flight;
    if (!options?.signal) return work;
    const signal = options.signal;
    return new Promise((resolve, reject) => {
      const abort = () => reject(new DOMException('Request cancelled', 'AbortError'));
      signal.addEventListener('abort', abort, { once: true });
      work.then(value => { if (!signal.aborted) resolve(value); }, reject)
        .finally(() => signal.removeEventListener('abort', abort));
      if (signal.aborted) abort();
    });
  }
}
