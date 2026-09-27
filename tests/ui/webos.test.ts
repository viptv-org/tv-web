import { afterEach, expect, it, vi } from 'vitest';
import { exitWebos, installWebosLifecycle } from '../../src/tv-solid/webos';

afterEach(() => vi.restoreAllMocks());
it('stops on background, restores focus on relaunch and removes listeners', () => {
  const stop = vi.fn(), resume = vi.fn();
  vi.spyOn(window, 'focus').mockImplementation(() => {});
  const dispose = installWebosLifecycle(stop, resume);
  window.dispatchEvent(new Event('pagehide'));
  document.dispatchEvent(new Event('webOSRelaunch'));
  expect(stop).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(1);
  dispose();
  window.dispatchEvent(new Event('pagehide'));
  expect(stop).toHaveBeenCalledTimes(1);
});
it('uses the host exit behavior at the root', () => {
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  exitWebos();
  expect(close).toHaveBeenCalledTimes(1);
});
it('maps media keys once and leaves navigation to the shared focus manager', () => {
  const media = vi.fn();
  const dispose = installWebosLifecycle(() => {}, () => {}, media);
  window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 415 }));
  window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 415, repeat: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 461 }));
  expect(media.mock.calls).toEqual([['play']]);
  dispose();
});
