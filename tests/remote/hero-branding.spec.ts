import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createRequire } from 'node:module';
import { installRemoteBackend, referenceRoot } from '../preview/remote-backend';
const { PNG } = createRequire(import.meta.url)('pngjs');
const logo = new PNG({ width: 640, height: 190 });
for (let i = 0; i < logo.data.length; i += 4) { logo.data[i] = 255; logo.data[i + 2] = 255; logo.data[i + 3] = 255; }
const logoBytes = PNG.sync.write(logo);
const state = (page: Page) => page.locator('html');
const viewports = [{ width: 1920, height: 1080 }, { width: 1540, height: 754 }];
async function renderer(page: Page, canvas: boolean) {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
}
const scene = (page: Page) => page.evaluate(() => {
  const texts: { text: string; x: number; y: number; w: number; h: number }[] = [];
  const images: { src: string; x: number; y: number; w: number; h: number; rightClip: boolean }[] = [];
  function walk(node: any) {
    if (node.isRenderable) {
      if (node.viptvText) texts.push({ text: node.viptvText, x: node.absX, y: node.absY, w: node.props.w, h: node.props.h });
      const src = node.texture?.props?.src;
      if (typeof src === 'string') {
        let parent = node.parent, rightClip = false;
        while (parent) { if (parent.props.w === 1440 && parent.props.h === 810 && Math.abs(parent.absX - 480) < 1) rightClip = true; parent = parent.parent; }
        images.push({ src, x: node.absX, y: node.absY, w: node.props.w, h: node.props.h, rightClip });
      }
    }
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root); return { texts, images };
});
async function paintedLogo(page: Page, info: TestInfo, label: string) {
  const png = PNG.sync.read(await page.locator('#app canvas').screenshot({ path: info.outputPath(`${label}.png`) }));
  const scale = png.width / 1920;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let y = 0; y < Math.min(png.height, Math.ceil(600 * scale)); y++) {
    let painted = false;
    for (let x = 0; x < Math.min(png.width, Math.ceil(800 * scale)); x++) {
      const offset = (y * png.width + x) * 4;
      if (png.data[offset] > 210 && png.data[offset + 1] < 60 && png.data[offset + 2] > 210) {
        painted = true; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (Number.isFinite(top) && !painted) break;
  }
  return Number.isFinite(left) ? { left: left / scale, top: top / scale, right: (right + 1) / scale, bottom: (bottom + 1) / scale } : undefined;
}
async function pauseClock(page: Page) { await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000))); await page.clock.runFor(300); }
async function loadedLogo(page: Page) { await expect.poll(async () => (await scene(page)).images.some(image => image.src.includes('/api/images/clearlogo/v1/tt133'))).toBe(true); }

for (const canvas of [false, true]) for (const viewport of viewports) {
  for (const series of [false, true]) test(`${series ? 'Series' : 'Movie'} Details branding moves without crossing its copy (${canvas ? 'Canvas' : 'WebGL'}, ${viewport.width})`, async ({ page, baseURL }, info) => {
    const reduced = series && viewport.width === 1540;
    await page.setViewportSize(viewport); await renderer(page, canvas); await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' }); await page.clock.install();
    const fixture = await installRemoteBackend(page, baseURL!);
    const item = { ...fixture.card, identity: { kind: series ? 'series' : 'movie', id: `branding-${series}`, ids: [] }, title: series ? 'Series layout title' : fixture.card.title, logo: 'https://images.metahub.space/logo/medium/tt133001/img', description: 'Branding geometry synopsis', view: { ...fixture.card.view!, preview: { ...fixture.card.view!.preview!, action: 'details' as const } } };
    const home = fixture.bootstrap().home!; home.hero = item; home.featured = [item]; home.rows = [{ ...home.rows[0], id: 'continue', cards: [item] }];
    await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...fixture.bootstrap(), clearlogo_image_supported: true } }));
    await page.route('**/api/images/clearlogo/v1/tt133*.png', route => route.fulfill({ contentType: 'image/png', body: logoBytes }));
    await page.route('**/api/meta/**', route => route.fulfill({ json: { item, episodes: series ? [{ ...item, identity: { ...item.identity, id: 'episode-1', episode: { order: 'aired', season: 1, episode: 1 } } }] : [], recommendations: fixture.cards, seasons: series ? [{ season: 1, offset: 0, episode_count: 1 }] : [], next_cursor: null } }));
    await page.goto('/tv/?focusdebug=1'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
    await loadedLogo(page); await pauseClock(page);
    const before = await paintedLogo(page, info, 'details-expanded'); expect(before).toBeDefined();
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(70);
    const middle = await paintedLogo(page, info, 'details-moving'); expect(middle).toBeDefined();
    if (!series) {
      const synopsis = (await scene(page)).texts.find(text => text.text === item.description)!;
      expect(middle!.bottom).toBeLessThan(synopsis.y - 16);
    }
    await page.clock.runFor(300);
    const compact = await paintedLogo(page, info, 'details-compact'); expect(compact).toBeDefined();
    expect(compact!.bottom).toBeLessThanOrEqual(123); expect(compact!.right - compact!.left).toBeLessThanOrEqual(221);
    if (reduced) expect(middle).toEqual(compact);
    else { expect(middle!.top).toBeLessThan(before!.top - 1); expect(middle!.top).toBeGreaterThan(compact!.top + 1); }
    if (series) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.clock.runFor(250); expect((await scene(page)).texts.some(text => text.text === 'More Like This')).toBe(true); }
    for (let i = 0; i < 3 && !(await state(page).getAttribute('data-tv-focus'))?.startsWith('hero:'); i++) await page.keyboard.press('ArrowUp');
    await page.clock.runFor(300); const restored = await paintedLogo(page, info, 'details-restored');
    expect(restored!.top).toBeCloseTo(before!.top, 0); expect(restored!.bottom).toBeCloseTo(before!.bottom, 0);
  });

  test(`Home delayed portrait branding and composition remain coherent (${canvas ? 'Canvas' : 'WebGL'}, ${viewport.width})`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport); await renderer(page, canvas); await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.clock.install();
    const fixture = await installRemoteBackend(page, baseURL!);
    const first = { ...fixture.card, landscape: 'https://image.tmdb.org/t/p/original/133-continue.jpg', logo: 'https://images.metahub.space/logo/medium/tt133010/img', description: 'Continue branding synopsis' };
    const next = { ...fixture.cards[2], logo: 'https://images.metahub.space/logo/medium/tt133011/img', description: 'Portrait branding synopsis', landscape: 'https://image.tmdb.org/t/p/original/133-subject.jpg', poster: 'https://image.tmdb.org/t/p/original/133-poster.jpg' };
    const home = fixture.bootstrap().home!; home.hero = first; home.featured = [first]; home.rows = [{ ...home.rows[0], id: 'continue', cards: [first] }, { ...home.rows[0], id: 'favorites', title: 'My List', cards: [next] }];
    await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...fixture.bootstrap(), clearlogo_image_supported: true } }));
    await page.route('**/api/images/clearlogo/v1/tt133*.png', route => route.fulfill({ contentType: 'image/png', body: logoBytes }));
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const proxy: string[] = [];
    await page.route('https://wsrv.nl/**', async route => { proxy.push(route.request().url()); if (!new URL(route.request().url()).searchParams.get('url')?.includes('133-continue')) await held; await route.fulfill({ path: `${referenceRoot}/assets/a5729872fdf6d97950dabed6371ef4d6.jpg`, contentType: 'image/jpeg' }).catch(() => {}); });
    await page.goto('/tv/?focusdebug=1'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true'); await page.keyboard.press('ArrowDown'); await loadedLogo(page);
    await expect.poll(async () => (await scene(page)).texts.some(text => text.text === 'Movie' && text.y < 600)).toBe(true);
    await pauseClock(page);
    const before = await paintedLogo(page, info, 'continue-branding'); expect(before).toBeDefined();
    await page.keyboard.press('ArrowDown'); await page.clock.runFor(180);
    const moving = await paintedLogo(page, info, 'portrait-pending-branding'); expect(moving).toBeDefined();
    const metadata = (await scene(page)).texts.find(text => text.text === 'Movie' && text.y < 600)!;
    expect(moving!.bottom).toBeLessThan(metadata.y - 16);
    const sharp = (await scene(page)).images.find(image => image.src.includes('133-continue') && image.w > 1000)!;
    expect(sharp).toMatchObject({ w: 1920, h: 1080, rightClip: true });
    const sharpUrl = new URL(sharp.src), stageScale = Math.min(viewport.width / 1920, viewport.height / 1080);
    expect(sharpUrl.searchParams.get('fit')).toBe('cover'); expect(sharpUrl.searchParams.has('blur')).toBe(false);
    expect(Number(sharpUrl.searchParams.get('w'))).toBe(Math.ceil(1280 * stageScale));
    release(); await expect.poll(async () => { await page.clock.runFor(32); return (await scene(page)).texts.some(text => text.text === next.description); }).toBe(true); await page.clock.runFor(250);
    const portrait = (await scene(page)).images.find(image => image.w === 1920 && image.h === 1080 && image.src.includes('133-subject'))!;
    expect(portrait).toBeDefined(); const url = new URL(portrait.src); expect(url.searchParams.get('blur')).toBe('8'); expect(url.searchParams.get('fit')).toBe('cover');
    const scale = Math.min(viewport.width / 1920, viewport.height / 1080); expect(Number(url.searchParams.get('w'))).toBe(Math.ceil(960 * scale));
    expect(proxy.some(raw => new URL(raw).searchParams.get('url')?.includes('133-poster'))).toBe(true);
    await paintedLogo(page, info, 'portrait-ready-branding');
    await page.keyboard.press('ArrowUp'); await page.clock.runFor(70); await page.keyboard.press('ArrowDown'); await page.clock.runFor(300);
    const reversed = await paintedLogo(page, info, 'portrait-reversed-branding'); const after = (await scene(page)).texts.find(text => text.text === 'Movie' && text.y < 600)!;
    expect(reversed!.bottom).toBeLessThan(after.y - 16);
  });

  test(`Details reserves known pending logo and falls back only after failure (${canvas ? 'Canvas' : 'WebGL'}, ${viewport.width})`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport); await renderer(page, canvas);
    const fixture = await installRemoteBackend(page, baseURL!); fixture.card.logo = null;
    fixture.card.view!.preview!.action = 'details';
    const home = fixture.bootstrap().home!; home.hero = fixture.card; home.featured = [fixture.card]; home.rows = [{ ...home.rows[0], cards: [fixture.card] }];
    const item: typeof fixture.card = { ...fixture.card, logo: 'https://images.metahub.space/logo/medium/tt133020/img' };
    await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...fixture.bootstrap(), clearlogo_image_supported: true } }));
    await page.route('**/api/meta/**', route => route.fulfill({ json: { item, episodes: [], recommendations: fixture.cards, seasons: [], next_cursor: null } }));
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let requested = false;
    await page.route('**/api/images/clearlogo/v1/tt133020.png', async route => { requested = true; await held; await route.abort().catch(() => {}); });
    await page.goto('/tv/?focusdebug=1'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true'); await expect.poll(() => requested).toBe(true);
    expect((await scene(page)).texts.filter(text => text.y < 600).map(text => text.text)).not.toContain(item.title);
    await page.screenshot({ path: info.outputPath('known-logo-pending.png') }); release();
    await expect.poll(async () => (await scene(page)).texts.filter(text => text.y < 600).map(text => text.text)).toContain(item.title);
    await page.screenshot({ path: info.outputPath('failed-logo-title.png') });
    await page.keyboard.press('Escape'); item.logo = null; await page.keyboard.press('Enter'); await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
    await expect.poll(async () => (await scene(page)).texts.filter(text => text.y < 600).map(text => text.text)).toContain(item.title);
  });
}
