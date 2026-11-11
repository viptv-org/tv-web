import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend, referenceRoot } from '../preview/remote-backend';

const texts = (page: Page) => page.evaluate(() => {
  const values: string[] = [];
  function walk(node: any) { if (node.isRenderable && node.viptvText) values.push(node.viptvText); node.children?.forEach(walk); }
  walk((window as any).__viptvRenderer.stage.root);
  return values;
});
const artwork = (page: Page) => page.evaluate(() => {
  const nodes: { id: number; src: string; visible: boolean }[] = [];
  function walk(node: any) {
    const src = node.texture?.props?.src;
    let parent = node.parent, slowFrame = false;
    for (let depth = 0; parent && depth < 4; depth++, parent = parent.parent)
      if (parent.children?.some((child:any) => typeof child.texture?.props?.src === 'string' && child.texture.props.src.includes('/slow-background.jpg'))) slowFrame = true;
    if (src && (typeof src === 'string' && src.includes('/slow-') || slowFrame))
      nodes.push({ id: node.id, src: typeof src === 'string' ? src : 'prepared-logo-bitmap', visible: node.isRenderable });
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return nodes;
});

for (const first of [true, false]) test(`slow ${first ? 'first' : 'replacement'} artwork stays mounted and recovers after the former deadline`, async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  const home = fixture.bootstrap().home!;
  const slow = { ...fixture.card, identity: { ...fixture.card.identity, id: 'slow-title' }, description: 'Slow title synopsis', logo: `${baseURL}/slow-logo.png`, landscape: `${baseURL}/slow-background.jpg` };
  const initial = { ...fixture.card, description: 'Current title synopsis' };
  home.hero = first ? slow : initial;
  home.featured = first ? [slow] : [initial, slow];
  let releaseLogo!: () => void, releaseBackground!: () => void;
  const logo = new Promise<void>(resolve => { releaseLogo = resolve; });
  const background = new Promise<void>(resolve => { releaseBackground = resolve; });
  await page.route('**/slow-logo.png', async route => { await logo; await route.fulfill({ path: referenceRoot + '/assets/274e704ffc2eeb3e73918396e294edb0.png', contentType: 'image/png' }).catch(() => {}); });
  await page.route('**/slow-background.jpg', async route => { await background; await route.fulfill({ path: referenceRoot + '/assets/3da010bb588e70c5323088b2c66658fe.jpg', contentType: 'image/jpeg' }).catch(() => {}); });
  await page.goto('/tv/?focusdebug=1');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(() => texts(page)).toContain(first ? slow.description : initial.description);
  if (!first) {
    await expect.poll(() => page.evaluate(src => {
      let painted = false;
      function walk(node:any) { if (node.isRenderable && node.props.w === 1920 && node.props.h === 1080 && node.texture?.props?.src === src) painted = true; node.children?.forEach(walk); }
      walk((window as any).__viptvRenderer.stage.root); return painted;
    }, initial.landscape)).toBe(true);
    await page.clock.fastForward(9100);
  }
  await expect.poll(() => artwork(page)).toHaveLength(1);
  const prepared = (await artwork(page)).map(node => node.id).sort();
  await page.clock.fastForward(5000);
  expect((await artwork(page)).map(node => node.id).sort()).toEqual(prepared);
  expect((await artwork(page)).some(node => node.visible)).toBe(false);
  expect(await texts(page)).toContain(first ? slow.description : initial.description);
  releaseBackground();
  await page.clock.runFor(100);
  expect((await artwork(page)).some(node => node.visible)).toBe(false);
  releaseLogo();
  await expect.poll(async () => { await page.clock.runFor(32); return artwork(page); }).toEqual(expect.arrayContaining(prepared.map(id => expect.objectContaining({ id, visible: true }))));
  await expect.poll(async () => (await artwork(page)).filter(node => node.visible)).toHaveLength(2);
  await expect.poll(() => texts(page)).toContain(slow.description);
  if (!first) expect(await texts(page)).not.toContain(initial.description);
});

test('leaving a slow prepared hero retires its nodes and ignores late callbacks', async ({ page, baseURL }) => {
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  const home = fixture.bootstrap().home!;
  home.hero = { ...fixture.card, description: 'Abandoned synopsis', logo: null, landscape: `${baseURL}/slow-abandoned.jpg` };
  home.featured = [home.hero];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/slow-abandoned.jpg', async route => { await held; await route.fulfill({ path: referenceRoot + '/assets/3da010bb588e70c5323088b2c66658fe.jpg', contentType: 'image/jpeg' }).catch(() => {}); });
  await page.goto('/tv/?focusdebug=1');
  await expect.poll(() => artwork(page)).toHaveLength(1);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(500);
  await expect.poll(() => artwork(page)).toHaveLength(0);
  release();
  await page.clock.runFor(500);
  expect(await artwork(page)).toHaveLength(0);
  expect(await texts(page)).not.toContain('Abandoned synopsis');
});
