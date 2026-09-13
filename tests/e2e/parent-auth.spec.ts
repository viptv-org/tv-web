import { expect, test, type Page, type Route } from '@playwright/test';

const apiOrigin = 'https://viptv.syek.tech';
const key = `viptv-device:${apiOrigin}`;
const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:4173',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};
const token = { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 };
const preferences = { audio_language: 'en', subtitle_language: 'en', subtitles_enabled: false, subtitle_size: 'normal', subtitle_style: 'system', quality: 'auto', autoplay: true };
type State = { unlocked: boolean; profileAttempts: number; logoutAttempts: number; unlockAttempts: number };

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
}

async function installSession(page: Page) {
  await page.addInitScript(({ storedKey, storedToken }) => localStorage.setItem(storedKey, JSON.stringify(storedToken)), { storedKey: key, storedToken: token });
}

async function installBackend(page: Page): Promise<State> {
  const state: State = { unlocked: false, profileAttempts: 0, logoutAttempts: 0, unlockAttempts: 0 };
  let selectedProfileId: string | null = null;
  await page.route(`${apiOrigin}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (/^\/api\/profiles\/[^/]+\/progress\/series$/.test(path)) return json(route, []);
    const body = JSON.parse(request.postData() || '{}') as { profile_id?: string; pin?: string };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path === '/api/auth/me') return json(route, {
      account: { id: '7', username: 'alex', name: 'Alex', role: 'member' },
      profiles: [{ id: '1', name: 'Alex', setup_complete: true }, { id: '2', name: 'Kids', kids: true, setup_complete: true }],
      profile_id: selectedProfileId, restricted: false, profile_setup_required: false,
    });
    if (path === '/api/auth/profile') {
      state.profileAttempts += 1;
      if (body.profile_id === '2' && !state.unlocked) return json(route, { error: 'parent PIN required' }, 403);
      selectedProfileId = body.profile_id ?? null;
      return json(route, { profile_id: selectedProfileId });
    }
    if (path === '/api/parent/unlock') {
      state.unlockAttempts += 1;
      if (body.pin !== '1234') return json(route, { error: 'incorrect PIN' }, 403);
      state.unlocked = true;
      return json(route, { unlocked: true });
    }
    if (path === '/api/auth/logout') {
      state.logoutAttempts += 1;
      if (!state.unlocked) return json(route, { error: 'parent PIN required' }, 403);
      return json(route, { ok: true });
    }
    if (path === '/api/profiles/2/continue/page' || path === '/api/profiles/1/continue/page') return json(route, { items: [], offset: 0, total: 0, next_offset: null });
    if (path === '/api/profiles/2/progress' || path === '/api/profiles/1/progress' || path === '/api/profiles/2/favorites' || path === '/api/profiles/1/favorites') return json(route, []);
    if (path === '/api/profiles/2/preferences' || path === '/api/profiles/1/preferences') return json(route, preferences);
    if (path === '/api/catalogs') return json(route, [{ id: 'movies', name: 'Movies', type: 'movie', addon_id: 2, supports_search: true, supports_skip: true }]);
    if (path === '/api/discover') return json(route, { metas: [], has_more: false, next_skip: null });
    if (path === '/api/live/categories') return json(route, { categories: [], total: 0 });
    if (path === '/api/addons') return json(route, []);
    if (path === '/api/auth/device/code') return json(route, { device_code: 'pair', user_code: 'AB12CD34EF', verification_uri: 'https://viptv.syek.tech/device', verification_uri_complete: 'https://viptv.syek.tech/device?code=AB12CD34EF', qr_uri: 'https://viptv.syek.tech/api/auth/device/qr?code=AB12CD34EF', expires_in: 600, interval: 60 });
    if (path === '/api/auth/device/token') return json(route, { error: 'authorization_pending' }, 400);
    return json(route, { error: `unhandled ${path}` }, 404);
  });
  return state;
}

async function pairedProfiles(page: Page) {
  await page.goto('/?platform=vizio');
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
}

test('Vizio: protected profile selection cancels without losing the grant and retries after an approved PIN', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the shared parent gate needs one hosted-TV contract run');
  await installSession(page);
  const state = await installBackend(page);
  await pairedProfiles(page);

  await page.getByRole('button', { name: 'Kids' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Enter parent PIN' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  expect(await page.evaluate(storedKey => localStorage.getItem(storedKey), key)).toBe(JSON.stringify(token));
  expect(state.profileAttempts).toBe(1);

  await page.getByRole('button', { name: 'Kids' }).press('Enter');
  await page.getByLabel('Enter parent PIN', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Home' })).toBeVisible();
  expect(state.unlockAttempts).toBe(1);
  expect(state.profileAttempts).toBe(3);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Vizio: protected sign-out preserves the grant on cancel and clears it only after unlock and retry', async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'the same protected action contract applies to sign-out');
  await installSession(page);
  const state = await installBackend(page);
  await pairedProfiles(page);
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  await page.getByRole('button', { name: 'Settings' }).click();

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await expect(page.getByRole('heading', { name: 'Enter parent PIN to sign out' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(await page.evaluate(storedKey => JSON.parse(localStorage.getItem(storedKey) ?? 'null'), key)).toMatchObject({ accessToken: token.accessToken, refreshToken: token.refreshToken, profileId: '1' });
  expect(state.logoutAttempts).toBe(1);

  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.getByRole('button', { name: 'Sign out' }).last().click();
  await page.getByLabel('Enter parent PIN to sign out', { exact: true }).fill('1234');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to VIPTV' })).toBeVisible();
  expect(state.unlockAttempts).toBe(1);
  // First protected request was cancelled; the second is retried after unlock.
  expect(state.logoutAttempts).toBe(3);
  expect(await page.evaluate(storedKey => localStorage.getItem(storedKey), key)).toBeNull();
});
