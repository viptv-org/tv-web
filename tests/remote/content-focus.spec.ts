import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { openNavigation } from './navigation-helpers';

const state = (page: Page) => page.locator('html');
async function press(page: Page, ...keys: string[]) {
  for (const key of keys) await page.keyboard.press(key);
}
const posters = (page: Page) => page.evaluate(() => {
  const result: { src: string; x: number; y: number }[] = [];
  function walk(node: any) {
    if (node.isRenderable && node.props.w === 232 && node.props.h === 348 && node.texture?.props?.src?.includes('/fixture/'))
      result.push({ src: node.texture.props.src, x: node.absX, y: node.absY });
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return result;
});

for (const route of ['movie', 'series', 'anime', 'library']) test(`${route}: header navigation keeps the deep grid stationary and restores selection`, async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  const cards = Array.from({ length: 28 }, (_, index) => ({ ...fixture.cards[index % fixture.cards.length], identity: { kind: 'movie', id: `focus-${index}`, ids: [] }, title: `Focus ${index}` }));
  await page.route(route === 'library' ? '**/api/profiles/*/library?**' : '**/api/discover?**', handler => handler.fulfill({ json: { cards, complete: true } }));
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await openNavigation(page, route);
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^content:14:/);
  await expect.poll(() => posters(page)).not.toHaveLength(0);
  const before = await posters(page);
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^nav:/);
  expect(await posters(page)).toEqual(before);
  await press(page, 'ArrowLeft', 'ArrowRight');
  expect(await posters(page)).toEqual(before);
  await press(page, 'ArrowDown');
  if (route === 'library') await press(page, 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^content:14:/);
  expect(await posters(page)).toEqual(before);
});

test('a catalog refresh under the header restores the remembered card identity after reordering', async ({ page, baseURL }) => {
  await page.clock.install();
  const fixture = await installRemoteBackend(page, baseURL!);
  const all = Array.from({ length: 28 }, (_, index) => ({ ...fixture.cards[index % fixture.cards.length], identity: { kind: 'movie', id: `focus-${index}`, ids: [] }, title: `Focus ${index}` }));
  let cards = all;
  await page.route('**/api/discover?**', route => route.fulfill({ json: { cards, complete: true } }));
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await openNavigation(page, 'movie');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^nav:2:/);
  cards = [all[14], ...all.filter((_, index) => index !== 14)];
  fixture.reviseCatalog([0]);
  const before = fixture.requests.filter(request => request.path === '/api/discover').length;
  let fetched = false;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/discover') fetched = true; });
  await page.clock.fastForward(16000);
  await expect.poll(() => fetched || fixture.requests.filter(request => request.path === '/api/discover').length > before).toBe(true);
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^nav:2:/);
  await press(page, 'ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^content:0:/);
  await press(page, 'Enter');
  await expect.poll(() => fixture.requests.filter(request => request.path.startsWith('/api/meta/')).at(-1)?.path).toBe('/api/meta/movie/focus-14');
});
