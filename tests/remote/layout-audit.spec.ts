import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { openNavigation } from './navigation-helpers';

const state = (page: Page) => page.locator('html');
const scene = (page: Page) => page.evaluate(() => {
  const result: any[] = [];
  function walk(node: any) {
    if (node.isRenderable) result.push({ text: node.viptvText, x: node.absX, y: node.absY, w: node.props.w, h: node.props.h, src: node.texture?.props?.src,
      parent: { x: node.parent?.absX, y: node.parent?.absY, w: node.parent?.props?.w, h: node.parent?.props?.h } });
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return result;
});

for (const route of ['movie', 'series', 'anime']) test(`${route} catalog and Filters keep a consistent 24px gap`, async ({ page, baseURL }, testInfo) => {
  await installRemoteBackend(page, baseURL!);
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await openNavigation(page, route);
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  const catalog = (await scene(page)).find(node => node.text === 'Popular')?.parent;
  const filter = (await scene(page)).find(node => node.text === 'Filters')?.parent;
  expect(catalog).toEqual({ x: 96, y: 140, w: 360, h: 64 });
  expect(filter).toEqual({ x: 480, y: 140, w: 200, h: 64 });
  expect(filter.x - catalog.x - catalog.w).toBe(24);
  await page.screenshot({ path: testInfo.outputPath(`${route}-filters.png`) });
});

test('a short recovery message uses a compact centered dialog with padded action', async ({ page, baseURL }, testInfo) => {
  await installRemoteBackend(page, baseURL!, { fail: true });
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(async () => (await scene(page)).some(node => node.text === 'Couldn’t continue')).toBe(true);
  const title = (await scene(page)).find(node => node.text === 'Couldn’t continue');
  expect(title.parent.w).toBe(640);
  expect(title.parent.h).toBeLessThan(360);
  expect(title.parent.x + title.parent.w / 2).toBe(960);
  expect(title.parent.y + title.parent.h / 2).toBe(540);
  const action = (await scene(page)).find(node => node.text === 'Try again');
  expect(action.x).toBeGreaterThan(title.parent.x + 24);
  expect(action.y).toBeGreaterThan(title.y + 80);
  await page.screenshot({ path: testInfo.outputPath('short-recovery.png') });
});

test('a managed seek centers its busy spinner and message without overlapping', async ({ page, baseURL }, testInfo) => {
  const fixture = await installRemoteBackend(page, baseURL!, { media: true });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let admissions = 0;
  await page.route('**/api/playback', async route => {
    if (route.request().method() === 'POST' && ++admissions === 2) await held;
    await route.fallback().catch(() => {});
  });
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-sources', '8');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await page.keyboard.press('Space');
  await expect(state(page)).toHaveAttribute('data-tv-player-state', 'paused');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-player-seeking', 'true');
  await expect.poll(async () => (await scene(page)).some(node => node.text === 'Seeking…')).toBe(true);
  const text = (await scene(page)).find(node => node.text === 'Seeking…');
  const spinner = (await scene(page)).find(node => node.w === 56 && node.h === 56 && node.src?.includes('/tv-artwork/'));
  expect(spinner).toBeDefined();
  expect(spinner.x + spinner.w / 2).toBe(960);
  expect(text.parent).toEqual({ x: 800, y: 476, w: 320, h: 132 });
  expect(text.y).toBeGreaterThan(spinner.y + spinner.h);
  await page.screenshot({ path: testInfo.outputPath('seeking-centered.png') });
  release();
  await expect(state(page)).toHaveAttribute('data-tv-player-seeking', 'false');
  await expect(state(page)).toHaveAttribute('data-tv-player-state', 'paused');
});
