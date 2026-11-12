import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { installRemoteBackend } from '../preview/remote-backend';

const { PNG } = createRequire(import.meta.url)('pngjs');
const solidPng = (width: number, height: number, rgb: number[]) => {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([...rgb, 255], i);
  return PNG.sync.write(image);
};
const pixel = async (page: Page, x: number, y: number) => {
  const image = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 1, height: 1 } }));
  return [...image.data.subarray(0, 3)] as number[];
};

for (const canvas of [false, true]) test(`bright hero keeps its scrim below prepared foreground (${canvas ? 'Canvas' : 'WebGL'})`, async ({ page, baseURL }, testInfo) => {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  const fixture = await installRemoteBackend(page, baseURL!);
  const home = fixture.bootstrap().home!;
  const background = `${baseURL}/bright-hero.png`, poster = `${baseURL}/green-hero.png`, logo = `${baseURL}/api/images/clearlogo/v1/tt123.png`;
  const card = { ...fixture.card, landscape: background, poster, logo: 'https://images.metahub.space/logo/medium/tt123/img', description: 'Bright hero contrast synopsis' };
  home.hero = card; home.featured = [card];
  home.rows = [{ ...home.rows[0], id: 'portrait-row', cards: [card] }];
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...fixture.bootstrap(), clearlogo_image_supported: true } }));
  await page.route('**/api/images/clearlogo/v1/tt123.png', route => route.fulfill({ body: solidPng(240, 360, [0, 255, 0]), contentType: 'image/png' }));
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/bright-hero.png', async route => { await held; await route.fulfill({ body: solidPng(192, 108, [255, 255, 255]), contentType: 'image/png' }); });
  await page.route('**/green-hero.png', route => route.fulfill({ body: solidPng(240, 360, [0, 255, 0]), contentType: 'image/png' }));
  const images = () => page.evaluate(() => {
    const result: { id: number; src: string; x: number; y: number; w: number; h: number; alpha: number }[] = [];
    function walk(n: any) {
      const src = n.texture?.props?.src;
      if (typeof src === 'string' && /(?:bright|green)-hero|clearlogo\/v1\/tt123/.test(src)) result.push({ id: n.id, src, x: n.absX, y: n.absY, w: n.props.w, h: n.props.h, alpha: n.worldAlpha });
      n.children?.forEach(walk);
    }
    walk((window as any).__viptvRenderer.stage.root); return result;
  });
  await page.goto('/tv/?focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(async () => (await images()).filter(n => n.src === logo).length).toBeGreaterThan(0);
  const prepared = (await images()).map(n => n.id);
  release();
  await expect.poll(async () => (await images()).some(n => n.src === background && n.alpha > .99)).toBe(true);
  await page.waitForTimeout(200);
  expect((await images()).map(n => n.id)).toEqual(prepared);
  const paint = await page.evaluate(() => {
    const nodes: { id: number; src: string; mask: boolean }[] = [];
    function walk(n: any) {
      const src = n.texture?.props?.src;
      if (typeof src === 'string') nodes.push({ id: n.id, src, mask: src.includes('/tv-artwork/') && n.props.w === 1920 && n.props.h === 1080 });
      n.children?.forEach(walk);
    }
    walk((window as any).__viptvRenderer.stage.root); return nodes;
  });
  await testInfo.attach('hero-paint-order', { body: JSON.stringify(paint), contentType: 'application/json' });
  const masks = paint.filter(n => n.mask);
  expect(masks).toHaveLength(1);
  expect(paint.findIndex(n => n.src === background)).toBeLessThan(paint.findIndex(n => n.mask));
  expect(paint.findIndex(n => n.mask)).toBeLessThan(paint.findIndex(n => n.src === logo));
  const backdrop=(await images()).find(node=>node.src===background)!;
  expect({x:backdrop.x,y:backdrop.y,w:backdrop.w,h:backdrop.h}).toEqual({x:480,y:0,w:1440,h:810});
  // Flat white deliberately exercises the brightest possible artwork behind synopsis and shelf labels.
  expect(Math.max(...await pixel(page, 80, 550))).toBeLessThan(45);
  expect(Math.min(...await pixel(page, 1700, 250))).toBeGreaterThan(245);
  // The full 800px synopsis column must stay dark, including its right edge.
  expect(Math.max(...await pixel(page, 850, 550))).toBeLessThan(45);
  expect(Math.max(...await pixel(page, 80, 750))).toBeLessThan(65);
  const shownLogo = (await images()).find(n => n.src === logo && n.alpha > .99)!;
  const logoPixel = await pixel(page, Math.round(shownLogo.x + shownLogo.w / 2), Math.round(shownLogo.y + shownLogo.h / 2));
  expect(logoPixel[1]).toBeGreaterThan(245); expect(logoPixel[0]).toBeLessThan(10);
  await page.screenshot({ path: testInfo.outputPath('bright-featured.png') });
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await images()).some(n => n.src === poster && n.w === 240 && n.h === 360 && n.alpha > .99)).toBe(true);
  expect(await pixel(page, 1704, 324)).toEqual([0, 255, 0]);
  expect(Math.max(...await pixel(page, 80, 480))).toBeLessThan(65);
  await page.screenshot({ path: testInfo.outputPath('bright-portrait.png') });
});
