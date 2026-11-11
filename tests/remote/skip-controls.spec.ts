import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const state = (page: Page) => page.locator('html');
const texts = (page: Page) => page.evaluate(() => {
  const result: string[] = [];
  function walk(node: any) { if (node.isRenderable && node.viptvText) result.push(node.viptvText); node.children?.forEach(walk); }
  walk((window as any).__viptvRenderer.stage.root);
  return result;
});
async function start(page: Page, baseURL: string, segments: unknown[], enabled = true) {
  const fixture = await installRemoteBackend(page, baseURL, { media: true, episodeFlow: true });
  fixture.bootstrap().preferences!.preferences.skip_intros = enabled;
  await page.route('**/api/playback/*/segments', route => route.fulfill({ json: { segments } }));
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-sources', '8');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await page.locator('video').evaluate(video => { (video as HTMLVideoElement).loop = true; });
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-tv-player-state', 'paused');
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-player-controls', 'false');
  return fixture;
}
async function position(page: Page, seconds: number) {
  await page.locator('video').evaluate((video, value) => { (video as HTMLVideoElement).currentTime = value; }, seconds);
  await expect.poll(() => page.locator('video').evaluate(video => (video as HTMLVideoElement).seeking)).toBe(false);
  await page.locator('video').evaluate(video => video.dispatchEvent(new Event('timeupdate')));
  await expect.poll(async () => Number(await state(page).getAttribute('data-tv-player-position'))).toBeCloseTo(seconds, 1);
}

for (const kind of ['intro', 'recap']) test(`server ${kind} shortcut respects its time range, Select and paused intent`, async ({ page, baseURL }, testInfo) => {
  const fixture = await start(page, baseURL!, [{ kind, start_ms: 1000, end_ms: 2000 }]);
  const label = kind === 'intro' ? 'Skip intro' : 'Skip recap';
  await position(page, .5);
  expect(await texts(page)).not.toContain(label);
  await position(page, 1);
  await expect.poll(() => texts(page)).toContain(label);
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-player-controls', 'true');
  await expect.poll(() => texts(page)).toContain(label);
  await page.keyboard.press('Escape');
  await position(page, 2);
  await expect.poll(() => texts(page)).not.toContain(label);
  await position(page, 1.25);
  await expect.poll(() => texts(page)).toContain(label);
  const before = fixture.requests.filter(request => request.path === '/api/playback' && request.method === 'POST').length;
  expect(before).toBe(1);
  await page.screenshot({ path: testInfo.outputPath(`skip-${kind}.png`) });
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.filter(request => request.path === '/api/playback' && request.method === 'POST').at(-1)?.body.position).toBe(2);
  await expect(state(page)).toHaveAttribute('data-tv-player-seeking', 'false');
  await expect(state(page)).toHaveAttribute('data-tv-player-state', 'paused');
});

for (const enabled of [true, false]) test(`invalid, credits and disabled markers do not expose Skip (enabled=${enabled})`, async ({ page, baseURL }) => {
  const fixture = await start(page, baseURL!, enabled ? [
    { kind: 'intro', start_ms: -100, end_ms: 2000 },
    { kind: 'intro', start_ms: 1000, end_ms: 1000 },
    { kind: 'recap', start_ms: 0, end_ms: 6000 },
    { kind: 'credits', start_ms: 0, end_ms: 2000 },
  ] : [{ kind: 'intro', start_ms: 0, end_ms: 2000 }], enabled);
  await position(page, .25);
  expect((await texts(page)).some(text => text === 'Skip intro' || text === 'Skip recap')).toBe(false);
  await page.keyboard.press('ArrowUp');
  expect((await texts(page)).some(text => text === 'Skip intro' || text === 'Skip recap')).toBe(false);
  expect(fixture.requests.filter(request => request.path === '/api/playback' && request.method === 'POST')).toHaveLength(1);
});
