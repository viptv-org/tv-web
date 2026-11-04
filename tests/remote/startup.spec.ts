import { test, expect } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

for (const entry of ['/tv/?platform=vizio', '/tv/?layout=tv', '/tv/solid.html', '/tv/lightning.html']) {
  test(`startup skeleton survives a delayed entry module: ${entry}`, async ({ page, baseURL }) => {
    await installRemoteBackend(page, baseURL!);
    let release!: () => void;
    const held = new Promise<void>(resolve => release = resolve);
    await page.route('**/assets/*.js', async route => {
      await held;
      await route.continue().catch(() => {});
    });
    await page.goto(entry, { waitUntil: 'commit' });
    const startup = page.locator('#solid-startup');
    await expect(startup).toBeVisible();
    const shape = startup.locator('rect').first();
    await expect(shape).toBeVisible();
    expect(await shape.evaluate(element => getComputedStyle(element).fill)).toBe('rgb(23, 23, 26)');
    expect(await shape.boundingBox()).toEqual({ x: 96, y: 470, width: 384, height: 216 });
    release();
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    await expect(startup).toHaveCount(0);
    await expect(page.locator('canvas').first()).toBeVisible();
  });
}
