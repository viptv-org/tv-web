import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { apiOrigin, capture, corsHeaders, enterHome, episode, expectBox, fixtureImage, installBackend, installPlatformRuntime, json, movie, profile, channel, type ProfileFixture } from './helpers/tvShellRuntime';


test('renders the real device-pairing handoff without storing a token before approval', async ({ page }, testInfo) => {
  const assertNoPageErrors = await installPlatformRuntime(page);
  await installBackend(page);
  await page.goto('/?platform=tizen');
  await expect(page.getByRole('heading', { name: 'Sign in to VIPTV' })).toBeVisible();
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Scan to link your TV' })).toBeVisible();
  // TvPairing: the title opens the text column at 192 / 250 (1920 × 1080 canvas).
  await expectBox(page, '.vx-pairing__title', { x: 192, y: 250 });
  await capture(page, testInfo, 'pairing');
  await page.getByRole('button', { name: 'Try again' }).press('Enter');
  await expect(page.getByText('AB12CD34EF')).toBeVisible();
  assertNoPageErrors();
});


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
  await page.getByRole('button', { name: 'Creatures 2' }).click();
  await expect(page.getByRole('button', { name: 'Profile name: empty' })).toBeVisible();
  await page.locator('[data-focus-id="profile-name"]').click();
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
  await expect(page.getByRole('heading', { name: 'Enter parent PIN' })).toBeVisible();
  await page.getByLabel('Enter parent PIN', { exact: true }).fill('1234');
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

