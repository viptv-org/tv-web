import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { monitorPlaybackLease } from '../../src/api/playback-lease';
import { TvApiError } from '../../src/api';
import type { PlaybackLease } from '../../vendor/core/typescript/wire';
const lease = (): PlaybackLease => ({ id: 'lease', status: 'ready', expiresAt: Date.now()+60_000, renewAfterSeconds: 20, session: null, errorCode: null, error: null });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('renews on the returned interval and re-arms expiry only after successful renewal', async () => {
  const renew = vi.fn(async () => lease()), failed = vi.fn();
  const monitor = monitorPlaybackLease(lease(), renew, failed);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(renew).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(40_000);
  expect(renew).toHaveBeenCalledTimes(3);
  expect(failed).not.toHaveBeenCalled();
  monitor.dispose();
  await vi.advanceTimersByTimeAsync(90_000);
  expect(renew).toHaveBeenCalledTimes(3);
});

it('does not extend authorization while the control connection is unavailable', async () => {
  const failed = vi.fn();
  const monitor = monitorPlaybackLease(lease(), async () => { throw new TvApiError(0, 'Offline', 'network'); }, failed);
  await vi.advanceTimersByTimeAsync(59_999);
  expect(failed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(failed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: 'playback_expired' }));
  expect(vi.getTimerCount()).toBe(0);
  monitor.dispose();
});

it('retires media immediately when authorization is refused', async () => {
  const error = new TvApiError(403, 'Authorization expired', 'authorization_expired'), failed = vi.fn();
  monitorPlaybackLease(lease(), async () => { throw error; }, failed);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(failed).toHaveBeenCalledExactlyOnceWith(error);
  expect(vi.getTimerCount()).toBe(0);
});

it('does not let a skewed client clock extend the protocol lease bound', async () => {
  const failed = vi.fn();
  monitorPlaybackLease({ ...lease(), expiresAt: Date.now()+3_600_000 }, async () => { throw new TvApiError(0, 'Offline', 'network'); }, failed);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(failed).toHaveBeenCalledTimes(1);
});

it('coalesces foreground validation and ignores late renewal after disposal', async () => {
  let resolve!: (value: PlaybackLease) => void;
  const renew = vi.fn(() => new Promise<PlaybackLease>(done => { resolve = done; })), failed = vi.fn();
  const monitor = monitorPlaybackLease(lease(), renew, failed);
  const first = monitor.refresh();
  expect(monitor.refresh()).toBe(first);
  expect(renew).toHaveBeenCalledTimes(1);
  monitor.dispose();
  resolve(lease());
  expect(await first).toBe(false);
  expect(failed).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('expiry interrupts a stalled renewal and emits only one terminal failure', async () => {
  const failed = vi.fn();
  monitorPlaybackLease(lease(), options => new Promise((_resolve, reject) => {
    options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }), failed);
  await vi.advanceTimersByTimeAsync(70_000);
  expect(failed).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
