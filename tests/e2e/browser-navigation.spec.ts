import { expect, test, type Page } from '@playwright/test';
import { apiOrigin, installBackend, movie, sessionKey } from './helpers/responsiveBackend';
const entry = process.env.VIPTV_TEST_BROWSER_ORIGIN?.startsWith('https://viptv.local.test:') ? '/tv/' : '/';

/** Only decoding and backend delivery are mocked; App, Rust and browser history are real. */
async function installPlaybackBoundary(page: Page, requests: Awaited<ReturnType<typeof installBackend>>['requests']) {
  await page.addInitScript(() => {
    // This suite mocks decoding; HTTPS must not activate a real WebCodecs
    // decoder against its intentionally synthetic media URL.
    Object.defineProperty(window, 'VideoDecoder', { configurable: true, value: undefined });
    const media = HTMLMediaElement.prototype;
    Object.defineProperty(media, 'error', { configurable: true, get: () => null });
    const originalCanPlay = media.canPlayType;
    media.canPlayType = function(type: string) { return /mpegurl/i.test(type) ? 'probably' : originalCanPlay.call(this, type); };
    const playing = new WeakMap<HTMLMediaElement, boolean>();
    Object.defineProperty(media, 'duration', { configurable: true, get: () => 120 });
    Object.defineProperty(media, 'paused', { configurable: true, get(this: HTMLMediaElement) { return playing.get(this) !== true; } });
    media.load = function(this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function(this: HTMLMediaElement) { playing.set(this, true); queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); };
    media.pause = function(this: HTMLMediaElement) { playing.set(this, false); this.dispatchEvent(new Event('pause')); };
  });
  await page.route(`${apiOrigin}/media/history-playback/**`, route => route.fulfill({ status: 200, contentType: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-ENDLIST\n' }));
  await page.route(new RegExp('/api/(?:v2/)?playback'), async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': process.env.VIPTV_TEST_BROWSER_ORIGIN ?? 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    requests.push({ method: request.method(), path, body });
    const result = path === '/api/playback' || path === '/api/v2/playback' ? {
      id: 'history-playback', url: '/media/history-playback/capability/index.m3u8', format: 'hls', mode: 'direct', video_mode: 'copy', audio_mode: 'copy',
      position: 0, duration: 120, live: String(body.stream_id ?? '').startsWith('live_source_'), audio_tracks: [], subtitle_tracks: [], subtitles_supported: false,
    } : {};
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(playbackV2Fixture(route, result)) });
  });
}

async function chooseProfile(page: Page) {
  await page.locator('[data-focus-id="profile-0"]').click();
  await expect(page.locator('.home')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').profileId, sessionKey)).toBe('1');
}

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'One HTML browser history run; no physical TV decoder claim.');
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('browser Back and Forward restore detail/source URLs without appearance query modes', async ({ page }) => {
  const fixture = await installBackend(page);
  await page.goto(`${entry}?dark=1&theme=dark&oled=true`);
  await chooseProfile(page);
  await expect(page).toHaveURL(/\/tv\/home$/);
  const card = page.locator('.media-card').filter({ hasText: movie.name });
  await card.click();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await page.locator('[data-focus-id="detail-source"]').click();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie\/sources$/);
  await page.goBack();
  await expect(page.locator('.detail')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await expect(card).toBeVisible();
  await page.goForward();
  await expect(page.locator('.detail')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect(page).toHaveURL(/\/sources$/);
  expect(fixture.requests.filter(request => request.path === '/api/playback')).toHaveLength(0);
  expect(fixture.errors).toEqual([]);
});

test('reloading a watch URL restores the selected profile and title without replaying media', async ({ page }) => {
  const fixture = await installBackend(page);
  await page.goto(entry);
  await chooseProfile(page);
  await page.goto('/tv/title/movie/responsive-movie/watch?theme=dark');
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await page.reload();
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toHaveCount(0);
  expect(fixture.requests.filter(request => request.path === '/api/auth/profile')).toHaveLength(1);
  expect(fixture.requests.filter(request => request.path === '/api/auth/device/code')).toHaveLength(0);
  // Detail discovers sources for its best-source summary; it must never start playback.
  expect(fixture.requests.filter(request => request.path === '/api/playback')).toHaveLength(0);
  await expect(page.locator('.player-overlay')).toHaveCount(0);
  expect(fixture.errors).toEqual([]);
});

test('browser Back stops playback and Forward requires manual source selection', async ({ page }) => {
  const fixture = await installBackend(page);
  await installPlaybackBoundary(page, fixture.requests);
  await page.goto(entry);
  await chooseProfile(page);
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.locator('[data-focus-id="detail-source"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await expect(page).toHaveURL(/\/watch$/);
  await page.goBack();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect.poll(() => fixture.requests.some(request => request.path === '/api/v2/playback/history-playback' && request.method === 'DELETE')).toBe(true);
  await page.goForward();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect(page).toHaveURL(/\/sources$/);
  expect(fixture.requests.filter(request => request.path === '/api/v2/playback' && request.method === 'POST')).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test('v2 foreground validation stops revoked playback and retains the reason', async ({ page }) => {
  const fixture = await installBackend(page);
  await installPlaybackBoundary(page, fixture.requests);
  await page.goto(entry);
  await chooseProfile(page);
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.locator('[data-focus-id="detail-source"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await page.route(`${apiOrigin}/api/v2/playback/history-playback/heartbeat`, route => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 403, headers: { 'access-control-allow-origin': process.env.VIPTV_TEST_BROWSER_ORIGIN ?? 'http://127.0.0.1:4173', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type' }, ...(route.request().method() === 'OPTIONS' ? {} : { json: { error_code: 'authorization_expired' } }) }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toContainText('expired');
  await expect.poll(() => fixture.requests.some(request => request.path === '/api/v2/playback/history-playback' && request.method === 'DELETE')).toBe(true);
  expect(fixture.errors).toEqual([]);
});

test('a live card opens playback directly and history never restores a live source picker', async ({ page }) => {
  const fixture = await installBackend(page, { activity: true });
  await installPlaybackBoundary(page, fixture.requests);
  await page.goto(entry);
  await chooseProfile(page);
  await page.locator('[data-focus-id="recent-live-0"]').click();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/live\/station-0\/watch$/);
  await expect(page.locator('.vx-sources__status')).toHaveCount(0);
  await expect(page.locator('.detail')).toHaveCount(0);
  expect(fixture.requests.find(request => request.path === '/api/v2/playback' && request.method === 'POST')?.body).toMatchObject({ stream_id: 'live_source_station-0', position: 0 });
  expect(fixture.requests.some(request => request.path === '/api/v2/iptv/live/station-0/source')).toBe(true);
  expect(fixture.requests.filter(request => request.path === '/api/v2/streams')).toHaveLength(0);
  // Responsive players use the header Back control to leave playback.
  await page.locator('[data-focus-id="player-back"]').press('Enter');
  await expect(page.locator('.home')).toBeVisible();
  await expect.poll(() => fixture.requests.some(request => request.path === '/api/v2/playback/history-playback' && request.method === 'DELETE')).toBe(true);
  await page.goForward();
  await expect(page).toHaveURL(/\/tv\/live$/);
  await expect(page.locator('.vx-sources__status')).toHaveCount(0);
  expect(fixture.requests.filter(request => request.path === '/api/v2/playback' && request.method === 'POST')).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});
import { playbackV2Fixture } from './helpers/playbackV2Fixture';
