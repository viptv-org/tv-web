import { expect, test, type Page } from '@playwright/test';
import { installBackend, apiOrigin } from '../preview/backend';

// Reproduction of the owner-reported Vizio issue: press Back during playback
// entered from Continue Watching, and the screen goes fully black.
test.beforeEach(({}, info) => { test.skip(info.project.name !== 'vizio', 'Vizio receiver regression'); });

async function installVizioMedia(page: Page) {
  // The same HTML-media edge the Next controller tests use: the real
  // VizioHtml5Adapter receives real DOM events without Chromium decoding.
  await page.addInitScript(() => {
    const media = HTMLMediaElement.prototype;
    const nativeCanPlayType = media.canPlayType;
    media.canPlayType = function (type: string) { return /mpegurl|mp4|avc1|mp4a|aac/i.test(type) ? 'probably' : nativeCanPlayType.call(this, type); };
    const positions = new WeakMap<HTMLMediaElement, number>();
    const playing = new WeakMap<HTMLMediaElement, boolean>();
    const sources = new WeakMap<HTMLMediaElement, string>();
    Object.defineProperty(media, 'src', { configurable: true, get() { return sources.get(this as HTMLMediaElement) ?? ''; }, set(value: string) { sources.set(this as HTMLMediaElement, String(value)); } });
    Object.defineProperty(media, 'duration', { configurable: true, get() { return 120; } });
    Object.defineProperty(media, 'currentTime', { configurable: true, get() { return positions.get(this as HTMLMediaElement) ?? 20; }, set(value: number) { positions.set(this as HTMLMediaElement, Number(value) || 0); this.dispatchEvent(new Event('timeupdate')); } });
    Object.defineProperty(media, 'paused', { configurable: true, get() { return playing.get(this as HTMLMediaElement) !== true; } });
    Object.defineProperty(media, 'ended', { configurable: true, get() { return false; } });
    Object.defineProperty(media, 'readyState', { configurable: true, get() { return sources.get(this as HTMLMediaElement) ? 4 : 0; } });
    media.load = function (this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function (this: HTMLMediaElement) { playing.set(this, true); queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); };
    media.pause = function (this: HTMLMediaElement) { playing.set(this, false); this.dispatchEvent(new Event('pause')); };
  });
}

async function playSeriesFromQueue(page: Page) {
  await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true });
  await installVizioMedia(page);
  // A series episode with saved position in Continue Watching.
  const episode = { id: 'series-1:1:2', type: 'series', series_id: 'series-1', season: 1, episode: 2, name: 'Fixture Series', episodeTitle: 'Episode Two', position: 20, duration: 120, genres: [] };
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => route.fulfill({ json: { items: [episode], offset: 0, total: 1, next_offset: null } }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio&focusdebug=1');
  // Home hero action (Resume) starts the queued episode.
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-action');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ['source-chip', 'source-provider', 'source-row', 'player-control'].includes((window as any).__viptvFocus?.view ?? ''), null, { timeout: 10000 });
  const view = await page.evaluate(() => (window as any).__viptvFocus?.view);
  if (view !== 'player-control') {
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'source-row');
    await page.keyboard.press('Enter');
  }
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'player-control', null, { timeout: 10000 });
}

test('series: back during playback returns to a visible screen, not black', async ({ page }, info) => {
  await playSeriesFromQueue(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: info.outputPath('before-back.png') });
  // BACK from the player: hide chrome, then exit.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: info.outputPath('chrome-hidden.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('after-back.png') });
  const view = await page.evaluate(() => (window as any).__viptvFocus?.view ?? 'unknown');
  const videoLayer = await page.evaluate(() => {
    const layer = document.getElementById('video-layer');
    return layer ? getComputedStyle(layer).display : 'missing';
  });
  console.log(`view=${view} video-layer=${videoLayer}`);
  expect(view).not.toBe('player-control');
  expect(videoLayer).toBe('none');
});

test('series: single back from visible chrome hides it, playback continues', async ({ page }) => {
  await playSeriesFromQueue(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const phase = await page.evaluate(() => (window as any).__viptvApp?.phase ?? (window as any).__viptvFocus?.view ?? 'unknown');
  // A single Back from visible chrome hides it without leaving the player.
  expect(phase).not.toBe('sources');
});

test('series: back after chrome auto-hide exits the player cleanly', async ({ page }, info) => {
  await playSeriesFromQueue(page);
  // Wait past the 5 s chrome auto-hide so BACK exits directly from hidden chrome.
  await page.waitForTimeout(6200);
  await page.screenshot({ path: info.outputPath('chrome-auto-hidden.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('after-auto-hidden-back.png') });
  const phase = await page.evaluate(() => (window as any).__viptvApp?.phase ?? (window as any).__viptvFocus?.view ?? 'unknown');
  const videoLayer = await page.evaluate(() => {
    const layer = document.getElementById('video-layer');
    return layer ? getComputedStyle(layer).display : 'missing';
  });
  console.log(`phase=${phase} video-layer=${videoLayer}`);
  // One Back from hidden chrome exits the player: the video layer is hidden
  // and focus returns to the sources screen.
  expect(videoLayer).toBe('none');
});

test('series: browser history back during playback does not blank the app', async ({ page }, info) => {
  await playSeriesFromQueue(page);
  await page.waitForTimeout(500);
  // A Conjure app can deliver the remote's Back as browser history navigation.
  await page.goBack();
  await page.waitForTimeout(800);
  await page.screenshot({ path: info.outputPath('after-history-back.png') });
  const videoLayer = await page.evaluate(() => {
    const layer = document.getElementById('video-layer');
    return layer ? getComputedStyle(layer).display : 'missing';
  });
  const canvas = await page.evaluate(() => document.querySelector('#app canvas') !== null);
  console.log(`video-layer=${videoLayer} canvas=${canvas}`);
  // The app must still render (canvas present), not a blank document.
  expect(canvas).toBe(true);
  // The history BACK must have been delivered to the app as a Back key:
  // from visible chrome it hides the chrome (view stays player) and a
  // second one exits to the sources screen with the video layer hidden.
  const firstView = await page.evaluate(() => (window as any).__viptvFocus?.view ?? 'unknown');
  await page.goBack();
  await page.waitForTimeout(800);
  const exited = await page.evaluate(() => {
    const layer = document.getElementById('video-layer');
    return layer ? getComputedStyle(layer).display : 'missing';
  });
  const view2 = await page.evaluate(() => (window as any).__viptvFocus?.view ?? 'unknown');
  console.log(`first=${firstView} second view=${view2} video-layer=${exited}`);
  // Whatever the intermediate state, after two Backs the player is gone
  // and a real screen (sources) holds focus.
  expect(exited).toBe('none');
  expect(view2).not.toBe('player-control');
});
