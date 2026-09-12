import { expect, test, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const profile = { id: '1', name: 'Alex', setup_complete: true, avatar: 'critters-1.png' };
const movie = { id: 'tt-movie', type: 'movie', name: 'Moonfall', title: 'Moonfall', poster: '/poster.jpg', background: '/background.jpg', description: 'A fixture movie.', year: 2026, genres: ['Drama'] };
const episode = { id: 'tt-show:1:2', title: 'The Signal', name: 'The Signal', season: 1, episode: 2, description: 'Episode fixture.' };
const channel = { id: 'family-news', type: 'live', name: 'Family News', poster: '/news.png' };

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installBackend(page: Page) {
  await page.route(`${apiOrigin}/api/**`, async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [profile], profile_id: null, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') return json(route, { profile_id: '1' });
    if (path === '/api/auth/device/code') return json(route, { device_code: 'opaque-pairing-code', user_code: 'AB12CD34EF', verification_uri: 'https://viptv.syek.tech/device', verification_uri_complete: 'https://viptv.syek.tech/device?code=AB12CD34EF', qr_uri: 'https://viptv.syek.tech/api/auth/device/qr?code=AB12CD34EF', expires_in: 600, interval: 60 });
    if (path === '/api/auth/device/token') return json(route, { error: 'authorization_pending' }, 400);
    if (path === '/api/profiles/1/continue/page') return json(route, { items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' && route.request().method() === 'GET') return json(route, []);
    if (path === '/api/profiles/1/favorites' && route.request().method() === 'GET') return json(route, []);
    if (path === '/api/profiles/1/preferences') return json(route, { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true });
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
    if (path === '/api/playback' || path.includes('/heartbeat') || path.includes('/progress') || path.includes('/continue/') || path.includes('/preferences')) return json(route, { ok: true });
    return json(route, { error: `unhandled ${path}` }, 404);
  });
}

test('renders the real device-pairing handoff without storing a token before approval', async ({ page }) => {
  await installBackend(page);
  await page.goto('/?platform=tizen');
  await expect(page.getByRole('heading', { name: 'Link your TV' })).toBeVisible();
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Scan to link your TV' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).press('Enter');
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
});

async function enterHome(page: Page, platform: 'tizen' | 'vizio') {
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.goto(`/?platform=${platform}`);
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Moonfall' })).toBeVisible();
}

for (const platform of ['tizen', 'vizio'] as const) {
  test(`${platform}: remote flow retains shared pairing-derived profile, browse, source and guide behavior`, async ({ page }) => {
    test.skip(test.info().project.name !== platform, 'run each platform query in its matching project');
    await enterHome(page, platform);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Moonfall' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Moonfall' })).toBeVisible();
    await page.getByRole('button', { name: 'Play' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Moonfall' })).toBeVisible();
    await expect(page.getByText('Moonfall 1080p')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Live TV' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Live TV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'News Now' })).toBeVisible();

    await page.getByRole('button', { name: 'Search' }).press('Enter');
    const search = page.getByRole('textbox', { name: 'Search titles' });
    await search.fill('moon');
    await expect(page.getByRole('button', { name: 'Moonfall' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).press('Enter');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByRole('button', { name: /Autoplay next episode/ }).press('Enter');
  });
}

test('shows a sanitized backend failure and lets the remote dismiss it', async ({ page }) => {
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { error: 'https://upstream.invalid/secret' }, 502));
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('alert')).toHaveText(/VIPTV could not complete that request/);
  await expect(page.getByRole('alert')).not.toContainText('upstream.invalid');
  await page.getByRole('button', { name: 'Dismiss' }).press('Enter');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('does not let a slow obsolete browse response replace the current search results', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Search' }).press('Enter');
  await page.getByRole('textbox', { name: 'Search titles' }).fill('fresh');
  await expect(page.getByRole('button', { name: 'Fresh result' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Obsolete shelf' })).toHaveCount(0);
});
