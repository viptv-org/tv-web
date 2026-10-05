import { expect, test } from '@playwright/test';
import { installBackend, installMediaStubs } from '../preview/backend';

for (const mode of ['desktop', 'browser', 'phone'] as const) {
  test(`${mode} keeps its own player backdrop behavior and controls fit`, async ({ page }, testInfo) => {
    const width = mode === 'phone' ? 390 : 1440;
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    const backend = await installBackend(page, { family: mode === 'phone' ? 'phone' : 'desk', sourcesDone: true });
    await installMediaStubs(page);
    await page.goto(`/tv/title/series/tt-monster${mode === 'desktop' ? '?desktop-shell' : ''}`);
    await page.locator('[data-focus-id="episode-0"]').click();
    await page.locator('.sources .vx-source-row').first().click();
    const controls = page.locator('.vx-player--responsive');
    await expect(controls).toBeVisible();
    const buttons = await page.locator('.vx-player__transport .vx-player__control').all();
    for (const button of buttons) {
      const bounds = await button.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    await page.screenshot({ path: testInfo.outputPath(`${mode}-player.png`) });
    await controls.locator('.vx-player__title').click();
    if (mode === 'desktop') await expect(controls).toBeVisible();
    else await expect(controls).toBeHidden();
    expect(backend.errors).toEqual([]);
  });
}
