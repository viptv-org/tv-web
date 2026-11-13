import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const texts = (page: Page) => page.evaluate(() => {
  const result: string[] = [];
  function visit(node: any) {
    if (node.isRenderable && node.viptvText) result.push(node.viptvText);
    node.children?.forEach(visit);
  }
  visit((window as any).__viptvRenderer.stage.root);
  return result;
});

test('startup recovery Enter and Back never issue pairing while saved authority is unresolved', async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  let unavailable = true;
  const bootstraps: string[] = [];
  await page.route('**/api/bootstrap', route => {
    bootstraps.push(route.request().headers().authorization);
    return unavailable ? route.fulfill({ status: 503, json: { error_code: 'service_unavailable' } }) : route.fallback();
  });
  await page.goto('/tv/solid.html');
  await expect.poll(() => texts(page)).toContain('Try again');
  await page.keyboard.press('Enter');
  await expect.poll(() => bootstraps.length).toBeGreaterThanOrEqual(2);
  await expect.poll(() => texts(page)).toContain('Try again');
  expect(fixture.requests.filter(r => r.path === '/api/auth/device/code')).toHaveLength(0);
  const beforeBack = bootstraps.length;
  await page.keyboard.press('Escape');
  await expect.poll(() => bootstraps.length).toBeGreaterThan(beforeBack);
  await expect.poll(() => texts(page)).toContain('Try again');
  expect(fixture.requests.filter(r => r.path === '/api/auth/device/code')).toHaveLength(0);
  unavailable = false;
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'home');
  expect(bootstraps.every(value => value === 'Bearer fixture-access')).toBe(true);
  expect(fixture.requests.filter(r => r.path === '/api/auth/device/refresh')).toHaveLength(0);
});

for (const authority of ['absent', 'revoked'] as const) {
  test(`confirmed ${authority} credentials permit one deliberate pairing request`, async ({ page, baseURL }) => {
    const fixture = await installRemoteBackend(page, baseURL!, { session: authority !== 'absent' });
    if (authority === 'revoked') {
      await page.route('**/api/bootstrap', route => route.fulfill({ status: 401, json: { error: 'unauthorized' } }));
      await page.route('**/api/auth/device/refresh', route => route.fulfill({ status: 401, json: { error: 'unauthorized' } }));
    }
    await page.goto('/tv/solid.html');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    if (authority === 'revoked') {
      await expect.poll(() => texts(page)).toContain('Try again');
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'welcome');
    expect(fixture.requests.filter(r => r.path === '/api/auth/device/code')).toHaveLength(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-tv-screen', 'pairing');
    await expect.poll(() => fixture.requests.filter(r => r.path === '/api/auth/device/code').length).toBe(1);
  });
}
