import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

async function forceCanvas(page: Page, noWorkers = false) {
  await page.addInitScript(noWorkers => {
    if (noWorkers) Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  }, noWorkers);
}

async function canvas(page: Page, origin: string) {
  await forceCanvas(page, true);
  await installRemoteBackend(page, origin);
  await page.goto('/tv/?focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-renderer-backend', 'canvas');
  await page.waitForFunction(() => {
    let painted = false;
    function walk(node: any) { if (node.viptvText === 'Play' && node.isRenderable && node.textureLoaded) painted = true; node.children?.forEach(walk); }
    walk((window as any).__viptvRenderer.stage.root); return painted;
  });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1540, height: 754 }]) test(`Canvas focus colors update while artwork decode slots are occupied (${viewport.width})`, async ({ page, baseURL }, info) => {
  await page.setViewportSize(viewport);
  await canvas(page, baseURL!);
  const facts = await page.evaluate(async () => {
    const renderer = (window as any).__viptvRenderer;
    const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const plate = renderer.createNode({ parent: renderer.root, x: 1500, y: 450, w: 320, h: 100, color: 0xffffffff, zIndex: 100000 });
    const label = renderer.createTextNode({ parent: renderer.root, x: 1520, y: 470, text: 'Focus', fontFamily: 'Onest700', fontSize: 48, color: 0x111113ff, zIndex: 100001 });
    for (let i = 0; i < 60 && !label.textureLoaded; i++) await frame();
    const gate = renderer.stage.txManager.decodeGate;
    if (!gate) throw Error('Main-thread image decode gate absent');
    const held: (() => void)[] = [];
    for (let i = 0; i < renderer.stage.txManager.imageDecodeConcurrency; i++) {
      await gate.acquire(); held.push(() => gate.release());
    }
    const canvas = document.querySelector('#app canvas') as HTMLCanvasElement;
    const context = canvas.getContext('2d')!, scale = canvas.width / 1920;
    const white = () => {
      const data = context.getImageData(Math.round(1520 * scale), Math.round(470 * scale), Math.round(180 * scale), Math.round(65 * scale)).data;
      let count = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 200 && data[i+1] > 200 && data[i+2] > 200) count++;
      return count / (scale * scale);
    };
    plate.color = 0x111113ff; label.color = 0xffffffff;
    for (let i = 0; i < 4; i++) await frame();
    const immediate = white();
    await new Promise(resolve => setTimeout(resolve, 1100));
    const delayed = white();
    (window as any).__releaseCanvasPaint = () => { held.forEach(release => release()); label.destroy(); plate.destroy(); };
    return { immediate, delayed };
  });
  await page.screenshot({ path: info.outputPath('focus-decode-blocked.png') });
  await page.evaluate(() => { (window as any).__releaseCanvasPaint(); delete (window as any).__releaseCanvasPaint; });
  await info.attach('focus-pixels', { body: JSON.stringify(facts), contentType: 'application/json' });
  expect(facts.immediate).toBeGreaterThan(500);
  expect(facts.delayed).toBe(facts.immediate);
});

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1540, height: 754 }]) {
  test(`Canvas season options keep labels and episode counts inside the row (${viewport.width})`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport);
    await forceCanvas(page);
    const fixture = await installRemoteBackend(page, baseURL!, { seasonPages: true });
    await page.goto('/tv/?focusdebug=1');
    const state = page.locator('html');
    await expect(state).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(state).toHaveAttribute('data-tv-screen', 'detail');
    await expect(state).toHaveAttribute('data-tv-ready', 'true');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(state).toHaveAttribute('data-tv-overlay', 'choices');
    await expect.poll(() => page.evaluate(() => {
      let found = false;
      function walk(node: any) { if (node.viptvText === '2 episodes' && node.isRenderable && node.absX < 1856) found = true; node.children?.forEach(walk); }
      walk((window as any).__viptvRenderer.stage.root); return found;
    })).toBe(true);
    const facts = await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const renderer = (window as any).__viptvRenderer;
      const labels: {text:string;left:number;right:number;rowLeft:number;rowRight:number}[] = [];
      function walk(node: any) {
        if ((/^Season /.test(node.viptvText ?? '') || node.viptvText === '2 episodes') && node.isRenderable && node.parent?.props.w === 692) {
          labels.push({ text: node.viptvText, left: node.absX, right: node.absX + node.props.w, rowLeft: node.parent.absX, rowRight: node.parent.absX + 692 });
        }
        node.children?.forEach(walk);
      }
      walk(renderer.stage.root);
      const canvas = document.querySelector('#app canvas') as HTMLCanvasElement;
      const scale = canvas.width / 1920;
      const context = canvas.getContext('2d')!;
      const pixels = context.getImageData(Math.ceil(1857 * scale), Math.ceil(354 * scale), Math.floor(48 * scale), Math.floor(58 * scale)).data;
      let escaped = 0;
      for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i+1], pixels[i+2]) > 50) escaped++;
      return { labels, escaped };
    });
    await info.attach('season-pixels', { body: JSON.stringify(facts), contentType: 'application/json' });
    expect(facts.labels.length).toBe(4);
    for (const label of facts.labels) { expect(label.left).toBeGreaterThanOrEqual(label.rowLeft + 24); expect(label.right).toBeLessThanOrEqual(label.rowRight - 24); }
    expect(facts.escaped).toBe(0);
    await page.screenshot({ path: info.outputPath('seasons-contained.png') });
    expect(fixture.requests.some(request => request.path.startsWith('/api/meta/'))).toBe(true);
  });
}

for (const viewport of [{ width: 1920, height: 1080 }, { width: 1540, height: 754 }]) {
  test(`Canvas bright artwork waits for its gradient (${viewport.width})`, async ({ page, baseURL }, info) => {
    await page.setViewportSize(viewport);
    await forceCanvas(page);
    const fixture = await installRemoteBackend(page, baseURL!);
    const home = fixture.bootstrap().home!;
    const card = { ...fixture.card, logo: null, landscape: `${baseURL}/white-art.svg` };
    home.hero = card; home.featured = [card];
    await page.route('**/white-art.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="white" d="M0 0h1920v1080H0z"/></svg>' }));
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/tv-artwork/*.png', async route => { await held; await route.continue().catch(() => {}); });
    await page.goto('/tv/?focusdebug=1');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    const sample = () => page.evaluate(() => {
      const canvas = document.querySelector('#app canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!, scale = canvas.width / 1920;
      return [850, 1700].map(x => [...ctx.getImageData(Math.round(x * scale), Math.round(550 * scale), 1, 1).data].slice(0, 3));
    });
    await expect.poll(async () => Math.max(...(await sample())[1])).toBeLessThan(50);
    await page.screenshot({ path: info.outputPath('gradient-preparing.png') });
    release();
    await expect.poll(async () => Math.min(...(await sample())[1])).toBeGreaterThan(150);
    expect(Math.max(...(await sample())[0])).toBeLessThan(45);
    await page.screenshot({ path: info.outputPath('gradient-ready.png') });
  });
}

test('Canvas buffering retains lease controls and paints a thumb only with timeline focus', async ({ page, baseURL }, info) => {
  await forceCanvas(page);
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() { this.loop = true; return play.call(this); };
  });
  const fixture = await installRemoteBackend(page, baseURL!, { media: true, captionTracks: true, episodeFlow: true });
  await page.goto('/tv/?focusdebug=1'); const state = page.locator('html');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter'); await expect(state).toHaveAttribute('data-tv-sources', '8');
  await expect(state).toHaveAttribute('data-tv-ready', 'true'); await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await expect(state).toHaveAttribute('data-tv-overlay', '');
  await page.locator('video').evaluate(video => { video.addEventListener('pause', () => video.dispatchEvent(new Event('waiting')), { once: true }); (video as HTMLVideoElement).pause(); });
  await page.keyboard.press('ArrowUp');
  await expect(state).toHaveAttribute('data-tv-player-state', 'buffering');
  await expect(state).toHaveAttribute('data-tv-player-controls', 'true');
  const paint = () => page.evaluate(async () => {
    for (let i = 0; i < 4; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const texts: string[] = []; let thumbs = 0;
    function walk(node: any) { if (node.isRenderable) { if (node.viptvText) texts.push(node.viptvText); if (node.props.w === 12 && node.props.h === 20 && Math.abs(node.absY - 930) < 1) thumbs++; } node.children?.forEach(walk); }
    walk((window as any).__viptvRenderer.stage.root);
    const canvas = document.querySelector('#app canvas') as HTMLCanvasElement;
    const position = Number(document.documentElement.dataset.tvPlayerPosition), duration = Number(document.documentElement.dataset.tvPlayerDuration);
    const x = 96 + 1728 * Math.min(1, position / (duration || 1));
    const pixels = canvas.getContext('2d')!.getImageData(Math.round(x - 3), 931, 6, 4).data;
    let bright = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 200 && pixels[i+1] > 200 && pixels[i+2] > 200) bright++;
    return { texts, thumbs, bright };
  });
  const idle = await paint(); expect(idle.thumbs).toBe(0); expect(idle.bright).toBe(0);
  expect(idle.texts).toContain('Source'); expect(idle.texts).toContain('Audio & subtitles');
  await page.screenshot({ path: info.outputPath('buffering-tools.png') });
  await page.keyboard.press('ArrowDown'); await expect(state).toHaveAttribute('data-tv-player-timeline-focus', 'true');
  const focused = await paint(); expect(focused.thumbs).toBe(1); expect(focused.bright).toBeGreaterThan(10);
  await page.screenshot({ path: info.outputPath('timeline-thumb.png') });
  await page.keyboard.press('ArrowUp'); await expect(state).toHaveAttribute('data-tv-player-timeline-focus', 'false');
  expect((await paint()).bright).toBe(0);
});
