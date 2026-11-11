import { expect, type Page } from '@playwright/test';

export async function openNavigation(page: Page, id: string): Promise<number> {
  const state = page.locator('html');
  const ids = (await state.getAttribute('data-tv-navigation'))?.split(',') ?? [];
  const index = ids.indexOf(id);
  expect(index, `Available navigation contains ${id}`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-focus', /^nav:/);
  for (let i = 0; i < ids.length; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  return index;
}
