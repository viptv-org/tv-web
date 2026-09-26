import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

export const apiOrigin = 'https://viptv.syek.tech';
export const profile = { id: '1', name: 'Alex', setup_complete: true, avatar: 'critters-1.png' };
export const movie = { id: 'tt-movie', type: 'movie', name: 'Moonfall', title: 'Moonfall', poster: '/poster.jpg', background: '/background.jpg', description: 'A fixture movie.', year: 2026, genres: ['Drama'] };
export const episode = { id: 'tt-show:1:2', title: 'The Signal', name: 'The Signal', season: 1, episode: 2, description: 'Episode fixture.' };
export const channel = { id: 'family-news', type: 'live', name: 'Family News', poster: '/news.png' };
export type ProfileFixture = {
  profiles: Array<Record<string, unknown>>;
  requests: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  needsPin: boolean;
};

export async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(body) });
}

export async function fixtureImage(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" viewBox="0 0 256 144"><rect width="256" height="144" fill="#303234"/></svg>',
  });
}

export const corsHeaders = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

/** Ignored Playwright output for private visual review; never an app asset. */
export async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
}

export async function expectBox(page: Page, selector: string, expected: { x: number; y: number; width?: number; height?: number }, tolerance = 3) {
  await expect(async () => {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} must have a visible canonical-frame box`).not.toBeNull();
    expect(Math.abs(box!.x - expected.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(box!.y - expected.y)).toBeLessThanOrEqual(tolerance);
    if (expected.width !== undefined) expect(Math.abs(box!.width - expected.width)).toBeLessThanOrEqual(tolerance);
    if (expected.height !== undefined) expect(Math.abs(box!.height - expected.height)).toBeLessThanOrEqual(tolerance);
  }).toPass({ timeout: 5000 });
}

/**
 * Only platform edges are faked. The shared React controller, real DOM remote
 * events and all HTTP decoding still run unchanged in Chromium.
 */
export async function installPlatformRuntime(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    let currentTime = 0;
    let listener: Record<string, ((...args: never[]) => void) | undefined> = {};
    Object.defineProperty(window, 'webapis', { configurable: true, value: { avplay: {
      open() {}, close() {}, prepareAsync(success: () => void) { queueMicrotask(success); }, play() {}, pause() {}, stop() {},
      seekTo(milliseconds: number, success?: () => void) { currentTime = milliseconds; success?.(); },
      getCurrentTime() { return currentTime; }, getDuration() { return 120_000; }, getTotalTrackInfo() { return []; },
      setListener(next: Record<string, ((...args: never[]) => void) | undefined>) { listener = next; }, setDisplayRect() {},
      setSelectTrack() {}, setSilentSubtitle() {}, setStreamingProperty() {},
    } } });
    const media = HTMLMediaElement.prototype;
    // This fixture simulates native HLS; real MSE decoding has a separate test.
    const nativeCanPlayType = media.canPlayType;
    media.canPlayType = function(type: string) {
      return /mpegurl/i.test(type) ? 'probably' : nativeCanPlayType.call(this, type);
    };
    const playState = new WeakMap<HTMLMediaElement, boolean>();
    Object.defineProperty(media, 'duration', { configurable: true, get() { return 120; } });
    Object.defineProperty(media, 'paused', { configurable: true, get() { return playState.get(this as HTMLMediaElement) !== true; } });
    media.load = function(this: HTMLMediaElement) { queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata'))); };
    media.play = function(this: HTMLMediaElement) { playState.set(this, true); queueMicrotask(() => this.dispatchEvent(new Event('play'))); return Promise.resolve(); };
    media.pause = function(this: HTMLMediaElement) { playState.set(this, false); this.dispatchEvent(new Event('pause')); };
    // Keep the listener referenced: this matches AVPlay's lifetime without
    // pretending a browser test proves Samsung media decoding.
    void listener;
  });
  return () => expect(pageErrors).toEqual([]);
}

export async function installBackend(page: Page, profileFixture?: ProfileFixture) {
  const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
  await Promise.all([
    page.route('**/poster.jpg', fixtureImage),
    page.route('**/background.jpg', fixtureImage),
    page.route('**/news.png', fixtureImage),
  ]);
  let selectedProfileId: string | null = null;
  await page.route(`${apiOrigin}/api/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsHeaders });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: profileFixture?.profiles ?? [profile], profile_id: selectedProfileId, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(route.request().postDataJSON().profile_id);
      return json(route, { profile_id: selectedProfileId });
    }
    if (path === '/api/auth/device/code') return json(route, { device_code: 'opaque-pairing-code', user_code: 'AB12CD34EF', verification_uri: 'https://viptv.syek.tech/device', verification_uri_complete: 'https://viptv.syek.tech/device?code=AB12CD34EF', qr_uri: 'https://viptv.syek.tech/api/auth/device/qr?code=AB12CD34EF', expires_in: 600, interval: 60 });
    if (path === '/api/auth/device/token') return json(route, { error: 'authorization_pending' }, 400);
    if (path === '/api/profiles/1/continue/page') return json(route, { items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' && route.request().method() === 'GET') return json(route, []);
    if (path === '/api/profiles/1/favorites' && route.request().method() === 'GET') return json(route, []);
    if (profileFixture && (path === '/api/profiles' || path === '/api/profiles/2')) {
      const method = route.request().method();
      const body = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      profileFixture.requests.push({ method, path, body });
      if (path === '/api/profiles' && method === 'GET') return json(route, profileFixture.profiles);
      if (path === '/api/profiles' && method === 'POST') {
        const created = { id: '2', name: String(body.name), avatar_style: body.avatar_style, avatar_choice: body.avatar_choice, setup_complete: true };
        profileFixture.profiles.push(created);
        return json(route, created);
      }
      if (path === '/api/profiles/2' && method === 'PATCH') {
        if (profileFixture.needsPin) {
          profileFixture.needsPin = false;
          return json(route, { error: 'parent PIN required' }, 403);
        }
        Object.assign(profileFixture.profiles[1], body);
        return json(route, profileFixture.profiles[1]);
      }
      if (path === '/api/profiles/2' && method === 'DELETE') {
        profileFixture.profiles.splice(1, 1);
        return json(route, { ok: true });
      }
    }
    if (path === '/api/profiles/1/preferences') {
      if (route.request().method() === 'PUT') Object.assign(preferences, JSON.parse(route.request().postData() || '{}'));
      return json(route, preferences);
    }
    if (path === '/api/live/categories') return json(route, { categories: [{ id: 'section:News', name: 'News', count: 1 }], total: 1 });
    if (path === '/api/catalogs') return json(route, [{ id: 'popular', name: 'Popular', type: 'movie', addon_id: 2, supports_search: true, supports_skip: true }]);
    if (path === '/api/discover') return json(route, { metas: [movie], has_more: false, next_skip: null });
    if (path === '/api/meta/movie/tt-movie') return json(route, { meta: movie });
    if (path === '/api/meta/series/tt-show') return json(route, { meta: { id: 'tt-show', type: 'series', name: 'Fixture Show', videos: [episode] } });
    if (path === '/api/streams' && route.request().method() === 'POST') return json(route, { id: 'job-1' });
    if (path === '/api/streams/job-1') return json(route, { events: [{ seq: 1, source: 'addon:2', streams: [{ id: 'stream-1', name: '1080p', title: 'Moonfall 1080p', filename: 'moonfall.mkv', source_addon_id: 'addon:2', source_name: 'Fixture Addon', source_quality: '1080p', url: 'https://upstream.invalid/private' }] }], done: true });
    if (path === '/api/profiles/1/favorites/toggle') return json(route, { saved: true });
    if (path === '/api/live') return json(route, { channels: [channel], total: 1 });
    if (path === '/api/guide/family-news') return json(route, { timezone: 'UTC', programs: [{ title: 'News Now', start: 0, end: 4_102_444_800, description: 'Live fixture.' }] });
    if (path === '/api/parent/status') return json(route, { pin_configured: true, unlocked: false, restricted: false });
    if (path === '/api/parent/unlock') return json(route, { unlocked: true });
    if (path === '/api/addons' && route.request().method() === 'GET') return json(route, []);
    if (path === '/api/playback' && route.request().method() === 'POST') return json(route, { id: 'playback-1', url: '/media/playback-1/capability/index.m3u8', format: 'hls', mode: 'remux', video_mode: 'copy', audio_mode: 'copy', position: 0, live: false, duration: 120, audio_tracks: [], subtitle_tracks: [], subtitles_supported: false });
    if (path === '/api/playback' || path.includes('/heartbeat') || path.includes('/progress') || path.includes('/continue/') || path.includes('/preferences')) return json(route, { ok: true });
    return json(route, { error: `unhandled ${path}` }, 404);
  });
}


export async function enterHome(page: Page, platform: 'tizen' | 'vizio') {
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.goto(`/?platform=${platform}`);
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Moonfall' })).toBeVisible();
}

for (const platform of ['tizen', 'vizio'] as const) {
  test(`${platform}: remote flow retains shared pairing-derived profile, browse, source and guide behavior`, async ({ page }, testInfo) => {
    test.skip(test.info().project.name !== platform, 'run each platform query in its matching project');
    const assertNoPageErrors = await installPlatformRuntime(page);
    await enterHome(page, platform);
    await expectBox(page, '.shelves', { x: 192, y: 700, width: 1632 });
    const firstCard = await page.locator('.media-card').first().boundingBox();
    expect(firstCard).not.toBeNull();
    expect(firstCard!.width).toBe(320);
    const cardArt = await page.locator('.media-card .vx-card__art').first().boundingBox();
    expect(cardArt).not.toBeNull();
    expect(cardArt!.width).toBe(320);
    expect(cardArt!.height).toBe(180);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-home`);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Moonfall' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Moonfall' })).toBeVisible();
    await page.locator('[data-focus-id="detail-source"]').press('Enter');
    await expect(page.locator('.vx-sources__status')).toContainText('Moonfall');
    await expect(page.getByText('Moonfall 1080p')).toBeVisible();
    const panel = await page.getByRole('dialog', { name: 'Choose a source' }).boundingBox();
    const sourceStatus = await page.locator('.vx-sources__status').boundingBox();
    expect(sourceStatus!.x).toBeGreaterThanOrEqual(panel!.x + 32);
    expect(sourceStatus!.y).toBeGreaterThan(panel!.y);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-sources`);

    // Sources returns to detail first; a second Back restores the rail/Home.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Live TV' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Live TV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'News Now' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-guide`);

    await page.getByRole('button', { name: 'Search', exact: true }).press('Enter');
    const search = page.getByRole('textbox', { name: 'Search titles' });
    await search.fill('moon');
    await expect(page.getByRole('button', { name: 'Moonfall' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-search`);

    await page.getByRole('button', { name: 'Settings' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-settings`);
    await page.getByRole('button', { name: 'Playback preferences' }).press('Enter');
    await expect(page.getByRole('button', { name: /^Preferred audio/ })).toBeVisible();
    assertNoPageErrors();
  });
}
