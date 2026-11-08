import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

async function mediaKey(page: Page, key: 'MediaPlay' | 'MediaPause' | 'MediaStop') {
  await page.evaluate(key => {
    const keyCode = { MediaPlay: 415, MediaPause: 19, MediaStop: 413 }[key];
    for (const type of ['keydown', 'keyup'])
      window.dispatchEvent(new KeyboardEvent(type, { key, keyCode, bubbles: true }));
  }, key);
}

for (const profile of ['web', 'webos', 'vizio', 'tizen', 'legacy-webos']) {
  const platform = profile === 'legacy-webos' ? 'webos' : profile;
  test(`${profile} decodes HLS video and presents the server-selected WebVTT rendition`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!, { media: true, captionTracks: true, captionMedia: true });
    if (profile === 'legacy-webos') await page.addInitScript(() => {
      Object.defineProperty(Array.prototype, 'at', { value: undefined, configurable: true, writable: true });
      Object.defineProperty(Object, 'fromEntries', { value: undefined, configurable: true, writable: true });
    });
    await page.goto(`/tv/?platform=${platform}&focusdebug=1`);
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-tv-sources', '8');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('video').evaluate(video => ({
      width: (video as HTMLVideoElement).videoWidth,
      decoded: (video as HTMLVideoElement).getVideoPlaybackQuality().totalVideoFrames > 0,
    }))).toEqual({ width: 160, decoded: true });
    await expect.poll(() => page.locator('video').evaluate(video =>
      Array.from((video as HTMLVideoElement).textTracks).some(track => track.mode === 'showing' &&
        Array.from(track.activeCues ?? []).some(cue => (cue as VTTCue).text === 'Caption pipeline check')),
    )).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-tv-overlay', '');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await mediaKey(page, 'MediaPause');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
    const position = await page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime);
    await page.waitForTimeout(150);
    expect(await page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeCloseTo(position, 1);
    await mediaKey(page, 'MediaPlay');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(position + 0.1);
    await mediaKey(page, 'MediaStop');
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).getAttribute('src') ?? '')).toBe('');
  });
}

test('Tizen SDK boundary keeps native output below controls and preserves paused subtitle replacement', async ({ page, baseURL }) => {
  await installRemoteBackend(page, baseURL!, { media: true, captionTracks: true, captionMedia: true });
  await page.addInitScript(() => {
    let state = 'NONE', clock = 0, listener: any = {};
    const calls: { play: number; pause: number; subtitles: number[]; silent: boolean[] } = { play: 0, pause: 0, subtitles: [], silent: [] };
    const avplay = {
      open() {
        if (!document.querySelector('#video-layer object[type="application/avplayer"]')) throw Error('Native surface missing');
        state = 'IDLE'; clock = 0;
      },
      close() { state = 'NONE'; }, stop() { state = 'IDLE'; },
      setListener(value: any) { listener = value; },
      prepareAsync(ready: () => void) { state = 'READY'; setTimeout(ready, 0); },
      play() {
        if (!['READY', 'PAUSED'].includes(state)) throw Error(`Invalid SDK play in ${state}`);
        state = 'PLAYING'; calls.play++; clock = 1000;
        const current = listener; setTimeout(() => current.oncurrentplaytime?.(clock), 0);
      },
      pause() {
        if (state !== 'PLAYING') throw Error(`Invalid SDK pause in ${state}`);
        state = 'PAUSED'; calls.pause++;
      },
      seekTo(ms: number, done: () => void) { clock = ms; done(); },
      getCurrentTime() { return clock; }, getDuration() { return 5000; },
      getTotalTrackInfo() { return [{ index: 8, type: 'TEXT', extra_info: '{"track_lang":"en"}' }]; },
      setSelectTrack(_kind: string, index: number) {
        if (!['PLAYING', 'PAUSED'].includes(state)) throw Error('TEXT selection before playback');
        calls.subtitles.push(index);
      },
      setSilentSubtitle(value: boolean) { calls.silent.push(value); },
      setDisplayRect() {},
    };
    Object.assign(window, { webapis: { avplay }, __tizenBoundaryCalls: calls });
  });
  await page.goto('/tv/?platform=tizen&focusdebug=1');
  const screen = page.locator('html');
  await expect(screen).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(screen).toHaveAttribute('data-tv-sources', '8');
  await expect(screen).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(screen).toHaveAttribute('data-tv-player-state', 'playing');
  await expect(page.locator('#tv-avplay')).toHaveAttribute('type', 'application/avplayer');
  expect(await page.locator('#tv-video').evaluate(video => (video as HTMLVideoElement).currentSrc)).toBe('');
  const calls = () => page.evaluate(() => (window as any).__tizenBoundaryCalls);
  await expect.poll(async () => (await calls()).subtitles).toEqual([8]);
  expect((await calls()).play).toBe(1);
  await mediaKey(page, 'MediaPause');
  await expect(screen).toHaveAttribute('data-tv-player-state', 'paused');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(screen).toHaveAttribute('data-tv-overlay', 'tracks');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(screen).toHaveAttribute('data-tv-overlay', '');
  await expect(screen).toHaveAttribute('data-tv-player-state', 'paused');
  expect((await calls()).pause).toBe(1);
  await mediaKey(page, 'MediaPlay');
  await expect(screen).toHaveAttribute('data-tv-player-state', 'playing');
  expect((await calls()).silent.slice(-1)[0]).toBe(true);
  await mediaKey(page, 'MediaStop');
  await expect(screen).toHaveAttribute('data-tv-screen', 'home');
});
