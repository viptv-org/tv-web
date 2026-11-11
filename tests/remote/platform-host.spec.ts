import { test, expect } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

for (const profile of [
  { platform: 'webos', agent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/87.0.4280.144 Safari/537.36 WebAppManager', back: 461 },
  { platform: 'tizen', agent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.5) Chrome/69.0.3497.106 TV Safari/537.36', back: 10009 },
]) {
  test(`${profile.platform} user-agent boundary selects its host and restores focus with the numeric Back key`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    await page.addInitScript(agent => Object.defineProperty(navigator, 'userAgent', { value: agent }), profile.agent);
    await page.goto('/tv/?focusdebug=1');
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-tv-platform', profile.platform);
    await expect(root).toHaveAttribute('data-tv-screen', 'home');
    await expect(root).toHaveAttribute('data-tv-ready', 'true');
    const focus = await root.getAttribute('data-tv-focus');
    await page.keyboard.press('Enter');
    await expect(root).toHaveAttribute('data-tv-overlay', 'sources');
    await expect(root).toHaveAttribute('data-tv-sources', '8');
    await expect(root).toHaveAttribute('data-tv-ready', 'true');
    await page.evaluate(keyCode => {
      for (const type of ['keydown', 'keyup'])
        document.dispatchEvent(new KeyboardEvent(type, { key: 'Unidentified', keyCode, bubbles: true, cancelable: true }));
    }, profile.back);
    await expect(root).toHaveAttribute('data-tv-overlay', '');
    await expect(root).toHaveAttribute('data-tv-screen', 'home');
    await expect(root).toHaveAttribute('data-tv-focus', focus!);
  });
}

test('legacy Tizen Search retains successful provider results without Promise.allSettled', async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  await page.addInitScript(() => {
    Object.defineProperty(Promise, 'allSettled', { value: undefined, configurable: true, writable: true });
  });
  const queries: string[] = [];
  await page.route('**/api/discover?**', route => {
    const url = new URL(route.request().url());
    queries.push(url.searchParams.get('type')!);
    return url.searchParams.get('type') === 'series'
      ? route.fulfill({ status: 503, json: { error: 'Unavailable provider' } })
      : route.fulfill({ json: { cards: [{ ...fixture.card, title: 'Available movie result' }], complete: true } });
  });
  await page.goto('/tv/?platform=tizen&focusdebug=1');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  for (const key of ['ArrowUp', 'ArrowLeft', 'Enter']) await page.keyboard.press(key);
  await expect(root).toHaveAttribute('data-tv-screen', 'search');
  await page.keyboard.press('a');
  await expect.poll(() => [...new Set(queries)].sort()).toEqual(['movie', 'series']);
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(() => page.evaluate(() => {
    const texts: string[] = [];
    const visit = (node: any) => {
      if (node.isRenderable && node.viptvText) texts.push(node.viptvText);
      node.children?.forEach(visit);
    };
    visit((window as any).__viptvRenderer.stage.root);
    return texts;
  })).toContain('Available movie result');
});
