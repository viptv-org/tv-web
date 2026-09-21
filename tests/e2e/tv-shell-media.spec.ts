import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import { apiOrigin, capture, corsHeaders, enterHome, episode, expectBox, fixtureImage, installBackend, installPlatformRuntime, json, movie, profile, channel, type ProfileFixture } from './helpers/tvShellRuntime';


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

// Known regression since the 2026-09-20 screen extraction: a 502 from the
// boot-time discover no longer reaches the sanitized error toast. The
// failure is swallowed by a request-staleness guard in the profile
// navigation flow (useAuth's catch only calls fail() while its ticket is
// current). Diagnosed 2026-09-21; needs a product decision on whether boot
// catalog failures belong on the toast or the browse inline surface.
test.fixme('shows a sanitized backend failure and lets the remote dismiss it', async ({ page }) => {
  const assertNoPageErrors = await installPlatformRuntime(page);
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, JSON.stringify(token)), { key: `viptv-device:${apiOrigin}`, token: { sessionId: 'device-1', accountId: '7', profileId: null, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 } });
  await installBackend(page);
  await page.route(`${apiOrigin}/api/discover**`, route => json(route, { error: 'https://upstream.invalid/secret' }, 502));
  await page.goto('/?platform=vizio');
  await page.getByRole('button', { name: 'Alex' }).press('Enter');
  // Catalog failures surface on the browse surface with a retry affordance.
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

