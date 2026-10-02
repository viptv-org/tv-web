import { expect, test, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const cors = {
  'access-control-allow-origin': process.env.VIPTV_TEST_BROWSER_ORIGIN ?? 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};
const profile = { id: '1', name: 'Alex', setup_complete: true };
const movie = { id: 'resilient-movie', type: 'movie', name: 'Resilient Movie', title: 'Resilient Movie', description: 'Fixture detail.', poster: '/fixture.svg' };
const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
type State = { readonly calls: Array<{ path: string; method: string; body: Record<string, unknown> }>; readonly addons: Array<Record<string, unknown>> };

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
}

async function installSession(page: Page) {
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), {
    key: `viptv-device:${apiOrigin}`,
    token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 },
  });
}

async function installBackend(page: Page): Promise<State> {
  const state: State = { calls: [], addons: [{ id: 2, name: 'Fixture add-on', enabled: true }, { id: 3, name: 'Other provider', enabled: true }] };
  await page.route('**/fixture.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" />' }));
  let selectedProfileId: string | null = null;
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname);
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (!['GET', 'OPTIONS'].includes(request.method())) state.calls.push({ path, method: request.method(), body });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [profile], profile_id: selectedProfileId, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') {
      selectedProfileId = String(route.request().postDataJSON().profile_id);
      return json(route, { profile_id: selectedProfileId });
    }
    if (path === '/api/auth/logout') return json(route, { ok: true });
    if (path === '/api/auth/device/code') return json(route, { device_code: 'code', user_code: 'AB12CD34EF', verification_uri: 'https://viptv.syek.tech/device', verification_uri_complete: 'https://viptv.syek.tech/device?code=AB12CD34EF', qr_uri: 'https://viptv.syek.tech/api/auth/device/qr?code=AB12CD34EF', expires_in: 600, interval: 60 });
    if (path === '/api/auth/device/token') return json(route, { error: 'authorization_pending' }, 400);
    if (path === '/api/profiles/1/continue/page') return json(route, { items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/1/progress' || path === '/api/profiles/1/favorites') return json(route, []);
    if (path === '/api/profiles/1/preferences') return json(route, preferences);
    if (path === '/api/catalogs') return json(route, [
      { id: 'working', name: 'Working catalog', type: 'movie', addon_id: 2, supports_search: true, supports_skip: true },
      { id: 'offline', name: 'Offline catalog', type: 'movie', addon_id: 3, supports_search: true, supports_skip: true },
    ]);
    if (path === '/api/discover') {
      const catalog = new URL(request.url()).searchParams.get('catalog');
      if (catalog === 'offline') return json(route, { error: 'upstream secret URL' }, 502);
      return json(route, { metas: [movie], has_more: false, next_skip: null });
    }
    if (path === `/api/meta/movie/${movie.id}`) return json(route, { meta: movie });
    if (path === '/api/v2/streams' && request.method() === 'POST') return json(route, { id: 'sources' });
    if (path === '/api/v2/streams/sources') return json(route, { events: [
      { seq: 1, source: 'addon:2', streams: [{ id: 'good-1080', name: 'Good source', title: '1080p H.264 English', filename: 'good.mkv', source_addon_id: 'addon:2', source_name: 'Fixture provider', source_quality: '1080p' }] },
      { seq: 2, source: 'addon:3', streams: [{ id: 'other-720', name: 'Other source', title: '720p H.264 English', filename: 'other.mkv', source_addon_id: 'addon:3', source_name: 'Other provider', source_quality: '720p' }] },
    ], done: true });
    if (path === '/api/live/categories') return json(route, { categories: [], total: 0 });
    if (path === '/api/addons' && request.method() === 'GET') return json(route, state.addons);
    if (path === '/api/addons' && request.method() === 'POST') {
      state.addons.push({ id: 3, name: 'Installed add-on', enabled: true });
      return json(route, state.addons.at(-1));
    }
    if (path === '/api/addons/2' && request.method() === 'PATCH') {
      Object.assign(state.addons[0], body);
      return json(route, state.addons[0]);
    }
    if (path === '/api/addons/2' && request.method() === 'DELETE') {
      state.addons.splice(0, 1);
      return json(route, { ok: true });
    }
    return json(route, { error: `unhandled ${path}` }, 404);
  });
  return state;
}

async function enterHome(page: Page) {
  await page.goto('/?renderer=react&platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
}

test('Vizio: cross-catalog search retains working rows and names a partial failure', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the shared search controller needs one browser contract run');
  await installSession(page);
  await installBackend(page);
  await enterHome(page);
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('textbox', { name: 'Search titles' }).fill('resilient');
  await expect(page.getByRole('button', { name: 'Resilient Movie' })).toBeVisible();
  // Results group by type (TvSearch "Movies  N results"): the working catalog's title is the
  // one movie; the failed catalog adds nothing and is named by the partial notice below.
  const results = page.locator('.vx-browse__results');
  await expect(results.getByRole('heading', { name: 'Movies', exact: true })).toBeVisible();
  await expect(results).toContainText('1 result');
  await expect(page.getByText("Some sources couldn't load.")).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Vizio: an empty source filter restores filter focus and source hold exposes safe detail text', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'source filtering and hold behavior share the React surface');
  await installSession(page);
  await installBackend(page);
  await enterHome(page);
  await page.getByRole('button', { name: 'Resilient Movie' }).press('Enter');
  await page.locator('[data-focus-id="detail-source"]').press('Enter');
  const firstSource = page.locator('[data-focus-id="source-0"]');
  await expect(firstSource).toBeVisible();
  await firstSource.click({ button: 'right' });
  await expect(page.getByRole('heading', { name: 'Source details' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Source details' })).toContainText('good.mkv');
  await page.keyboard.press('Escape');
  await expect(firstSource).toBeVisible();

  await page.getByRole('button', { name: /^1080p/ }).first().click();
  await page.getByRole('button', { name: 'All providers' }).click();
  await page.getByRole('button', { name: 'Other provider' }).click();
  await expect(page.getByText('No matching sources')).toBeVisible();
  await expect(page.getByText('Choose another provider or quality.')).toBeVisible();
  await expect.poll(() => page.locator('[data-focus-id="source-provider"]').evaluate(element => document.activeElement === element)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Vizio: observed add-ons stay distinct when two return no playable formats', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'source producer outcomes share the React picker');
  await installSession(page);
  const state = await installBackend(page);
  state.addons.splice(0, state.addons.length,
    { id: 3, name: 'Torrentio', enabled: true },
    { id: 4, name: 'TorrentsDB', enabled: true },
    { id: 8, name: 'Torrentio TB', enabled: true });
  await page.route(`${apiOrigin}/api/v2/streams/sources**`, route => {
    const after = Number(new URL(route.request().url()).searchParams.get('after') ?? 0);
    return json(route, after ? { events: [
      { seq: 2, source: 'addon:3', streams: [], error_code: 'source_format_unsupported' },
      { seq: 3, source: 'addon:4', streams: [], error_code: 'source_format_unsupported' },
    ], done: true } : { events: [{ seq: 1, source: 'addon:8', streams: [
      { id: 'http-source', name: 'HTTP stream', title: '1080p stream', source_addon_id: 'addon:8', source_name: 'Torrentio TB', source_quality: '1080p' },
    ] }], done: false });
  });
  await enterHome(page);
  await page.getByRole('button', { name: 'Resilient Movie' }).press('Enter');
  await page.locator('[data-focus-id="detail-source"]').press('Enter');
  const playable = page.locator('[data-focus-id="source-0"]');
  await expect(playable).toBeVisible();
  await playable.focus();
  await expect(page.getByText('Still checking sources')).toBeVisible();
  await expect(page.locator('[data-focus-id="source-provider"]')).toContainText('All providers');
  await expect(page.getByText('Still checking sources')).toHaveCount(0);
  await expect(playable).toBeVisible();
  await expect(playable).toBeFocused();
  await page.getByRole('button', { name: 'All providers' }).click();
  await expect(page.getByRole('button', { name: 'Torrentio TB', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Torrentio · No playable sources$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^TorrentsDB · No playable sources$/ })).toBeVisible();
  await page.getByRole('button', { name: /^Torrentio · No playable sources$/ }).click();
  await expect(page.getByText(/Torrentio returned formats this app cannot play/)).toBeVisible();
  await page.screenshot({ path: 'test-results/source-providers-zero-result.png' });
  await page.getByRole('button', { name: 'Torrentio', exact: true }).click();
  await page.getByRole('button', { name: 'Torrentio TB', exact: true }).click();
  await expect(playable).toBeVisible();
});

test('Vizio: an open provider menu gains seven late add-ons without moving focus or losing source details', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio');
  await installSession(page);
  const state = await installBackend(page);
  state.addons.splice(0, state.addons.length,
    { id: 8, name: 'Playable add-on', enabled: true },
    ...Array.from({ length: 7 }, (_, index) => ({ id: index + 1, name: `Provider ${index + 1}`, enabled: true })));
  await page.route(`${apiOrigin}/api/v2/streams/sources**`, async route => {
    const after = Number(new URL(route.request().url()).searchParams.get('after') ?? 0);
    if (after) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return json(route, { events: Array.from({ length: 7 }, (_, index) => ({
        seq: index + 2, source: `addon:${index + 1}`, streams: [], error_code: 'source_format_unsupported',
      })), done: true });
    }
    return json(route, { events: [{ seq: 1, source: 'addon:8', streams: [
      { id: 'with-description', name: 'Visible name', title: 'Visible title', description: 'Distinct torrent description', filename: 'file.mkv', source_addon_id: 'addon:8', source_quality: '1080p' },
    ] }], done: false });
  });
  await enterHome(page);
  await page.getByRole('button', { name: 'Resilient Movie' }).press('Enter');
  await page.locator('[data-focus-id="detail-source"]').press('Enter');
  const row = page.locator('[data-focus-id="source-0"]');
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'All providers' }).click();
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  await cancel.focus();
  await expect(page.getByRole('button', { name: /^Provider 7 · No playable sources$/ })).toBeVisible();
  await expect(cancel).toBeFocused();
  await page.getByRole('button', { name: /^Provider 7 · No playable sources$/ }).click();
  await expect(page.getByText(/Provider 7 returned formats this app cannot play/)).toBeVisible();
  await page.getByRole('button', { name: 'Provider 7', exact: true }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(row).toHaveAttribute('aria-label', /Distinct torrent description/);
  await row.click({ button: 'right' });
  await expect(page.getByRole('dialog', { name: 'Source details' })).toContainText('Distinct torrent description');
});

test('Vizio: settings persist an add-on draft, enable/remove an extension, and sign out', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'settings mutations use the same hosted-TV client');
  await installSession(page);
  const state = await installBackend(page);
  await enterHome(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  // TvSettings order: the profile rows, Playback preferences, Addons and About, then Sign out.
  const rows = page.locator('.vx-settings-tv__rows').getByRole('button');
  await expect(rows).toHaveText([
    'Switch profile', 'Playback preferences', 'Manage profiles', 'Addons', 'About VIPTV', 'Sign out',
  ]);
  await page.getByRole('button', { name: 'Playback preferences', exact: true }).click();
  // Sub-page rows read their current value after the title (TvPlayback).
  await expect(rows).toContainText([
    'Preferred audio', 'Preferred subtitles', 'Start with subtitles', 'Subtitle size', 'Subtitle appearance',
  ]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Playback preferences', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Addons', exact: true }).click();
  const fixtureAddon = page.getByRole('button', { name: /^Fixture add-on/ });
  await expect(fixtureAddon).toBeVisible();
  await fixtureAddon.click();
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect.poll(() => state.addons[0]?.enabled).toBe(false);
  await fixtureAddon.focus();
  await expect(page.locator('.vx-tv-description')).toContainText('Disabled');

  await page.getByRole('button', { name: 'Install addon' }).click();
  await page.getByRole('textbox', { name: 'Install addon manifest URL' }).fill('https://addons.example.test/manifest.json');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Installed add-on/ })).toBeVisible();

  await fixtureAddon.click();
  await page.getByRole('button', { name: 'Remove addon', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Remove Fixture add-on?' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(fixtureAddon).toHaveCount(0);
  expect(state.calls).toContainEqual({ path: '/api/addons/2', method: 'PATCH', body: { enabled: false } });
  expect(state.calls).toContainEqual({ path: '/api/addons', method: 'POST', body: { manifest_url: 'https://addons.example.test/manifest.json' } });
  expect(state.calls).toContainEqual({ path: '/api/addons/2', method: 'DELETE', body: {} });

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Addons', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await expect(page.getByRole('heading', { name: 'Sign in to VIPTV' })).toBeVisible();
  expect(state.calls).toContainEqual({ path: '/api/auth/logout', method: 'POST', body: {} });
});
