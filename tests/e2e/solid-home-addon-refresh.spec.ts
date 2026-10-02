import { expect, test } from '@playwright/test';
import { apiOrigin, installBackend } from '../preview/backend';

test('SolidTV adds a changed catalog on Home without resetting card focus or scroll', async ({ page }, info) => {
  test.skip(info.project.name !== 'vizio', 'One SolidTV browser acceptance run');
  await page.clock.install();
  const backend = await installBackend(page, { family: 'tv', session: 'ready', sourcesDone: true });
  let revision = 'rev1';
  let catalogFetches = 0;
  let revisionFetches = 0;
  let failTopOnce = false;
  let topFailures = 0;
  const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  const catalogs = [
    { id: 'top', type: 'movie', name: 'Popular', addon_id: 1, addon_name: 'Cinemeta', supports_search: true, supports_skip: true, extra: [{ name: 'skip' }] },
    { id: 'seasonal', type: 'movie', name: 'Seasonal', addon_id: 2, addon_name: 'Trakt', supports_skip: true, extra: [{ name: 'skip' }] },
  ];
  await page.route(`${apiOrigin}/api/catalogs/revision`, route => {
    revisionFetches++;
    return route.fulfill({ headers, body: JSON.stringify({ revision }) });
  });
  await page.route(`${apiOrigin}/api/catalogs`, route => {
    catalogFetches++;
    const next = revision === 'rev2' ? [...catalogs, { id: 'new-addon', type: 'movie', name: 'New Addon Picks', addon_id: 3, addon_name: 'New Addon', supports_search: true, supports_skip: true, extra: [{ name: 'skip' }] }] : catalogs;
    return route.fulfill({ headers, body: JSON.stringify(next) });
  });
  await page.route(`${apiOrigin}/api/discover**`, route => {
    if (failTopOnce && new URL(route.request().url()).searchParams.get('catalog') === 'top') {
      failTopOnce = false;
      topFailures++;
      return route.fulfill({ status: 502, headers, body: JSON.stringify({ error: 'temporarily unavailable' }) });
    }
    return route.fallback();
  });
  await page.goto('/?platform=vizio&focusdebug=1');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-action');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-card');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__viptvHomeCache?.index >= 2);
  await expect.poll(() => revisionFetches).toBeGreaterThanOrEqual(2);
  const before = await page.evaluate(() => ({ focus: (window as any).__viptvFocus, cache: (window as any).__viptvHomeCache }));
  const initialCatalogFetches = catalogFetches;
  await page.clock.fastForward(15_000);
  expect(catalogFetches).toBe(initialCatalogFetches);
  failTopOnce = true;
  revision = 'rev2';
  await page.clock.fastForward(15_000);
  await expect.poll(() => catalogFetches).toBeGreaterThan(initialCatalogFetches);
  expect(topFailures).toBe(1);
  await page.clock.fastForward(15_000);
  await expect.poll(() => catalogFetches).toBeGreaterThanOrEqual(initialCatalogFetches + 2);
  await expect.poll(() => page.evaluate(() => (window as any).__viptvHomeCache?.rows)).toBeGreaterThan(before.cache.rows);
  const after = await page.evaluate(() => ({ focus: (window as any).__viptvFocus, cache: (window as any).__viptvHomeCache }));
  expect(after.focus.view).toBe('home-card');
  expect(after.focus.index).toBe(before.focus.index);
  expect(after.cache.scroll).toBe(before.cache.scroll);
  expect(backend.errors).toEqual([]);
});
