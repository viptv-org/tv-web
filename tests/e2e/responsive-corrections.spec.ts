import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installBackend, apiOrigin, sessionKey, movie } from './helpers/responsiveBackend';
const cors = { 'access-control-allow-origin': 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, content-type, x-csrf-token', 'access-control-allow-methods': 'GET, POST, OPTIONS, DELETE' };

for (const width of [390, 1440]) test(`website sign-in is centered and signs in with recoverable errors at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await installBackend(page);
  await page.addInitScript(key => localStorage.removeItem(key), sessionKey);
  let approved = false;
  await page.route(`${apiOrigin}/api/auth/device/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (path.endsWith('/code')) return route.fulfill({ json: { device_code: 'device-code', user_code: 'ABCDEF', verification_uri: `${apiOrigin}/`, verification_uri_complete: `${apiOrigin}/?code=ABCDEF`, qr_uri: `${apiOrigin}/api/auth/device/qr?code=ABCDEF`, expires_in: 600, interval: 1 }, headers: cors });
    if (path.endsWith('/approve')) { approved = true; expect(route.request().headers()['x-csrf-token']).toBe('test-csrf'); return route.fulfill({ json: { approved: true }, headers: cors }); }
    return route.fulfill({ status: approved ? 200 : 400, json: approved ? { session_id: 's1', account_id: '7', access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 900 } : { error: 'authorization_pending' }, headers: cors });
  });
  await page.route(`${apiOrigin}/api/auth/login`, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const okay = route.request().postDataJSON().password === 'correct-password';
    return route.fulfill({ status: okay ? 200 : 401, json: okay ? { csrf_token: 'test-csrf' } : { error: 'unauthorized' }, headers: cors });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to viptv' })).toBeVisible();
  const bounds = await page.locator('.responsive-auth-card').boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - 450)).toBeLessThan(2);
  await page.getByLabel('Username', { exact: true }).fill('alex');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incorrect');
  expect(approved).toBe(false);
  await page.getByLabel('Password', { exact: true }).fill('correct-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: "Who's watching?" })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), sessionKey)).not.toContain('password');
});

for (const width of [390, 1440]) test(`guide has native scrolling and pinned channel labels at ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await installBackend(page);
  const now = Math.floor(Date.now() / 1000);
  await page.route(`${apiOrigin}/api/live**`, async route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ headers: cors, json: path.endsWith('/categories') ? { categories: [{ id: 'news', name: 'News', count: 40 }], total: 1 } : { channels: Array.from({ length: 40 }, (_, i) => ({ id: `channel-${i}`, name: `Channel ${i + 1}`, type: 'live' })), total: 40 } });
  });
  await page.route(`${apiOrigin}/api/guide/**`, route => route.fulfill({ headers: cors, json: { programs: [{ title: 'Current programme', start: now - 1800, end: now + 1800 }, { title: 'Later programme', start: now + 1800, end: now + 7200 }], timezone: 'UTC' } }));
  await page.goto('/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();
  const scroll = page.getByRole('region', { name: 'Scrollable programme guide' });
  await expect(scroll).toBeVisible();
  await expect(page.locator('.epg-row')).toHaveCount(40);
  if (width < 900) await expect(page.getByRole('combobox', { name: 'Channel category' })).toBeVisible();
  else await expect(page.locator('.epg-categories')).toBeVisible();
  const original = await page.locator('.epg-channel').first().boundingBox();
  await scroll.hover(); await page.mouse.wheel(450, 420);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  const pinned = await page.locator('.epg-channel').first().boundingBox();
  expect(Math.abs(pinned!.x - original!.x)).toBeLessThan(2);
  const header = await page.locator('.epg-time-header').boundingBox();
  const scroller = await scroll.boundingBox();
  expect(Math.abs(header!.y - scroller!.y)).toBeLessThan(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath(`guide-${width}.png`) });
});

test('website fullscreen, volume and backend info operate on a decoded player', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page);
  // Exercise native fallback controls; MediaBunny decoding has its separate real-media probe.
  await page.addInitScript(() => { Object.defineProperty(window, 'VideoDecoder', { value: undefined }); });
  await page.route(`${apiOrigin}/api/playback**`, route => route.fulfill({ headers: cors, json: route.request().method() === 'POST' ? { id: 'controls', url: '/media/controls/test/index.m3u8', mode: 'remux', format: 'hls', video_mode: 'copy', audio_mode: 'copy', duration: 5 } : {} }));
  await page.route(`${apiOrigin}/media/controls/test/**`, async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const file = name === 'index.m3u8' ? name : name.replace('.ts', '.bin');
    await route.fulfill({ headers: cors, contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t', body: await readFile(new URL(`../fixtures/hls/${file}`, import.meta.url)) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.getByRole('button', { name: 'Choose source', exact: true }).click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('slider', { name: 'Volume', exact: true }).evaluate((node: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0.35'); node.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.volume)).toBeCloseTo(.35);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);
  await page.getByRole('slider', { name: 'Volume', exact: true }).evaluate((node: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0.55'); node.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.muted)).toBe(false);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
  await expect(page.locator('.player-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Playback info', exact: true }).click();
  const info = page.getByRole('dialog', { name: 'Playback info', exact: true });
  await expect(info).toContainText('browser-proxy');
  await expect(info).toContainText('remux');
  await expect(info).not.toContainText('/media/');
  await expect(info).toContainText(/Decoder: (native-html|hls\.js)/);
});

test('Discover keeps all addon namespaces and loads despite an unrelated Home failure', async ({ page }) => {
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => route.fulfill({ status: 503, json: { error: 'temporary outage' }, headers: cors }));
  await page.route(`${apiOrigin}/api/catalogs`, route => route.fulfill({ headers: cors, json: [
    { id: 'popular', name: 'Popular', type: 'movie', addon_id: 1, addon_name: 'Cinemeta' },
    { id: 'popular', name: 'Popular', type: 'movie', addon_id: 2, addon_name: 'AIOMetadata' },
    { id: 'anime', name: 'Anime', type: 'anime', addon_id: 2, addon_name: 'AIOMetadata' },
  ] }));
  await page.goto('/'); await page.getByRole('button', { name: 'Alex' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  if (await page.getByRole('button', { name: 'Dismiss', exact: true }).isVisible()) await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Discover', exact: true }).click();
  await page.locator('[data-focus-id="discover-catalog"]').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Cinemeta · Popular', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'AIOMetadata · Popular', exact: true }).click();
  await page.locator('[data-focus-id="discover-type"]').click();
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/discover' && new URL(request.url()).searchParams.get('type') === 'anime');
  await page.getByRole('dialog').getByRole('button', { name: 'Anime', exact: true }).click();
  const selected = new URL((await request).url());
  expect(selected.searchParams.get('addon_id')).toBe('2');
  await expect(page.locator('[data-focus-id="discover-catalog"]')).toContainText('AIOMetadata · Anime');
});
