import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { installTizenSdkBoundary } from '../preview/tizen-sdk';

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
  await installTizenSdkBoundary(page);
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
  expect((await calls()).keys).toEqual(['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaStop', 'MediaRewind', 'MediaFastForward']);
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

for (const platform of ['webos', 'tizen']) {
  test(`${platform} retires playback and its lease when the host hides the page`, async ({ page, baseURL }) => {
    const fixture = await installRemoteBackend(page, baseURL!, { media: true });
    await page.goto(`/tv/?platform=${platform}`);
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect(root).toHaveAttribute('data-tv-sources', '8');
    await expect(root).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).videoWidth)).toBe(160);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(root).toHaveAttribute('data-tv-screen', 'home');
    await expect.poll(() => page.locator('video').evaluate(video => video.getAttribute('src') ?? '')).toBe('');
    await expect.poll(() => fixture.requests.some(request => request.method === 'DELETE' && request.path === '/api/playback/fixture-playback')).toBe(true);
  });
}
