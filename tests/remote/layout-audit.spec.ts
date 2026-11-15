import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { openNavigation } from './navigation-helpers';
import { createRequire } from 'node:module';

const { PNG } = createRequire(import.meta.url)('pngjs');

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

/** src/tv-solid/remote/layout.ts owns these lines. Every screen must start its
 * text on the inset and end it inside the right edge, so titles, shelves,
 * catalogs and the player's chrome line up instead of each choosing a number. */
const INSET = 96, RIGHT_EDGE = 1824;

/** Text that ignores the shared inset. Rails legitimately scroll past the
 * right edge inside their clipping container, so only the left line is global. */
const strays = async (page: Page) => (await scene(page))
  .filter(node => node.text && String(node.text).trim() && node.x < 96)
  .map(node => `${node.text}@${Math.round(node.x)}`);

for (const route of ['movie', 'series', 'anime']) test(`${route} catalog and Filters keep a consistent 24px gap`, async ({ page, baseURL }, testInfo) => {
  await installRemoteBackend(page, baseURL!);
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await openNavigation(page, route);
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  const catalog = (await scene(page)).find(node => node.text === 'Popular')?.parent;
  const filter = (await scene(page)).find(node => node.text === 'Filters')?.parent;
  expect(catalog).toEqual({ x: INSET, y: 140, w: 360, h: 64 });
  expect(filter).toEqual({ x: 480, y: 140, w: 200, h: 64 });
  expect(filter.x - catalog.x - catalog.w).toBe(24);
  expect(await strays(page)).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${route}-filters.png`) });
});

test('home, library and live start on the same inset and never draw left of it', async ({ page, baseURL }) => {
  await installRemoteBackend(page, baseURL!);
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  const screens: [string, string][] = [
    ['home', 'Continue Watching'],
    ['library', 'Type:'],
    ['live', 'LIVE'],
  ];
  for (const [route, anchor] of screens) {
    if (route !== 'home') await openNavigation(page, route);
    await expect.poll(async () => (await scene(page)).some(node => node.text === anchor)).toBe(true);
    const node = (await scene(page)).find(value => value.text === anchor)!;
    // A title sits on the inset; a label inside a pill sits on the pill's own
    // padding, but never left of the inset.
    expect({ route, left: node.x >= INSET }).toEqual({ route, left: true });
    if (route === 'home') expect({ route, left: node.x }).toEqual({ route, left: INSET });
    expect({ route, strays: await strays(page) }).toEqual({ route, strays: [] });
    if (route === 'home') await openNavigation(page, 'home');
  }
});

test('the player keeps its control row and timeline on the shared lines', async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, { media: true });
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-sources', '8');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-player-controls', 'true');
  await expect.poll(async () => (await scene(page)).some(node => node.y === 846)).toBe(true);
  const boxes = await scene(page);
  const row = boxes.filter(node => node.y === 846 && (node.w === 160 || node.w === 228 || node.w === 240 || node.w === 304));
  expect(row.length).toBeGreaterThan(0);
  expect(Math.min(...row.map(node => node.x))).toBe(INSET);
  expect(Math.max(...row.map(node => node.x + node.w))).toBeLessThanOrEqual(RIGHT_EDGE);
  const timeline = boxes.filter(node => node.y === 936).map(node => node.w);
  expect(Math.max(...timeline)).toBe(RIGHT_EDGE - INSET);
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
  const gap = PNG.sync.read(await page.screenshot({ clip: { x: title.parent.x + 40, y: title.parent.y + 82, width: 560, height: 12 } }));
  const colors = new Set<string>();
  for (let index = 0; index < gap.data.length; index += 4) colors.add(gap.data.subarray(index, index + 4).toString('hex'));
  expect([...colors]).toEqual(['161618ff']);
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
