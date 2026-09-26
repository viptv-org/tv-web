import { test, expect, type Page } from '@playwright/test';
import { installBackend, apiOrigin } from '../preview/backend';

test.beforeEach(({}, info) => { test.skip(info.project.name !== "vizio", "Vizio entry regression; other shared surfaces have their own acceptance."); });

const byId = (page: Page, id: string) => page.locator(`[data-focus-id="${id}"]`);
async function setup(page: Page, longQueue = false) {
  await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true });
  if (longQueue) await page.route(`${apiOrigin}/api/profiles/1/continue/page*`, route => route.fulfill({ json: {
    items: Array.from({ length: 18 }, (_, i) => ({ id: `queue-${i}`, type: 'movie', name: `Queue ${i}`, position: 60, duration: 120, genres: [] })), total: 18, offset: 0, next_offset: null,
  } }));
  await page.goto('/tv/?platform=vizio');
  await expect(byId(page, 'hero-play')).toBeVisible();
}

for (const width of [1920, 1280]) test(`remote rail and single-card edges at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width * 9 / 16 });
  await setup(page, true);
  await byId(page, 'hero-play').press('ArrowLeft');
  await expect(byId(page, 'nav-Home')).toBeFocused();
  for (const name of ['Discover', 'Live TV', 'My List', 'Settings']) {
    await page.keyboard.press('ArrowDown'); await expect(byId(page, `nav-${name}`)).toBeFocused();
  }
  await page.keyboard.press('ArrowDown'); await expect(byId(page, 'nav-Settings')).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(byId(page, 'hero-play')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(byId(page, 'queue-0')).toBeFocused();
  const home = page.locator('.vx-home');
  expect(await home.evaluate(node => node.scrollTop)).toBe(0);
  const track = page.locator('[data-scroll-id="cards-queue"]');
  let before = 0;
  for (let index = 1; index < 18; index++) {
    await page.keyboard.press('ArrowRight');
    await expect(byId(page, `queue-${index}`)).toBeFocused();
    await expect.poll(async () => {
      const a = await byId(page, `queue-${index}`).boundingBox(), b = await track.boundingBox();
      return !!a && !!b && a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1;
    }).toBe(true);
    // Allow the scroll animation to settle before comparing consecutive pitch distances.
    await expect.poll(async () => track.evaluate(node => Math.round(node.scrollLeft))).toBe(Math.round(Math.min(Math.max(0, 4 + index * 356 + 320 - 1632 + 4), 18 * 356 - 36 + 8 - 1632)));
    const after = await track.evaluate(node => node.scrollLeft);
    expect(after - before).toBeLessThanOrEqual(357); before = after;
  }
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => home.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(350);
  const prior = await home.evaluate(node => node.scrollTop);
  await page.keyboard.press('ArrowUp');
  const samples = await home.evaluate(node => new Promise<number[]>(resolve => {
    const values: number[] = []; const step = () => { values.push(node.scrollTop); if (values.length < 35) requestAnimationFrame(step); else resolve(values); }; step();
  }));
  expect(Math.max(...samples)).toBeLessThanOrEqual(prior + 1);
  await expect.poll(() => home.evaluate(node => node.scrollTop)).toBe(0);
  expect(await home.evaluate(node => getComputedStyle(node, '::-webkit-scrollbar').display)).toBe('none');
  await expect(page.locator('.vx-legend')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('home-navigation.png') });
});

test('all episode positions return to Season and keep their horizontal selection', async ({ page }, info) => {
  await setup(page);
  await byId(page, 'nav-Discover').click();
  await byId(page, 'discover-type-series').click();
  await byId(page, 'result-0').click();
  await expect(byId(page, 'episode-0')).toBeVisible();
  await byId(page, 'episode-0').focus();
  for (let i = 1; i <= 8; i++) { await page.keyboard.press('ArrowRight'); await expect(byId(page, `episode-${i}`)).toBeFocused(); }
  await page.keyboard.press('ArrowUp'); await expect(byId(page, 'detail-season')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(byId(page, 'episode-8')).toBeFocused();
  await expect(page.locator('.vx-legend')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('episode-season.png') });
});

test('Other catalog search stops empty and repeated upstream pages', async ({ page }, info) => {
  await installBackend(page, { family: 'tv', session: 'ready' });
  const requests: Array<{ query: string; skip: number }> = [];
  await page.route(`${apiOrigin}/api/catalogs`, route => route.fulfill({ json: [
    { id: 'top', type: 'movie', name: 'Popular', addon_id: 1, addon_name: 'Cinemeta' },
    { id: 'collections', type: 'other', name: 'TVDB Collections', addon_id: 4, addon_name: 'TVDB', supports_search: true, supports_skip: true, extra: [{ name: 'search', is_required: true }, { name: 'skip' }] },
  ] }));
  await page.route(`${apiOrigin}/api/discover?*`, async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('catalog') !== 'collections') return route.fallback();
    const query = url.searchParams.get('search') ?? '', skip = Number(url.searchParams.get('skip') ?? 0);
    requests.push({ query, skip });
    await route.fulfill({ json: { metas: query === 'empty' ? [] : [{ id: 'same', type: 'movie', name: 'Collection result' }], has_more: true, next_skip: skip + 20 } });
  });
  await page.goto('/tv/?platform=vizio');
  await byId(page, 'nav-Discover').click();
  await byId(page, 'discover-type-other').click();
  expect(requests).toEqual([]);
  const types = await page.getByRole('group', { name: 'Content type', exact: true }).boundingBox();
  const cats = await page.getByRole('group', { name: 'Catalog', exact: true }).boundingBox();
  expect(cats!.y).toBeGreaterThan(types!.y + types!.height);
  for (const query of ['repeat', 'empty']) {
    await byId(page, 'discover-filter-search').click();
    await page.getByRole('textbox', { name: 'Search catalog', exact: true }).fill(query);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    const expected = query === 'repeat' ? [0, 20] : [0];
    await expect.poll(() => requests.filter(r => r.query === query).map(r => r.skip)).toEqual(expected);
    await page.waitForTimeout(700);
    expect(requests.filter(r => r.query === query).map(r => r.skip)).toEqual(expected);
    await expect(byId(page, 'discover-filter-search')).toHaveAttribute('aria-label', `Search catalog: ${query}`);
  }
  await page.screenshot({ path: info.outputPath('discover-controls.png') });
});

test('Android TV hero blur, accent Resume and outlined two-row Discover geometry', async ({ page }, info) => {
  await setup(page);
  const hero = page.locator('.vx-home__hero-stage');
  await expect(hero).toHaveCSS('height', '664px');
  await expect(page.locator('.vx-home-backdrop__ambient')).toHaveCSS('filter', 'blur(72px)');
  await expect(page.locator('.vx-home-backdrop__ambient')).toHaveCSS('opacity', '0.6');
  await expect(page.locator('.vx-home-backdrop__art')).toHaveCSS('width', '1120px');
  await expect(byId(page, 'hero-play')).toHaveCSS('background-color', 'rgb(245, 197, 66)');
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.screenshot({ path: info.outputPath('home-artwork.png') });
  await byId(page, 'nav-Discover').click();
  await expect(byId(page, 'result-0')).toBeVisible();
  await byId(page, 'discover-catalog-0').focus();
  await expect(byId(page, 'discover-type-movie')).toHaveCSS('border-top-width', '1px');
  await expect(byId(page, 'discover-type-movie')).toHaveCSS('background-color', 'rgb(42, 42, 46)');
  await expect(byId(page, 'discover-type-series')).toHaveCSS('border-top-width', '1px');
  for (let i = 0; i < 4; i++) {
    const card = await byId(page, `result-${i}`).boundingBox();
    const art = await byId(page, `result-${i}`).locator('.vx-card__art').boundingBox();
    expect(card!.x).toBeGreaterThanOrEqual(192);
    expect(card!.x + card!.width).toBeLessThanOrEqual(1825);
    expect(Math.abs(art!.width / art!.height - 16 / 9)).toBeLessThan(.01);
  }
  await page.screenshot({ path: info.outputPath('discover-grid.png') });
});
