import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { installRemoteBackend } from '../preview/remote-backend';

const { PNG } = createRequire(import.meta.url)('pngjs');
function solidPng(rgb: number[]) {
  const image = new PNG({width: 192, height: 108});
  for (let i = 0; i < image.data.length; i += 4) image.data.set([...rgb, 255], i);
  return PNG.sync.write(image);
}
async function pixel(page: Page, x: number, y: number) {
  const image = PNG.sync.read(await page.screenshot({clip: {x, y, width: 1, height: 1}}));
  return [...image.data.subarray(0, 3)] as number[];
}
async function setup(page: Page, origin: string, canvas: boolean, avatarImage: boolean) {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  const fixture = await installRemoteBackend(page, origin);
  await page.route('**/fixture/*', route => route.fulfill({body: solidPng([20, 30, 50]), contentType: 'image/png'}));
  const raw = 'https://wsrv.nl/?url=image.tmdb.org/t/p/original/portrait-contract.jpg&w=1280&h=720&fit=cover&output=webp&q=75';
  const card = {...fixture.card, logo: null, landscape: raw, poster: origin + '/portrait-poster.png'};
  const bootstrap = fixture.bootstrap();
  bootstrap.home!.hero = card; bootstrap.home!.featured = [card];
  bootstrap.home!.rows = [{...bootstrap.home!.rows[0], id: 'poster-preview', view: {card_shape: 'poster'}, cards: [card]}];
  const profile = bootstrap.profile_management.profiles.find(value => value.id === bootstrap.identity.profile_id)!;
  Object.assign(profile, {name: 'Aster', avatar_id: null, avatar_url: avatarImage ? origin + '/avatar-contract.png' : null});
  await page.route('**/api/bootstrap', route => route.fulfill({json: bootstrap}));
  const requests: string[] = [];
  await page.route('https://wsrv.nl/**', route => {
    requests.push(route.request().url());
    return route.fulfill({body: solidPng([180, 100, 60]), contentType: 'image/png'});
  });
  await page.route('**/portrait-poster.png', route => route.fulfill({body: solidPng([0, 220, 80]), contentType: 'image/png'}));
  await page.route('**/avatar-contract.png', route => route.fulfill({body: solidPng([0, 220, 80]), contentType: 'image/png'}));
  await page.goto('/tv/?focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-renderer-backend', canvas ? 'canvas' : 'webgl');
  return {requests};
}
const scene = (page: Page) => page.evaluate(() => {
  const images: {src: string; x: number; y: number; w: number; h: number; alpha: number}[] = [], letters: string[] = [];
  function walk(node: any) {
    const src = node.texture?.props?.src;
    if (typeof src === 'string' && node.worldAlpha > .99) images.push({src, x: node.absX, y: node.absY, w: node.props.w, h: node.props.h, alpha: node.worldAlpha});
    if ((node.viptvText === 'A' || node.props?.text === 'A') && node.worldAlpha > 0 && node.absX > 1700 && node.absY < 132) letters.push('A');
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root); return {images, letters};
});

for (const canvas of [false, true]) {
  const mode = canvas ? 'Canvas' : 'WebGL';
  test(`poster variant is full width without its gradient and retains single-image behavior (${mode})`, async ({page, baseURL}, info) => {
    const fixture = await setup(page, baseURL!, canvas, true);
    await expect.poll(async () => (await scene(page)).images.some(image => image.src.startsWith('https://wsrv.nl/'))).toBe(true);
    expect(Math.max(...await pixel(page, 30, 260))).toBeLessThan(45);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('html')).toHaveAttribute('data-tv-focus', /^rows:/);
    await expect.poll(async () => (await scene(page)).images.some(image => image.w === 240 && image.h === 360 && image.src.endsWith('/portrait-poster.png'))).toBe(true);
    const portrait = await scene(page);
    const backdrop = portrait.images.find(image => image.src.startsWith('https://wsrv.nl/') && image.w === 1920 && image.h === 1080)!;
    expect(backdrop).toBeTruthy(); expect({x: backdrop.x, y: backdrop.y}).toEqual({x: 0, y: 0});
    expect(portrait.images.filter(image => image.w === 1920 && image.h === 1080 && image.src.includes('/tv-artwork/'))).toHaveLength(0);
    for (const x of [30, 1400]) {
      const actual = await pixel(page, x, 260);
      for (let channel = 0; channel < 3; channel++) expect(Math.abs(actual[channel] - [180, 100, 60][channel])).toBeLessThan(5);
    }
    expect(await pixel(page, 1704, 324)).toEqual([0, 220, 80]);
    const requested = fixture.requests.map(value => new URL(value));
    expect(requested.some(value => value.searchParams.get('blur') === '60' && value.searchParams.get('w') === '960' && value.searchParams.get('h') === '540')).toBe(true);
    writeFileSync(info.outputPath('portrait-scene.json'), JSON.stringify({portrait, requests: fixture.requests}, null, 2));
    await page.screenshot({path: info.outputPath('poster-full-width.png')});
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('html')).toHaveAttribute('data-tv-focus', /^hero:/);
    await expect.poll(async () => (await scene(page)).images.some(image => image.w === 1920 && image.h === 1080 && image.src.includes('/tv-artwork/'))).toBe(true);
    await expect.poll(async () => Math.max(...await pixel(page, 30, 260))).toBeLessThan(45);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await scene(page)).images.some(image => image.w === 240 && image.h === 360 && image.src.endsWith('/portrait-poster.png'))).toBe(true);
    await expect.poll(async () => (await pixel(page, 30, 260))[0]).toBeGreaterThan(170);
  });

  test(`actual avatar has no initial overlay while a missing avatar retains its fallback (${mode})`, async ({page, baseURL}, info) => {
    await setup(page, baseURL!, canvas, true);
    await expect.poll(async () => (await scene(page)).images.some(image => image.src.endsWith('/avatar-contract.png') && image.w === 56)).toBe(true);
    expect((await scene(page)).letters).toEqual([]);
    await page.screenshot({path: info.outputPath('avatar-photo-no-letter.png')});
    await setup(page, baseURL!, canvas, false);
    await expect.poll(async () => (await scene(page)).letters).toEqual(['A']);
  });
}
