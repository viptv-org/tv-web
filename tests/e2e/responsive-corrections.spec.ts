import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installBackend, apiOrigin, sessionKey, movie } from './helpers/responsiveBackend';
const cors = { 'access-control-allow-origin': process.env.VIPTV_TEST_BROWSER_ORIGIN ?? 'http://127.0.0.1:4173', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'authorization, content-type, x-csrf-token', 'access-control-allow-methods': 'GET, POST, OPTIONS, DELETE' };

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
  await page.goto('/tv/');
  await expect(page.getByRole('heading', { name: 'Sign in to viptv' })).toBeVisible();
  const bounds = await page.locator('.vx-signin__card').boundingBox();
  expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
  // Phones keep the card in the thumb zone, 34 px above the bottom edge (PhSignIn);
  // wider screens centre it (WebSignIn).
  if (width < 600) expect(Math.abs(bounds!.y + bounds!.height - (900 - 34))).toBeLessThan(2);
  else expect(Math.abs(bounds!.y + bounds!.height / 2 - 450)).toBeLessThan(2);
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

for (const width of [768, 1440]) test(`guide has native scrolling and pinned channel labels at ${width}`, async ({ page }, testInfo) => {
  // Phones replace the timeline with a channel list (responsive-layout.spec).
  await page.setViewportSize({ width, height: 900 });
  await installBackend(page);
  const now = Math.floor(Date.now() / 1000);
  await page.route(`${apiOrigin}/api/v2/iptv/live/**`, async route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ headers: cors, json: { catalog_id: 1, generation: 1, next_cursor: null, previous_cursor: null, items: path.endsWith('/categories') ? [{ id: 'news', name: 'News' }] : Array.from({ length: 40 }, (_, i) => ({ id: `channel-${i}`, name: `Channel ${i + 1}`, type: 'live' })) } });
  });
  await page.route(`${apiOrigin}/api/v2/iptv/guide/**`, route => route.fulfill({ headers: cors, json: { programs: [{ title: 'Current programme', start: now - 1800, end: now + 1800 }, { title: 'Later programme', start: now + 1800, end: now + 7200 }], timezone: 'UTC' } }));
  await page.goto('/tv/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();
  const scroll = page.getByRole('region', { name: 'Scrollable programme guide' });
  await expect(scroll).toBeVisible();
  await expect(page.locator('[data-testid^="guide-row-"]')).toHaveCount(40);
  if (width < 900) await expect(page.getByRole('group', { name: 'Channel categories' }).getByRole('button', { name: 'News' })).toBeVisible();
  else await expect(page.locator('.vx-live-cats')).toBeVisible();
  const original = await page.locator('.vx-live-channel').first().boundingBox();
  await scroll.hover(); await page.mouse.wheel(450, 420);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(100);
  await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  const pinned = await page.locator('.vx-live-channel').first().boundingBox();
  expect(Math.abs(pinned!.x - original!.x)).toBeLessThan(2);
  const header = await page.locator('.vx-live-guide__head').boundingBox();
  const scroller = await scroll.boundingBox();
  expect(Math.abs(header!.y - scroller!.y)).toBeLessThan(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath(`guide-${width}.png`) });
});

test('guide category scroll crosses 200 and refetches backward while preserving channel rows', async ({page})=>{
  await page.setViewportSize({width:1440,height:900});
  const backend=await installBackend(page);
  const requests:(string|null)[]=[];
  await page.route(`${apiOrigin}/api/v2/iptv/live/categories?*`,route=>{
    const cursor=new URL(route.request().url()).searchParams.get('cursor'); requests.push(cursor);
    const second=cursor==='next_categories';
    return route.fulfill({headers:cors,json:{catalog_id:1,generation:1,
      items:Array.from({length:second?2:200},(_,index)=>({id:`raw:${index+(second?200:0)}`,name:`Category ${index+(second?201:1)}`})),
      next_cursor:second?null:'next_categories',previous_cursor:second?'previous_categories':null,
    }});
  });
  await page.goto('/tv/'); await page.getByRole('button',{name:'Alex'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Live TV',exact:true}).click();
  const categories=page.getByRole('group',{name:'Channel categories'});
  await expect(categories.getByRole('button',{name:'Category 200'})).toBeAttached();
  const initialChannelRequests=backend.requests.filter(request=>request.path==='/api/v2/iptv/live/channels').length;
  await categories.evaluate(node=>{node.scrollTop=node.scrollHeight;node.dispatchEvent(new Event('scroll'))});
  await expect(categories.getByRole('button',{name:'Category 201'})).toBeVisible();
  await categories.dispatchEvent('wheel',{deltaY:-100});
  await expect(categories.getByRole('button',{name:'Category 200'})).toBeVisible();
  expect(requests).toEqual([null,'next_categories','previous_categories']);
  expect(await categories.getByRole('button').count()).toBe(203);
  expect(backend.requests.filter(request=>request.path==='/api/v2/iptv/live/channels')).toHaveLength(initialChannelRequests);
  expect(backend.errors).toEqual([]);
});

test('guide evicts pages, fetches only nearby schedules, and retrieves the beginning in reverse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page);
  const pageRequests: number[] = [];
  const guides: string[] = [];
  await page.route(`${apiOrigin}/api/v2/iptv/live/**`, route => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get('cursor')?.replace('page_', '') ?? 0);
    const categories = url.pathname.endsWith('/categories');
    if (!categories) pageRequests.push(offset);
    return route.fulfill({ headers: cors, json: {
      catalog_id: 1, generation: 1,
      items: categories ? [] : Array.from({ length: 40 }, (_, index) => ({ id: `channel-${offset + index}`, name: `Channel ${offset + index + 1}` })),
      next_cursor: !categories && offset < 360 ? `page_${offset + 40}` : null,
      previous_cursor: !categories && offset > 0 ? `page_${offset - 40}` : null,
    } });
  });
  await page.route(`${apiOrigin}/api/v2/iptv/guide/**`, route => {
    guides.push(new URL(route.request().url()).pathname.split('/').at(-1)!);
    return route.fulfill({ headers: cors, json: { programs: [], timezone: 'UTC' } });
  });
  await page.goto('/tv/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Live TV', exact: true }).click();
  const scroll = page.getByRole('region', { name: 'Scrollable programme guide' });
  await expect(page.getByRole('button', { name: 'Channel 1', exact: true })).toBeVisible();
  expect(new Set(guides).size).toBeLessThanOrEqual(16);
  expect(pageRequests).not.toContain(40);
  for (let offset = 40; offset <= 360; offset += 40) {
    await scroll.evaluate(node => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
    await expect.poll(() => pageRequests.includes(offset)).toBe(true);
    await expect(page.getByRole('button', { name: `Channel ${offset + 1}`, exact: true })).toBeAttached();
    expect(await page.locator('[data-live-channel]').count()).toBeLessThanOrEqual(120);
  }
  await expect(page.getByRole('button', { name: 'Channel 1', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Channel 400', exact: true })).toBeAttached();
  for (let offset = 240; offset >= 0; offset -= 40) {
    await scroll.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
    await expect(page.getByRole('button', { name: `Channel ${offset + 1}`, exact: true })).toBeAttached();
    expect(await page.locator('[data-live-channel]').count()).toBeLessThanOrEqual(120);
  }
  await scroll.evaluate(node => { node.scrollTop = 0; });
  await expect(page.getByRole('button', { name: 'Channel 1', exact: true })).toBeVisible();
});

test('website fullscreen, volume and backend info operate on a decoded player', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installBackend(page);
  // Exercise native fallback controls; MediaBunny decoding has its separate real-media probe.
  await page.addInitScript(() => { Object.defineProperty(window, 'VideoDecoder', { value: undefined }); });
  await page.route(`${apiOrigin}/api/v2/playback**`, route => route.fulfill({ headers: cors, json: playbackV2Fixture(route, route.request().method() === 'POST' ? { id: 'controls', url: '/media/controls/test/index.m3u8', mode: 'remux', format: 'hls', video_mode: 'copy', audio_mode: 'copy', duration: 5 } : {}) }));
  await page.route(`${apiOrigin}/media/controls/test/**`, async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const file = name === 'index.m3u8' ? name : name.replace('.ts', '.bin');
    await route.fulfill({ headers: cors, contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t', body: await readFile(new URL(`../fixtures/hls/${file}`, import.meta.url)) });
  });
  await page.goto('/tv/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.locator('[data-focus-id="detail-source"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const mode = page.locator('[data-focus-id="picture-mode"]');
  const surfaces = page.locator('.tv-screen > .video');
  await expect(mode).toHaveText('Fit');
  await expect(mode).toHaveAttribute('aria-pressed', 'false');
  for (const surface of await surfaces.all()) await expect(surface).toHaveCSS('object-fit', 'contain');
  const pausedSession = await page.locator('video').evaluate((video: HTMLVideoElement) => ({ src: video.currentSrc, time: video.currentTime }));
  await mode.click();
  await expect(mode).toHaveText('Fill');
  await expect(mode).toHaveAttribute('aria-label', 'Fit video');
  await expect(mode).toHaveAttribute('aria-pressed', 'true');
  for (const surface of await surfaces.all()) await expect(surface).toHaveCSS('object-fit', 'cover');
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.currentSrc)).toBe(pausedSession.src);
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.currentTime)).toBeCloseTo(pausedSession.time, 1);
  await mode.focus();
  await mode.press('Enter');
  await expect(mode).toBeFocused();
  await expect(mode).toHaveText('Fit');
  await mode.press('Space');
  await expect(mode).toHaveText('Fill');
  // DeskPlayer: both timeline ends are clocks ([12:48] / [52:10]), never a "N min" runtime.
  await expect(page.locator('.player-time span').last()).toHaveText(/^\d+:\d{2}(:\d{2})?$/);
  await page.getByRole('slider', { name: 'Volume', exact: true }).evaluate((node: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0.35'); node.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.volume)).toBeCloseTo(.35);
  await page.getByRole('button', { name: 'Mute', exact: true }).click();
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.muted)).toBe(true);
  await page.getByRole('slider', { name: 'Volume', exact: true }).evaluate((node: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, '0.55'); node.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await page.locator('video').evaluate((video: HTMLVideoElement) => video.muted)).toBe(false);
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await expect(page.getByRole('button', { name: 'Exit fullscreen', exact: true })).toBeVisible();
  await expect(surfaces.first()).toHaveCSS('object-fit', 'cover');
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
  await expect(mode).toHaveText('Fill');
  await expect(page.locator('.player-overlay')).toBeVisible();
  await page.getByRole('button', { name: 'Playback info', exact: true }).click();
  const info = page.getByRole('dialog', { name: 'Playback info', exact: true });
  await expect(info).toContainText('browser-proxy');
  await expect(info).toContainText('remux');
  await expect(info).not.toContainText('/media/');
  await expect(info.locator('dt').filter({ hasText: 'Decoder' }).locator('..').locator('dd')).toContainText(/native-html|hls\.js/);
});

test('phone player fits and fills video without losing the controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installBackend(page);
  await page.addInitScript(() => { Object.defineProperty(window, 'VideoDecoder', { value: undefined }); });
  await page.route(`${apiOrigin}/api/v2/playback**`, route => route.fulfill({ headers: cors, json: playbackV2Fixture(route, route.request().method() === 'POST' ? { id: 'phone-mode', url: '/media/phone-mode/test/index.m3u8', mode: 'remux', format: 'hls', video_mode: 'copy', audio_mode: 'copy', duration: 5 } : {}) }));
  await page.route(`${apiOrigin}/media/phone-mode/test/**`, async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    const file = name === 'index.m3u8' ? name : name.replace('.ts', '.bin');
    await route.fulfill({ headers: cors, contentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t', body: await readFile(new URL(`../fixtures/hls/${file}`, import.meta.url)) });
  });
  await page.goto('/tv/'); await page.getByRole('button', { name: 'Alex' }).click();
  await page.locator('.media-card').filter({ hasText: movie.name }).click();
  await page.locator('[data-focus-id="detail-source"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect.poll(() => page.locator('video').evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const mode = page.locator('[data-focus-id="picture-mode"]');
  await expect(mode).toHaveText('Fit');
  await expect(page.locator('video')).toHaveCSS('object-fit', 'contain');
  await page.screenshot({ path: testInfo.outputPath('phone-player-fit.png') });
  await mode.click();
  await expect(page.locator('video')).toHaveCSS('object-fit', 'cover');
  await expect(page.locator('canvas.player-canvas')).toHaveCSS('object-fit', 'cover');
  const buttons = await page.locator('.vx-player__tools > .vx-player__control').all();
  expect(buttons).toHaveLength(5);
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  for (let index = 1; index < boxes.length; index++) expect(boxes[index]!.x).toBeGreaterThanOrEqual(boxes[index - 1]!.x + boxes[index - 1]!.width);
  await page.screenshot({ path: testInfo.outputPath('phone-player-fill.png') });
  await page.locator('[data-focus-id="player-back"]').click();
  await expect(page.locator('.sources')).toBeVisible();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect(mode).toHaveText('Fill');
  await page.locator('[data-focus-id="player-back"]').click();
  await expect(page.locator('.sources')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.sources')).toHaveCount(0);
  await expect(page.locator('.detail')).toBeVisible();
  await page.locator('[data-focus-id="detail-source"]').click();
  await page.locator('[data-focus-id="source-0"]').click();
  await expect(mode).toHaveText('Fit');
});

test('Discover keeps all addon namespaces and loads despite an unrelated Home failure', async ({ page }) => {
  await installBackend(page);
  await page.route(`${apiOrigin}/api/profiles/1/continue/page**`, route => route.fulfill({ status: 503, json: { error: 'temporary outage' }, headers: cors }));
  await page.route(`${apiOrigin}/api/catalogs`, route => route.fulfill({ headers: cors, json: [
    { id: 'popular', name: 'Popular', type: 'movie', addon_id: 1, addon_name: 'Cinemeta' },
    { id: 'popular', name: 'Popular', type: 'movie', addon_id: 2, addon_name: 'AIOMetadata' },
    { id: 'anime', name: 'Anime', type: 'anime', addon_id: 2, addon_name: 'AIOMetadata' },
  ] }));
  await page.goto('/tv/'); await page.getByRole('button', { name: 'Alex' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  if (await page.getByRole('button', { name: 'Dismiss', exact: true }).isVisible()) await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Discover', exact: true }).click();
  // Desktop: one catalog control ("Addon · Catalog") opens a popover of the type's catalogs,
  // the current one marked; the type is a segmented control beside it (DeskDiscoverCatalog).
  await page.locator('[data-focus-id="discover-catalog"]').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: /^Cinemeta · Popular/ })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('dialog').getByRole('button', { name: 'AIOMetadata · Popular', exact: true }).click();
  await expect(page.locator('[data-focus-id="discover-catalog"]')).toContainText('AIOMetadata · Popular');
  const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/discover' && new URL(request.url()).searchParams.get('type') === 'anime');
  await page.getByRole('group', { name: 'Content type' }).getByRole('button', { name: 'Anime', exact: true }).click();
  const selected = new URL((await request).url());
  expect(selected.searchParams.get('addon_id')).toBe('2');
  await expect(page.locator('[data-focus-id="discover-catalog"]')).toContainText('AIOMetadata · Anime');
});
import { playbackV2Fixture } from './helpers/playbackV2Fixture';
