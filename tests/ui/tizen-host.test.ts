import { afterEach, expect, it, vi } from 'vitest';
import { ensureTizenSurface, exitTizen, prepareTizenHost, registerTizenMediaKeys } from '../../src/tv-solid/platform/tizen-host';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('registers transport keys independently and leaves mandatory navigation keys alone', () => {
  const registerKey = vi.fn((name: string) => { if (name === 'MediaPlayPause') throw Error('Unsupported key'); });
  vi.stubGlobal('tizen', { tvinputdevice: { registerKey } });
  expect(registerTizenMediaKeys()).toEqual(['MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward']);
  expect(registerKey.mock.calls.map(([name]) => name)).toEqual(['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaRewind', 'MediaFastForward']);
});

it('prepares the exposed input boundary without loading the packaged SDK on hosted pages', async () => {
  const registerKey = vi.fn();
  vi.stubGlobal('tizen', { tvinputdevice: { registerKey } });
  await prepareTizenHost('webos');
  expect(registerKey).not.toHaveBeenCalled();
  await prepareTizenHost('tizen');
  expect(registerKey).toHaveBeenCalledTimes(6);
  expect(document.querySelector('script[src*="WEBAPIS"]')).toBeNull();
});

it('keeps hosted pages usable without a Tizen API', async () => {
  vi.stubGlobal('tizen', undefined);
  expect(registerTizenMediaKeys()).toEqual([]);
  await expect(prepareTizenHost('tizen')).resolves.toBeUndefined();
});

it('exits through the packaged application API and uses the web close boundary otherwise', () => {
  const exit = vi.fn();
  const close = vi.spyOn(window, 'close').mockImplementation(() => {});
  vi.stubGlobal('tizen', { application: { getCurrentApplication: () => ({ exit }) } });
  exitTizen();
  expect(exit).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  vi.stubGlobal('tizen', undefined);
  exitTizen();
  expect(close).toHaveBeenCalledTimes(1);
});

it('creates one native surface beneath shared controls and hides the HTML surface', () => {
  document.body.innerHTML = '<div id="video-layer"><video id="tv-video"></video></div><div id="app"></div>';
  ensureTizenSurface();
  ensureTizenSurface();
  expect(document.querySelectorAll('#video-layer object[type="application/avplayer"]')).toHaveLength(1);
  expect(document.getElementById('tv-video')?.style.display).toBe('none');
});
