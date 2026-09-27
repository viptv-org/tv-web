import { test, expect } from '@playwright/test';
import { installBackend } from '../preview/backend';

for (const platform of ['vizio', 'tizen', 'webos']) test(`public ${platform} URL loads native SolidTV, never the React TV tree`, async ({ page }) => {
  test.skip(test.info().project.name !== 'vizio', 'one three-platform launcher audit');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await installBackend(page, {family:'tv',session:'ready',sourcesDone:true});
  await page.goto(`/?platform=${platform}&focusdebug=1`);
  await expect(page.locator('html')).toHaveAttribute('data-renderer','solid');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-action');
  await expect(page.locator('#app canvas')).toHaveCount(1);
  await expect(page.locator('.tv-layout')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'rail-item');
  for(let i=0;i<4;i++) await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'rail-item' && (window as any).__viptvFocus?.index === 6);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-action');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => (window as any).__viptvFocus?.view === 'home-card');
  expect(errors).toEqual([]);
});
