import type { PlaybackLease, PlaybackSession, PlaybackV2Request } from '../../vendor/core/typescript/wire';
import { normalizeResponse, throwIfAborted, TvApiError, type RequestOptions } from './client-shared';

type Control = (input: unknown, options?: RequestOptions) => Promise<unknown>;
const STARTUP_MS = 120_000;
const CLEANUP_MS = 5_000;

function wait(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 500);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Backend control only: this transport never follows a delivery URL. */
export class PlaybackV2Transport {
  private readonly startupDeadlines = new Map<string, number>();
  remainingStartup(id: string) { const deadline = this.startupDeadlines.get(id); this.startupDeadlines.delete(id); return deadline === undefined ? undefined : deadline - performance.now(); }

  constructor(private readonly control: Control, private readonly origin: string) {}

  private identity(value: unknown): string {
    const id = value && typeof value === 'object' && 'id' in value ? value.id : undefined;
    // Reuse Rust's lifecycle identifier validation even when the delivery
    // envelope is malformed, so an admitted lease can still be released.
    normalizeResponse('request', { operation: 'playbackV2Stop', id });
    return id as string;
  }

  private decode(value: unknown, expectedId?: string): PlaybackLease {
    const lease = normalizeResponse<PlaybackLease>('playbackV2', value, this.origin);
    if (expectedId !== undefined && lease.id !== expectedId)
      throw new TvApiError(502, 'The server returned a different playback session.', 'invalid_playback_response');
    return lease;
  }

  private ready(lease: PlaybackLease): PlaybackSession | undefined {
    if (lease.status === 'failed' || lease.status === 'expired' || lease.status === 'released')
      throw new TvApiError(409, lease.error ?? 'This playback session is no longer available. Start playback again.', lease.errorCode ?? 'playback_expired');
    if (lease.expiresAt <= Date.now())
      throw new TvApiError(410, 'This playback session has expired. Start playback again to reconnect.', 'playback_expired');
    if (lease.status === 'ready') {
      if (!lease.session) throw new TvApiError(502, 'The server returned an incomplete playback session.', 'invalid_playback_response');
      return lease.session;
    }
    return undefined;
  }

  /** The caller creates a new requestId per intentional start/replacement. */
  async start(request: PlaybackV2Request, options?: RequestOptions): Promise<PlaybackLease> {
    throwIfAborted(options?.signal);
    request = JSON.parse(JSON.stringify(request)) as PlaybackV2Request;
    normalizeResponse('request', { operation: 'playbackV2', playback: request });
    const controller = new AbortController();
    const abort = () => controller.abort();
    options?.signal?.addEventListener('abort', abort, { once: true });
    const deadline = performance.now() + STARTUP_MS;
    let renewAt = performance.now() + 20_000;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, STARTUP_MS);
    let id: string | undefined;
    let posted = false;
    try {
      posted = true;
      const response = await this.control({ operation: 'playbackV2', playback: request }, { signal: controller.signal });
      id = this.identity(response);
      let lease = this.decode(response, id);
      for (;;) {
        throwIfAborted(controller.signal);
        const session = this.ready(lease);
        if (session) {
          if (session.deliveryKind === 'direct' && (!request.client.canPlayDirect || request.forceGateway || request.conversion !== 'auto'))
            throw new TvApiError(502, 'The server returned a delivery this device did not request.', 'invalid_playback_response');
          this.startupDeadlines.set(id, deadline);
          return lease;
        }
        await wait(controller.signal);
        if (performance.now() >= renewAt) {
          lease = this.decode(await this.control({ operation: 'playbackV2Heartbeat', id }, { signal: controller.signal }), id);
          renewAt = performance.now() + 20_000;
        } else lease = await this.status(id, { signal: controller.signal });
      }
    } catch (error) {
      // Reconcile an ambiguous POST with the exact same idempotency body, then
      // release it. Cleanup uses its own short deadline, not the aborted caller.
      const definitivelyRefused = error instanceof TvApiError && error.status >= 400 && error.status < 500 && error.status !== 408;
      if (posted && (id || !definitivelyRefused)) await this.cleanup(id, request);
      if (timedOut) throw new TvApiError(408, 'Playback preparation timed out. Try again or choose another source.', 'playback_start_timeout');
      throwIfAborted(options?.signal);
      throw error;
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', abort);
    }
  }

  async status(id: string, options?: RequestOptions): Promise<PlaybackLease> {
    return this.decode(await this.control({ operation: 'playbackV2Status', id }, options), id);
  }

  /** Heartbeat responses are authoritative; callers must retire rejected media. */
  async renew(id: string, options?: RequestOptions): Promise<PlaybackLease> {
    const lease = this.decode(await this.control({ operation: 'playbackV2Heartbeat', id }, options), id);
    if (!this.ready(lease)) throw new TvApiError(409, 'Playback is still preparing. Wait for a ready session before resuming.', 'playback_not_ready');
    return lease;
  }

  async stop(id: string, options?: RequestOptions): Promise<void> {
    this.startupDeadlines.delete(id);
    await this.control({ operation: 'playbackV2Stop', id }, options);
  }

  private async cleanup(id: string | undefined, request: PlaybackV2Request): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLEANUP_MS);
    try {
      if (!id) id = this.identity(await this.control({ operation: 'playbackV2', playback: request }, { signal: controller.signal }));
      await this.stop(id, { signal: controller.signal });
    } catch { /* The independently expiring backend/gateway lease is the final bound. */ }
    finally { clearTimeout(timer); }
  }
}
