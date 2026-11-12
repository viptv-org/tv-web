import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { installRemoteBackend } from '../preview/remote-backend';
const { PNG } = createRequire(import.meta.url)('pngjs');

const scene = (page: Page) => page.evaluate(() => {
  const texts: string[] = [], paintedTexts: string[] = [], logos: string[] = [], backgrounds: string[] = [];
  const cards: { src: string; x: number; y: number }[] = [];
  let ring: { x: number; y: number } | undefined;
  function walk(node: any) {
    if (node.isRenderable) {
      if (node.viptvText) texts.push(node.viptvText);
      if (node.props.text) paintedTexts.push(node.props.text);
      const src = node.texture?.props?.src;
      if (typeof src === 'string' && src.includes('/api/images/clearlogo/v1/tt125') && node.absY < 500) logos.push(src);
      if (((node.props.w === 1440 && node.props.h === 810) || (node.props.w === 1920 && node.props.h === 1080)) && typeof src === 'string' && src.includes('/continue-125-')) backgrounds.push(src);
      if (node.props.w === 424 && node.props.h === 238 && typeof node.texture?.props?.src === 'string')
        cards.push({ src: node.texture.props.src, x: node.absX, y: node.absY });
      if (node.props.w === 424 && node.props.h === 4 && node.absY > 500 && (!ring || node.absY < ring.y)) ring = { x: node.absX, y: node.absY };
    }
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return { texts, paintedTexts, cards, ring, logos, backgrounds };
});

for (const repeated of [false, true]) for (const canvas of [false, true]) test(`Continue visual selection, preview and Play share server row positions (${canvas ? 'Canvas' : 'WebGL'}, ${repeated ? 'repeated first entry' : 'distinct control'})`, async ({ page, baseURL }, info) => {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  const fixture = await installRemoteBackend(page, baseURL!);
  const home = fixture.bootstrap().home!;
  const colors = ['#b82837', '#209148', '#1e50be'];
  const titles = ['Alpha selection', 'Bravo selection', 'Charlie selection'];
  const distinct = titles.map((title, index) => {
    const background = `${baseURL}/continue-125-${index}.svg`;
    return { ...fixture.card, identity: { kind: 'movie', id: `continue-${index}`, ids: [] }, title,
      description: `${title} has its own synopsis.`, logo: `https://images.metahub.space/logo/medium/tt125${index}/img`, poster: background, landscape: background,
      view: { ...fixture.card.view!, preview: { background, caption: '', progress: null, action: 'play' as const } } };
  });
  // The producer may project repeated identities or provider/episode variants.
  // Rendering must not silently shift every later server-owned position.
  const cards = repeated ? [distinct[0], distinct[0], distinct[1], distinct[2]] : distinct;
  const bravoIndex = cards.indexOf(distinct[1]), charlieIndex = cards.length - 1;
  home.hero = distinct[0]; home.featured = [distinct[0]];
  home.rows = [{ ...home.rows[0], id: 'continue', cards }];
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let waiting = false;
  await page.route('**/continue-125-*.svg', async route => {
    const index = Number(/continue-125-(\d+)/.exec(route.request().url())![1]);
    if (index === 2) { waiting = true; await held; }
    await route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><path fill="${colors[index]}" d="M0 0h1920v1080H0z"/><text x="120" y="250" fill="white" font-size="100">${titles[index]}</text></svg>` }).catch(() => {});
  });
  await page.route('**/api/bootstrap', route => route.fulfill({ json: { ...fixture.bootstrap(), clearlogo_image_supported: true } }));
  await page.route('**/api/images/clearlogo/v1/tt125*.png', async route => {
    const index = Number(/tt125(\d)/.exec(route.request().url())![1]);
    if (index === 2) { waiting = true; await held; }
    const png = new PNG({ width: 800, height: 120 });
    const rgb = colors[index].slice(1).match(/../g)!.map(value => parseInt(value, 16));
    for (let offset = 0; offset < png.data.length; offset += 4) { png.data[offset] = rgb[0]; png.data[offset + 1] = rgb[1]; png.data[offset + 2] = rgb[2]; png.data[offset + 3] = 255; }
    await route.fulfill({ contentType: 'image/png', body: PNG.sync.write(png) }).catch(() => {});
  });
  await page.goto('/tv/?focusdebug=1');
  const state = page.locator('html');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await expect(state).toHaveAttribute('data-renderer-backend', canvas ? 'canvas' : 'webgl');
  await page.keyboard.press('ArrowDown');
  const evidence: unknown[] = [];
  async function selection(index: number) {
    await expect(state).toHaveAttribute('data-tv-focus', new RegExp(`^rows:${index}:0:`));
    await expect.poll(async () => {
      const value = await scene(page), focused = value.cards.find(card => value.ring && Math.abs(card.x - value.ring.x) < 1 && Math.abs(card.y - value.ring.y) < 1);
      return focused?.src;
    }).toBe(cards[index].landscape);
    await expect.poll(async () => (await scene(page)).texts).toContain(cards[index].description);
    await expect.poll(async () => (await scene(page)).paintedTexts).toContain(cards[index].description);
    await expect.poll(async () => (await scene(page)).logos).toEqual([`${baseURL}/api/images/clearlogo/v1/tt125${distinct.indexOf(cards[index])}.png`]);
    await expect.poll(async () => (await scene(page)).backgrounds).toEqual([cards[index].landscape]);
    const value = await scene(page), ring = value.ring!;
    const image = PNG.sync.read(await page.screenshot({ path: info.outputPath(`continue-index-${index}.png`) }));
    const offset = (Math.round(ring.y + 100) * image.width + Math.round(ring.x + 40)) * 4;
    const actual = [...image.data.subarray(offset, offset + 3)];
    const expected = colors[distinct.indexOf(cards[index])].slice(1).match(/../g)!.map(value => parseInt(value, 16));
    for (let channel = 0; channel < 3; channel++) expect(Math.abs(actual[channel] - expected[channel])).toBeLessThan(4);
    evidence.push({ index, title: cards[index].title, visible: value.cards.find(card => Math.abs(card.x - ring.x) < 1), pixel: actual });
  }
  await selection(0);
  for (let index = 1; index < charlieIndex; index++) { await page.keyboard.press('ArrowRight'); await selection(index); }
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => waiting).toBe(true);
  await page.waitForTimeout(300);
  expect((await scene(page)).texts).toContain(distinct[1].description);
  release(); await selection(charlieIndex);
  for (const index of Array.from({ length: charlieIndex }, (_, offset) => charlieIndex - offset - 1)) { await page.keyboard.press('ArrowLeft'); await selection(index); }
  await page.screenshot({ path: info.outputPath('continue-server-positions.png') });
  expect(fixture.requests.filter(request => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  // Activate the focused Bravo before the intentional 120ms preview settle.
  for (let step = 0; step < bravoIndex; step++) await page.keyboard.press('ArrowRight');
  const immediate = await scene(page);
  expect(immediate.texts).toContain(distinct[0].description);
  expect(immediate.cards.find(card => immediate.ring && Math.abs(card.x - immediate.ring.x) < 1 && Math.abs(card.y - immediate.ring.y) < 1)?.src).toBe(distinct[1].landscape);
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.filter(request => request.path.endsWith('/viewing-action')).length).toBe(1);
  await expect.poll(() => fixture.requests.filter(request => request.path === '/api/streams' && request.method === 'POST').length).toBe(1);
  expect(fixture.requests.find(request => request.path.endsWith('/viewing-action'))!.body.card.identity.id).toBe(distinct[1].identity.id);
  expect(fixture.requests.find(request => request.path === '/api/streams' && request.method === 'POST')!.body.id).toBe(distinct[1].identity.id);
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-screen', 'home');
  await selection(bravoIndex);
  // Once cached artwork and the preview settle, the same focused card wins.
  await page.keyboard.press('ArrowRight'); await selection(charlieIndex); await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.filter(request => request.path.endsWith('/viewing-action')).length).toBe(2);
  await expect.poll(() => fixture.requests.filter(request => request.path === '/api/streams' && request.method === 'POST').length).toBe(2);
  expect(fixture.requests.filter(request => request.path.endsWith('/viewing-action'))[1].body.card.identity.id).toBe(distinct[2].identity.id);
  expect(fixture.requests.filter(request => request.path === '/api/streams' && request.method === 'POST')[1].body.id).toBe(distinct[2].identity.id);
  await info.attach('selection-evidence', { body: JSON.stringify(evidence), contentType: 'application/json' });
});
