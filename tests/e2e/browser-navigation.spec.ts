import { expect, test, type Page } from '@playwright/test';
import { apiOrigin, installBackend, movie } from './helpers/responsiveBackend';

/** Only decoding and backend delivery are mocked; App, Rust and browser history are real. */
async function installPlaybackBoundary(page: Page, requests: Awaited<ReturnType<typeof installBackend>>['requests']) {
  await page.addInitScript(() => {
    const media = HTMLMediaElement.prototype;
    const originalCanPlay = media.canPlayType;
    media.canPlayType = function(type: string) { return /mpegurl/i.test(type) ? 'probably' : originalCanPlay.call(this, type); };
    const playing = new WeakMap<HTMLMediaElement, boolean>();
    Object.defineProperty(media, 'duration', { configurable: true, get: () => 120 });
    Object.defineProperty(media, 'paused', { configurable: true, get(this: HTMLMediaElement) { return playing.get(this) !== true; } });
    media.load = function(this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function(this: HTMLMediaElement) { playing.set(this, true); queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); };
    media.pause = function(this: HTMLMediaElement) { playing.set(this, false); this.dispatchEvent(new Event('pause')); };
  });
  await page.route(`${apiOrigin}/api/playback**`, async route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(request.url()).pathname;
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    requests.push({ method: request.method(), path, body });
    const result = path === '/api/playback' ? {
      id: 'history-playback', url: '/media/history-playback/capability/index.m3u8', format: 'hls', mode: 'direct', video_mode: 'copy', audio_mode: 'copy',
      position: 0, duration: 120, live: typeof body.channel_id === 'string', audio_tracks: [], subtitle_tracks: [], subtitles_supported: false,
    } : {};
    return route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(result) });
  });
}

async function chooseProfile(page: Page) {
  await page.locator('[data-focus-id="profile-0"]').click();
  await expect(page.locator('.home')).toBeVisible();
}

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'One HTML browser history run; no physical TV decoder claim.');
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('browser Back and Forward restore detail/source URLs without appearance query modes', async ({ page }) => {
  const fixture = await installBackend(page);
  await page.goto('/?dark=1&theme=dark&oled=true');
  await chooseProfile(page);
  await expect(page).toHaveURL(/\/tv\/home$/);
  const card = page.locator('.media-card').filter({ hasText: movie.name });
  await card.click();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await page.getByRole('button', { name: 'Choose source', exact: true }).click();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie\/sources$/);
  await page.goBack();
  await expect(page.locator('.detail')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await expect(card).toBeFocused();
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
  await page.goto('/');
  await chooseProfile(page);
  await page.goto('/tv/title/movie/responsive-movie/watch?theme=dark');
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/movie\/responsive-movie$/);
  await page.reload();
  await expect(page.locator('.detail').getByRole('heading', { name: movie.name })).toBeVisible();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toHaveCount(0);
  expect(fixture.requests.filter(request => request.path === '/api/auth/profile')).toHaveLength(1);
  expect(fixture.requests.filter(request => request.path === '/api/auth/device/code')).toHaveLength(0);
  expect(fixture.requests.filter(request => request.path === '/api/playback' || request.path === '/api/streams')).toHaveLength(0);
  expect(fixture.errors).toEqual([]);
});

test('browser Back stops playback and Forward requires manual source selection', async ({ page }) => {
  const fixture = await installBackend(page);
  await installPlaybackBoundary(page, fixture.requests);
  await page.goto('/');
  await chooseProfile(page);
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.getByRole('button', { name: 'Choose source', exact: true }).click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await expect(page).toHaveURL(/\/watch$/);
  await page.goBack();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect.poll(() => fixture.requests.some(request => request.path === '/api/playback/history-playback' && request.method === 'DELETE')).toBe(true);
  await page.goForward();
  await expect(page.locator('[data-focus-id="source-0"]')).toBeVisible();
  await expect(page).toHaveURL(/\/sources$/);
  expect(fixture.requests.filter(request => request.path === '/api/playback' && request.method === 'POST')).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test('a live card opens playback directly and history never restores a live source picker', async ({ page }) => {
  const fixture = await installBackend(page, { activity: true });
  await installPlaybackBoundary(page, fixture.requests);
  await page.goto('/');
  await chooseProfile(page);
  await page.locator('[data-focus-id="recent-live-0"]').click();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await expect(page).toHaveURL(/\/tv\/title\/live\/station-0\/watch$/);
  await expect(page.locator('.source-context')).toHaveCount(0);
  await expect(page.locator('.detail')).toHaveCount(0);
  expect(fixture.requests.find(request => request.path === '/api/playback' && request.method === 'POST')?.body).toMatchObject({ channel_id: 'station-0' });
  expect(fixture.requests.filter(request => request.path === '/api/streams')).toHaveLength(0);
  await page.goBack();
  await expect(page.locator('.home')).toBeVisible();
  await expect.poll(() => fixture.requests.some(request => request.path === '/api/playback/history-playback' && request.method === 'DELETE')).toBe(true);
  await page.goForward();
  await expect(page).toHaveURL(/\/tv\/live$/);
  await expect(page.locator('.source-context')).toHaveCount(0);
  expect(fixture.requests.filter(request => request.path === '/api/playback' && request.method === 'POST')).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});
