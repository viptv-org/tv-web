import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const profile = { id: '1', name: 'Alex', setup_complete: true, avatar: 'critters-1.png' };
const movie = { id: 'tt-movie', type: 'movie', name: 'Moonfall', title: 'Moonfall', poster: '/poster.jpg', background: '/background.jpg', description: 'A fixture movie.', year: 2026, genres: ['Drama'] };
const episode = { id: 'tt-show:1:2', title: 'The Signal', name: 'The Signal', season: 1, episode: 2, description: 'Episode fixture.' };
const channel = { id: 'family-news', type: 'live', name: 'Family News', poster: '/news.png' };
type ProfileFixture = {
  profiles: Array<Record<string, unknown>>;
  requests: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  needsPin: boolean;
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: corsHeaders, body: JSON.stringify(body) });
}

async function fixtureImage(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" viewBox="0 0 256 144"><rect width="256" height="144" fill="#303234"/></svg>',
  });
}

const corsHeaders = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

/** Ignored Playwright output for private visual review; never an app asset. */
async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
}

async function expectBox(page: Page, selector: string, expected: { x: number; y: number; width?: number; height?: number }, tolerance = 3) {
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
async function installPlatformRuntime(page: Page) {
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

async function installBackend(page: Page, profileFixture?: ProfileFixture) {
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

test('renders the real device-pairing handoff without storing a token before approval', async ({ page }, testInfo) => {
  const assertNoPageErrors = await installPlatformRuntime(page);
  await installBackend(page);
  await page.goto('/?platform=tizen');
  await expect(page.getByRole('heading', { name: 'Sign in to VIPTV' })).toBeVisible();
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Scan to link your TV' })).toBeVisible();
  await expectBox(page, '.pairing h1', { x: 96, y: 170 });
  await capture(page, testInfo, 'pairing');
  await page.getByRole('button', { name: 'Try again' }).press('Enter');
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
  assertNoPageErrors();
});

async function enterHome(page: Page, platform: 'tizen' | 'vizio') {
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
    await expectBox(page, '.shelves', { x: 92, y: 466, width: 1188, height: 254 });
    const firstCard = await page.locator('.media-card').first().boundingBox();
    expect(firstCard).not.toBeNull();
    expect(firstCard!.width).toBe(256);
    expect(firstCard!.height).toBe(200);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await capture(page, testInfo, `${platform}-home`);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Moonfall' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Moonfall' })).toBeVisible();
    await page.getByRole('button', { name: 'Choose source', exact: true }).press('Enter');
    await expect(page.locator('.source-context')).toContainText('Moonfall');
    await expect(page.getByText('Moonfall 1080p')).toBeVisible();
    await expectBox(page, '.source-context', { x: 100, y: 119 });
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
    await expect(page.getByRole('button', { name: 'Preferred audio', exact: true })).toBeVisible();
    assertNoPageErrors();
  });
}

test('Vizio fixture opens the same-origin server media capability through the HTML media boundary', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the Tizen AVPlay boundary has its own fake-runtime acceptance path');
  const assertNoPageErrors = await installPlatformRuntime(page);
  await installBackend(page);
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Moonfall' }).press('Enter');
  await page.getByRole('button', { name: 'Choose source', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Moonfall 1080p' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await expect(page.locator('video')).toHaveJSProperty('src', 'https://viptv.syek.tech/media/playback-1/capability/index.m3u8');
  assertNoPageErrors();
});

test('profile management preserves avatar choice, unlocks a protected edit, and never offers primary deletion', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'one complete account-management flow is sufficient for the shared React surface');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const fixture: ProfileFixture = { profiles: [{ ...profile, avatar_style: 'critters', avatar_choice: 1 }], requests: [], needsPin: true };
  await installBackend(page, fixture);
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await page.getByRole('button', { name: 'Add profile' }).click();
  await expect(page.getByRole('heading', { name: 'Add a profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Change avatar' }).click();
  await expect(page.getByRole('heading', { name: 'Find your favorite' })).toBeVisible();
  await page.getByRole('button', { name: 'critters 2' }).click();
  await page.getByRole('button', { name: 'Enter profile name' }).click();
  await page.getByRole('textbox', { name: 'Profile name' }).fill('Sam');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Create profile' }).click();
  await expect(page.getByRole('button', { name: 'Sam' })).toBeVisible();
  expect(fixture.requests.find((request) => request.method === 'POST')).toMatchObject({ body: { name: 'Sam', avatar_style: 'critters', avatar_choice: 2 } });

  await page.locator('[data-focus-id="profile-0"]').click({ button: 'right' });
  await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete profile' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('[data-focus-id="profile-1"]').click({ button: 'right' });
  await page.locator('[data-focus-id="profile-name"]').click();
  await page.getByRole('textbox', { name: 'Profile name' }).fill('Sam Prime');
  await page.getByRole('button', { name: 'Done' }).click();
  const protectedUpdate = page.waitForResponse(response => response.url().includes('/api/profiles/') && response.request().method() === 'PATCH');
  await page.locator('[data-focus-id="profile-save"]').click();
  await expect((await protectedUpdate).status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'Parent PIN' })).toBeVisible();
  await page.getByLabel('Parent PIN').fill('1234');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Sam Prime' })).toBeVisible();
  expect(fixture.requests.filter((request) => request.method === 'PATCH')).toHaveLength(2);

  await page.locator('[data-focus-id="profile-1"]').click({ button: 'right' });
  await page.getByRole('button', { name: 'Delete profile' }).click();
  await page.getByRole('button', { name: 'Delete profile' }).click();
  await expect(page.getByRole('button', { name: 'Sam Prime' })).toHaveCount(0);
  expect(fixture.requests.some((request) => request.method === 'DELETE' && request.path === '/api/profiles/2')).toBe(true);
  assertNoPageErrors();
});

test('held OK opens queue management without also activating the card, then hides and restores it', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the remote gesture is shared; exercise it once through the AVPlay platform boundary');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const queued = { ...movie, id: 'tt-queued', name: 'Queued movie', title: 'Queued movie', position: 42, duration: 120, source_addon_id: 'addon:2', source_fingerprint: 'same-provider-source' };
  const visibility: boolean[] = [];
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => json(route, { items: [queued], offset: 0, total: 1, next_offset: null }));
  await page.route(`${apiOrigin}/api/profiles/1/continue/visibility`, route => {
    const body = JSON.parse(route.request().postData() || '{}') as { hidden?: boolean };
    visibility.push(body.hidden === true);
    return json(route, { ok: true });
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  const queuedCard = page.getByRole('button', { name: 'Queued movie' });
  await expect(queuedCard).toBeVisible();
  // TvButton registers its remote action after the shelf commits.
  await page.waitForTimeout(50);
  await queuedCard.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.modal').getByRole('heading', { name: 'Queued movie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide from Continue Watching' })).toBeVisible();
  await expect(page.locator('.detail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hide from Continue Watching' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Hidden from Continue Watching' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).press('Enter');
  await expect.poll(() => visibility).toEqual([true, false]);
  assertNoPageErrors();
});

test('held queue hero opens Manage before its primary Resume action', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the shared remote hold is exercised through the AVPlay boundary once');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const queued = { ...movie, id: 'tt-hero-queued', name: 'Hero queue movie', title: 'Hero queue movie', position: 42, duration: 120, source_addon_id: 'addon:2', source_fingerprint: 'same-provider-source' };
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => json(route, { items: [queued], offset: 0, total: 1, next_offset: null }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  const hero = page.getByRole('button', { name: 'Resume', exact: true });
  await expect(hero).toBeVisible();
  await page.waitForTimeout(50);
  await hero.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.modal').getByRole('heading', { name: 'Hero queue movie' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide from Continue Watching' })).toBeVisible();
  await expect(page.locator('.sources')).toHaveCount(0);
  assertNoPageErrors();
});

test('held resumable non-queue hero opens explicit source choice instead of Manage', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the shared remote hold is exercised through the AVPlay boundary once');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const resumable = { ...movie, id: 'tt-hero-resume', name: 'Resume hero movie', title: 'Resume hero movie', position: 42, duration: 120, source_addon_id: 'addon:2', source_fingerprint: 'same-provider-source' };
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => json(route, { items: [], offset: 0, total: 0, next_offset: null }));
  await page.route(`${apiOrigin}/api/live**`, route => json(route, { channels: [], total: 0 }));
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { metas: [resumable], has_more: false, next_skip: null }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  const hero = page.getByRole('button', { name: 'Resume', exact: true });
  await expect(hero).toBeVisible();
  await page.waitForTimeout(50);
  await hero.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.source-context')).toContainText('Resume hero movie');
  await expect(page.getByText('Moonfall 1080p')).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(0);
  assertNoPageErrors();
});

test('new-movie hero hold chooses a source while its Home card hold performs ordinary selection', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the shared remote hold is exercised through the AVPlay boundary once');
  const assertNoPageErrors = await installPlatformRuntime(page);
  await installBackend(page);
  await page.route(`${apiOrigin}/api/live**`, route => json(route, { channels: [], total: 0 }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');

  const hero = page.getByRole('button', { name: 'Play', exact: true });
  await expect(hero).toBeVisible();
  await page.waitForTimeout(50);
  await hero.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.source-context')).toContainText('Moonfall');
  await expect(page.getByText('Moonfall 1080p')).toBeVisible();

  await page.keyboard.press('Escape');
  const card = page.locator('[data-focus-id="home-0"]');
  await expect(card).toBeVisible();
  await page.waitForTimeout(50);
  await card.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.detail').getByRole('heading', { name: 'Moonfall' })).toBeVisible();
  await expect(page.locator('.modal')).toHaveCount(0);
  assertNoPageErrors();
});

test('held series-root hero opens its episode detail instead of source selection', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'the shared remote hold is exercised through the AVPlay boundary once');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const show = { id: 'tt-hero-show', type: 'series', name: 'Hero fixture show', title: 'Hero fixture show', background: '/background.jpg', description: 'A series root.' };
  await installBackend(page);
  await page.route(`${apiOrigin}/api/live**`, route => json(route, { channels: [], total: 0 }));
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { metas: [show], has_more: false, next_skip: null }));
  await page.route(`${apiOrigin}/api/meta/series/tt-hero-show`, route => json(route, { meta: { ...show, videos: [{ id: 'tt-hero-show:1:1', title: 'Pilot', season: 1, episode: 1, description: 'Episode one.' }] } }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');

  const hero = page.getByRole('button', { name: 'Episodes', exact: true });
  await expect(hero).toBeVisible();
  await page.waitForTimeout(50);
  await hero.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(750);
  await page.keyboard.up('Enter');
  await expect(page.locator('.detail').getByRole('heading', { name: 'Hero fixture show' })).toBeVisible();
  await expect(page.locator('[data-focus-id="episode-0"]')).toContainText('EPISODE 1');
  await expect(page.locator('.sources')).toHaveCount(0);
  assertNoPageErrors();
});

test('playback preferences persist their snake-case mutation and update the shared settings view', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the persisted settings surface is shared by both hosted-TV packages');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
  const changes: Array<Record<string, unknown>> = [];
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/preferences`, route => {
    if (route.request().method() === 'PUT') {
      const change = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      changes.push(change);
      Object.assign(preferences, change);
    }
    return json(route, preferences);
  });
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Settings' }).press('Enter');
  await page.getByRole('button', { name: 'Playback preferences' }).press('Enter');
  await page.getByRole('button', { name: 'Start with subtitles', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'On', exact: true }).press('Enter');
  await expect(page.locator('.settings-description')).toContainText('On');
  await page.getByRole('button', { name: 'Maximum quality', exact: true }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Maximum quality', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '720p' }).press('Enter');
  await expect(page.locator('.settings-description')).toContainText('720p');
  expect(changes).toEqual([{ subtitles_enabled: true }, { quality: '720p' }]);
  await expect(page.getByRole('alert')).toHaveCount(0);
  assertNoPageErrors();
});

test('series detail keeps Roku-style season choice separate from explicit episode source selection', async ({ page }) => {
  test.skip(test.info().project.name !== 'tizen', 'one shared controller flow covers season and episode behavior');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const show = { id: 'tt-show', type: 'series', name: 'Fixture Show', title: 'Fixture Show', background: '/background.jpg', description: 'A fixture series.' };
  await installBackend(page);
  await page.route(`${apiOrigin}/api/catalogs`, route => json(route, [{ id: 'series-popular', name: 'Series', type: 'series', addon_id: 2, supports_search: true, supports_skip: true }]));
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { metas: [show], has_more: false, next_skip: null }));
  await page.route(`${apiOrigin}/api/meta/series/tt-show`, route => json(route, { meta: { ...show, videos: [
    { id: 'tt-show:1:1', title: 'Pilot', season: 1, episode: 1, description: 'Episode one.' },
    { id: 'tt-show:1:2', title: 'The Signal', season: 1, episode: 2, description: 'Episode two.' },
  ] } }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Fixture Show' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Fixture Show' })).toBeVisible();
  await expect(page.locator('[data-focus-id="episode-0"]')).toContainText('EPISODE 1');
  await page.getByRole('button', { name: 'Season 1' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Season' })).toBeVisible();
  await page.getByRole('button', { name: 'Season 1' }).last().press('Enter');
  await page.locator('[data-focus-id="episode-1"]').press('Enter');
  await expect(page.locator('.source-context')).toContainText('The Signal');
  await expect(page.getByText('Moonfall 1080p')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  assertNoPageErrors();
});

test('resume never substitutes a lookalike source and leaves the user at manual source choice', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'one platform proves the shared resume controller does not silently change providers');
  const assertNoPageErrors = await installPlatformRuntime(page);
  const queued = { ...movie, id: 'tt-resume', name: 'Resume fixture', title: 'Resume fixture', position: 42, duration: 120, source_addon_id: 'addon:2', source_fingerprint: 'original-only' };
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => json(route, { items: [queued], offset: 0, total: 1, next_offset: null }));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Resume', exact: true }).press('Enter');
  await expect(page.locator('.source-context')).toContainText('Resume fixture');
  await expect(page.getByRole('button', { name: 'Moonfall 1080p' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('previous source is unavailable');
  await expect(page.locator('.player-overlay')).toHaveCount(0);
  await page.getByRole('button', { name: 'Moonfall 1080p' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  assertNoPageErrors();
});

test('shows a sanitized backend failure and lets the remote dismiss it', async ({ page }) => {
  const assertNoPageErrors = await installPlatformRuntime(page);
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { error: 'https://upstream.invalid/secret' }, 502));
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('alert')).toHaveText(/VIPTV could not complete that request/);
  await expect(page.getByRole('alert')).not.toContainText('upstream.invalid');
  await page.getByRole('button', { name: 'Dismiss' }).press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
  assertNoPageErrors();
});

test('does not let a slow obsolete browse response replace the current search results', async ({ page }) => {
  const assertNoPageErrors = await installPlatformRuntime(page);
  let discoverCalls = 0;
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.route(`${apiOrigin}/api/discover**`, async route => {
    discoverCalls += 1;
    const query = new URL(route.request().url()).searchParams.get('search');
    if (!query && discoverCalls === 1) { await new Promise(resolve => setTimeout(resolve, 1_000)); return json(route, { metas: [{ ...movie, name: 'Obsolete shelf' }], has_more: false }); }
    return json(route, { metas: [{ ...movie, name: query === 'fresh' ? 'Fresh result' : 'Current shelf' }], has_more: false });
  });
  await page.goto('/?platform=tizen');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Search', exact: true }).press('Enter');
  await page.getByRole('textbox', { name: 'Search titles' }).fill('fresh');
  await expect(page.getByRole('button', { name: 'Fresh result' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Obsolete shelf' })).toHaveCount(0);
  assertNoPageErrors();
});

test('Roku visual contract keeps fixed geometry, focus ownership and proportional TV scaling', async ({ page }, testInfo) => {
  const platform = testInfo.project.name as 'tizen' | 'vizio';
  const assertNoPageErrors = await installPlatformRuntime(page);
  await enterHome(page, platform);
  await expectBox(page, '.tv-screen', { x: 0, y: 0, width: 1280, height: 720 });
  await expectBox(page, 'nav', { x: 21, y: 108, width: 60 });
  await page.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Switch profile', exact: true }).focus();
  await expectBox(page, '.settings-scroll', { x: 100, y: 144, width: 536 });
  await expectBox(page, '.settings-description', { x: 778, y: 152, width: 424 });
  await capture(page, testInfo, 'roku-settings-focused');
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expectBox(page, '.settings-scroll', { x: 150, y: 216, width: 804 });
  await expect(page.getByRole('button', { name: 'Switch profile', exact: true })).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Search', exact: true }).press('Enter');
  await page.locator('[data-focus-id="key-A"]').focus();
  await expectBox(page, '.search .keyboard>div', { x: 102, y: 226, width: 300 });
  await expectBox(page, '.search .result-grid', { x: 456, y: 164, width: 740, height: 484 });
  await capture(page, testInfo, 'roku-search-empty');
  await page.getByRole('button', { name: 'Profile', exact: true }).press('Enter');
  await expectBox(page, '.profiles>h1', { x: 100, y: 146, width: 1080 });
  await expectBox(page, '.profile-row', { x: 0, y: 252, width: 1280 });
  await capture(page, testInfo, 'roku-profiles');
  assertNoPageErrors();
});

test('series progress selects its resumed episode and remote paging reveals one complete row', async ({ page }, testInfo) => {
  const platform = testInfo.project.name as 'tizen' | 'vizio';
  await installPlatformRuntime(page);
  await installBackend(page);
  const show = { id: 'tt-progress-show', type: 'series', name: 'Progress Show', title: 'Progress Show', background: '/background.jpg' };
  await page.route(`${apiOrigin}/api/catalogs`, route => json(route, [{ id: 'shows', name: 'Shows', type: 'series', addon_id: 2, supports_search: true, supports_skip: true }]));
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { metas: [show], has_more: false }));
  await page.route(`${apiOrigin}/api/meta/series/tt-progress-show`, route => json(route, { meta: { ...show, videos: Array.from({ length: 8 }, (_, i) => ({ id: `tt-progress-show:1:${i + 1}`, title: `Episode ${i + 1}`, season: 1, episode: i + 1, thumbnail: '/background.jpg', description: `Synopsis for episode ${i + 1}.` })) } }));
  await page.route(`${apiOrigin}/api/profiles/1/progress/series**`, route => json(route, [
    { id: 'tt-progress-show:1:1', type: 'series', name: 'Episode 1', season: 1, episode: 1, position: 120, duration: 120, watched: true, series_id: 'tt-progress-show' },
    { id: 'tt-progress-show:1:2', type: 'series', name: 'Episode 2', season: 1, episode: 2, position: 42, duration: 120, watched: false, series_id: 'tt-progress-show', source_fingerprint: 'resume-fingerprint', source_addon_id: 'addon:2' },
  ]));
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await page.goto(`/?platform=${platform}`);
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Progress Show', exact: true }).press('Enter');
  await expect(page.locator('[data-focus-id="episode-1"]')).toBeFocused();
  await expect(page.locator('[data-focus-id="episode-0"]')).toContainText('WATCHED');
  await expect(page.locator('[data-focus-id="episode-0"] progress')).toHaveCount(0);
  await expect(page.locator('[data-focus-id="episode-1"] progress')).toHaveAttribute('value', '42');
  await expectBox(page, '.episode-grid', { x: 112, y: 262, width: 1096, height: 330 });
  await capture(page, testInfo, 'roku-series-progress');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-focus-id="episode-5"]')).toBeFocused();
  await expectBox(page, '[data-focus-id="episode-5"]', { x: 392, y: 262, width: 256, height: 330 });
  await expectBox(page, '.tv-screen', { x: 0, y: 0, width: 1280, height: 720 });
});

test('restores a remembered profile without flashing pairing and retains Home after reload', async ({ page }) => {
  await installBackend(page);
  await page.addInitScript(({ origin }) => {
    if (!localStorage.getItem(`viptv-device:${origin}`)) localStorage.setItem(`viptv-device:${origin}`, JSON.stringify({ sessionId:'fixture',accountId:'7',profileId:'1',accessToken:'access',refreshToken:'refresh',expiresIn:900 }));
    (window as unknown as { pairingFlashed:boolean }).pairingFlashed=false;
    new MutationObserver(() => {
      if(document.body?.textContent?.includes('Sign in to VIPTV')) (window as unknown as { pairingFlashed:boolean }).pairingFlashed=true;
    }).observe(document,{childList:true,subtree:true});
  }, { origin:apiOrigin });
  await page.goto('/?platform=vizio');
  await expect(page.locator('.media-card').first()).toBeVisible();
  await expect(page.locator('.profiles')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.media-card').first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as {pairingFlashed:boolean}).pairingFlashed)).toBe(false);
});

test('profile artwork remains concentric with its focus outline at TV and desktop sizes', async ({ page }) => {
  await installBackend(page);
  await page.addInitScript(({ origin }) => localStorage.setItem(`viptv-device:${origin}`,JSON.stringify({sessionId:'fixture',accountId:'7',profileId:null,accessToken:'access',refreshToken:'refresh',expiresIn:900})),{origin:apiOrigin});
  await page.goto('/?platform=vizio');
  const card=page.locator('[data-focus-id="profile-0"]');
  await expect(card).toBeVisible();
  for (const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
    await page.setViewportSize(viewport);
    await card.focus();
    await expect(async()=> {
      const delta=await card.evaluate(element=>{
        const b=element.getBoundingClientRect(); const img=element.querySelector('img')!.getBoundingClientRect();
        const ring=getComputedStyle(element,'::after'); const scale=b.width/(element as HTMLElement).offsetWidth;
        return {x:img.x+img.width/2-(b.x+(parseFloat(ring.left)+parseFloat(ring.width)/2)*scale),y:img.y+img.height/2-(b.y+(parseFloat(ring.top)+parseFloat(ring.height)/2)*scale)};
      });
      expect(Math.abs(delta.x)).toBeLessThan(1);expect(Math.abs(delta.y)).toBeLessThan(1);
    }).toPass();
  }
});
