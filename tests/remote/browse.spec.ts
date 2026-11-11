import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend, referenceRoot } from '../preview/remote-backend';

const state = (page: Page) => page.locator('html');
const nodes = (page: Page) => page.evaluate(() => {
  const result: any[] = [];
  function walk(node: any) {
    if (node.isRenderable) result.push({ x: node.absX, y: node.absY, w: node.props.w, h: node.props.h, text: node.viptvText, src: node.texture?.props?.src });
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return result;
});
async function open(page: Page) {
  await page.goto('/tv/?platform=vizio&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('ArrowDown');
}

for (const action of ['play', 'details'] as const) test(`Browse retains card progress and the server ${action} action without deriving an episode`, async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  const card = fixture.bootstrap().home!.rows[0].cards[0];
  card.description = 'The focused title synopsis';
  card.progress = .9;
  card.subtitle = 'S1 E2 · 38m left';
  card.view!.preview = { background: `${baseURL}/fixture/7432c1f4e06fad8e590ad3646164759b.jpg`, caption: 'Resume S99 E99', progress: .11, action };
  await open(page);
  await expect.poll(async () => (await nodes(page)).some(node => node.text === card.description)).toBe(true);
  expect((await nodes(page)).some(node => node.text === card.subtitle)).toBe(true);
  expect((await nodes(page)).some(node => node.h === 5 && Math.abs(node.w - 418 * .9) < .01)).toBe(true);
  expect(fixture.requests.some(request => request.path.startsWith('/api/meta/') || request.path.endsWith('/viewing-action') || request.path === '/api/streams')).toBe(false);
  await page.keyboard.press('Enter');
  if (action === 'play') {
    await expect(state(page)).toHaveAttribute('data-tv-overlay', 'sources');
    await expect.poll(() => fixture.requests.some(request => request.path === '/api/streams' && request.body.id === 'episode-1')).toBe(true);
    expect(fixture.requests.some(request => request.path === '/api/streams' && request.body.id === 'episode-99')).toBe(false);
    await page.keyboard.press('Escape');
    await expect(state(page)).toHaveAttribute('data-tv-focus', /^rows:0:0:/);
  } else {
    await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
    expect(fixture.requests.some(request => request.path === '/api/streams')).toBe(false);
  }
});

test('missing preview action does not turn a subtitle or saved progress into a local resume decision', async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  const card = fixture.bootstrap().home!.rows[0].cards[0];
  delete card.view!.preview;
  card.progress = .6;
  card.subtitle = 'Resume S7 E8';
  await open(page);
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
  expect(fixture.requests.some(request => request.path === '/api/streams')).toBe(false);
});

test('rapid focus never commits an intermediate preview and a late image cannot overwrite the current title', async ({ page, baseURL }) => {
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  const cards = fixture.bootstrap().home!.rows[0].cards;
  for (let index = 0; index < 3; index++) {
    cards[index].description = `Preview synopsis ${index}`;
    cards[index].view!.preview = { background: `${baseURL}/preview/${index}`, caption: '', progress: null, action: 'details' };
  }
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let firstRequested = false;
  await page.route('**/preview/*', async route => {
    if (new URL(route.request().url()).pathname === '/preview/0') { firstRequested = true; await held; }
    await route.fulfill({ contentType: 'image/jpeg', path: referenceRoot + '/assets/7432c1f4e06fad8e590ad3646164759b.jpg' }).catch(() => {});
  });
  await open(page);
  await expect.poll(() => firstRequested).toBe(true);
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 1000)));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const seen = new Set<string>();
  for (let frame = 0; frame < 30; frame++) {
    await page.clock.runFor(32);
    for (const node of await nodes(page)) {
      if (node.text?.startsWith('Preview synopsis ')) seen.add(node.text);
      if (node.w === 1920 && node.h === 1080 && node.src?.includes('/preview/')) seen.add(node.src);
    }
  }
  expect([...seen]).toContain('Preview synopsis 2');
  expect([...seen]).not.toContain('Preview synopsis 1');
  expect([...seen]).not.toContain(`${baseURL}/preview/1`);
  release();
  await page.clock.runFor(200);
  await expect.poll(async () => (await nodes(page)).filter(node => node.w === 1920 && node.h === 1080 && node.src?.includes('/preview/')).map(node => node.src)).toEqual([`${baseURL}/preview/2`]);
  expect(fixture.requests.some(request => request.path.startsWith('/api/meta/') || request.path.endsWith('/viewing-action'))).toBe(false);
});

test('repeated tile focus uses prepared artwork without a runtime blur readback', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    (window as any).__tileReadbacks = 0;
    const read = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (...args: Parameters<typeof read>) {
      if (args[2] === 72 && args[3] === 72) (window as any).__tileReadbacks++;
      return read.apply(this, args);
    };
  });
  const fixture = await installRemoteBackend(page, baseURL!);
  await open(page);
  for (let index = 0; index < 5; index++) {
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
  }
  expect(await page.evaluate(() => (window as any).__tileReadbacks)).toBe(0);
  expect(fixture.requests.some(request => request.path.endsWith('/viewing-action') || request.path === '/api/streams')).toBe(false);
});
