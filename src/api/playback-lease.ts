import type { PlaybackLease } from '../../vendor/core/typescript/wire';
import { TvApiError, type RequestOptions } from './client-shared';
const MAX_LEASE_MS = 60_000; // Backend v2 viewer lifetime; do not extend it for clock skew.

/** One active viewer's renewal/expiry lifetime; disposal never renews again. */
export function monitorPlaybackLease(initial: PlaybackLease, renew: (options: RequestOptions) => Promise<PlaybackLease>, failed: (error: unknown) => void) {
  let lease = initial, disposed = false;
  let renewTimer: ReturnType<typeof setTimeout>, expiryTimer: ReturnType<typeof setTimeout>;
  let flight: Promise<boolean> | undefined;
  const controller = new AbortController();
  const dispose = () => { disposed = true; clearTimeout(renewTimer); clearTimeout(expiryTimer); controller.abort(); };
  const expire = (error: unknown = new TvApiError(410, 'Playback could not be renewed before its session expired. Start playback again.', 'playback_expired')) => {
    if (disposed) return;
    dispose(); failed(error);
  };
  const schedule = () => {
    clearTimeout(renewTimer); clearTimeout(expiryTimer);
    const remaining = Math.max(0, Math.min(MAX_LEASE_MS, lease.expiresAt - Date.now()));
    expiryTimer = setTimeout(() => expire(), remaining);
    renewTimer = setTimeout(() => { void refresh(); }, Math.min(lease.renewAfterSeconds * 1000, remaining));
  };
  const refresh = (): Promise<boolean> => {
    if (disposed) return Promise.resolve(false);
    if (flight) return flight;
    clearTimeout(renewTimer);
    flight = (async () => {
      try {
        const next = await renew({ signal: controller.signal });
        if (disposed) return false;
        if (next.id !== lease.id || next.status !== 'ready'
          || next.session?.url !== lease.session?.url || next.session?.deliveryKind !== lease.session?.deliveryKind) {
          expire(new TvApiError(502, 'Playback delivery changed unexpectedly. Start playback again.', 'invalid_playback_response')); return false;
        }
        if (next.expiresAt <= Date.now()) {
          expire(); return false;
        }
        lease = next; schedule(); return true;
      } catch (error) {
        if (disposed) return false;
        if (!(error instanceof TvApiError) || (error.status > 0 && error.status < 500 && error.status !== 408)) {
          expire(error); return false;
        }
        if (Date.now() >= lease.expiresAt) { expire(); return false; }
        // Keep the independently armed expiry timer; retries cannot extend it.
        renewTimer = setTimeout(() => { void refresh(); }, Math.min(2000, lease.expiresAt - Date.now()));
        return false;
      } finally { flight = undefined; }
    })();
    return flight;
  };
  schedule();
  return { refresh, dispose, isActive: () => !disposed };
}
