import { expect, test } from '@playwright/test';
import { installBackend } from './helpers/responsiveBackend';

test('probe tv-screen box', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'vizio');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installBackend(page, { populated: true, activity: true });
  await page.goto('/');
  await page.locator('[data-focus-id="profile-0"]').click();
  await page.waitForTimeout(1500);
  const d = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>('.tv-screen')!;
    const cs = getComputedStyle(screen);
    const rect = screen.getBoundingClientRect();
    return { rectX: rect.x, rectW: rect.width, csLeft: cs.left, csRight: cs.right, csWidth: cs.width, transform: cs.transform, inlineW: screen.style.width, parent: screen.parentElement?.tagName, parentClass: screen.parentElement?.className?.slice?.(0, 50) };
  });
  console.log('BOX:', JSON.stringify(d));
  expect(true).toBe(true);
});
