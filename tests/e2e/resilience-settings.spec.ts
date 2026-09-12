import { expect, test, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
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
  const state: State = { calls: [], addons: [{ id: 2, name: 'Fixture add-on', enabled: true }] };
  await page.route('**/fixture.svg', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="144" />' }));
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const path = decodeURIComponent(new URL(request.url()).pathname);
    const body = JSON.parse(request.postData() || '{}') as Record<string, unknown>;
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (!['GET', 'OPTIONS'].includes(request.method())) state.calls.push({ path, method: request.method(), body });
    if (path === '/api/auth/me') return json(route, { account: { id: '7', username: 'alex', name: 'Alex', role: 'member' }, profiles: [profile], profile_id: null, restricted: false, profile_setup_required: false });
    if (path === '/api/auth/profile') return json(route, { profile_id: '1' });
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
    if (path === '/api/streams' && request.method() === 'POST') return json(route, { id: 'sources' });
    if (path === '/api/streams/sources') return json(route, { events: [{ seq: 1, source: 'fixture', streams: [
      { id: 'good-1080', name: 'Good source', title: '1080p H.264 English', filename: 'good.mkv', source_addon_id: 'addon:2', source_name: 'Fixture provider', source_quality: '1080p' },
      { id: 'other-720', name: 'Other source', title: '720p H.264 English', filename: 'other.mkv', source_addon_id: 'addon:3', source_name: 'Other provider', source_quality: '720p' },
    ] }], done: true });
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
  await page.goto('/?platform=vizio');
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
  await expect(page.locator('.result-grid')).toContainText('Working catalog');
  await expect(page.locator('.result-grid')).not.toContainText('Offline catalog');
  await expect(page.getByText("Some sources couldn't load.")).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Vizio: an empty source filter restores filter focus and source hold exposes safe detail text', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'source filtering and hold behavior share the React surface');
  await installSession(page);
  await installBackend(page);
  await enterHome(page);
  await page.getByRole('button', { name: 'Resilient Movie' }).press('Enter');
  await page.getByRole('button', { name: 'Play' }).press('Enter');
  const firstSource = page.getByRole('button', { name: 'Good source' });
  await expect(firstSource).toBeVisible();
  await firstSource.click({ button: 'right' });
  await expect(page.getByRole('heading', { name: 'Source details' })).toBeVisible();
  await expect(page.locator('.source-detail-panel')).toContainText('good.mkv');
  await page.keyboard.press('Escape');
  await expect(firstSource).toBeVisible();

  await page.getByRole('button', { name: 'Quality: All' }).click();
  await page.getByRole('button', { name: '1080p', exact: true }).click();
  await page.getByRole('button', { name: 'Provider: All' }).click();
  await page.getByRole('button', { name: 'Other provider' }).click();
  await expect(page.getByText('No matching sources. Choose another provider or quality.')).toBeVisible();
  await expect.poll(() => page.locator('[data-focus-id="source-provider"]').evaluate(element => document.activeElement === element)).toBe(true);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Vizio: settings persist an add-on draft, enable/remove an extension, and sign out', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'settings mutations use the same hosted-TV client');
  await installSession(page);
  const state = await installBackend(page);
  await enterHome(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const fixtureAddon = page.getByRole('button', { name: 'Fixture add-on · Enabled' });
  await expect(fixtureAddon).toBeVisible();
  await fixtureAddon.click();
  await page.getByRole('button', { name: 'Disable' }).click();
  await expect(page.getByRole('button', { name: 'Fixture add-on · Disabled' })).toBeVisible();

  await page.getByRole('button', { name: 'Install add-on' }).click();
  await page.getByRole('textbox', { name: 'Add-on manifest URL' }).fill('https://addons.example.test/manifest.json');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Installed add-on · Enabled' })).toBeVisible();

  await page.getByRole('button', { name: 'Fixture add-on · Disabled' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('heading', { name: /Remove this add-on/ })).toBeVisible();
  await page.getByRole('button', { name: 'Remove add-on' }).click();
  await expect(page.getByRole('button', { name: 'Fixture add-on · Disabled' })).toHaveCount(0);
  expect(state.calls).toContainEqual({ path: '/api/addons/2', method: 'PATCH', body: { enabled: false } });
  expect(state.calls).toContainEqual({ path: '/api/addons', method: 'POST', body: { manifest_url: 'https://addons.example.test/manifest.json' } });
  expect(state.calls).toContainEqual({ path: '/api/addons/2', method: 'DELETE', body: {} });

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await expect(page.getByRole('heading', { name: 'Sign in to VIPTV' })).toBeVisible();
  expect(state.calls).toContainEqual({ path: '/api/auth/logout', method: 'POST', body: {} });
});
