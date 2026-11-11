import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

const state = (page: Page) => page.locator('html');
const exitCount = (page: Page) => page.evaluate(() => (window as any).__exitCount);
async function press(page: Page, ...keys: string[]) {
  for (const key of keys) await page.keyboard.press(key);
}
async function start(page: Page, baseURL: string, session = true) {
  const fixture = await installRemoteBackend(page, baseURL, { session });
  await page.addInitScript(() => {
    (window as any).__exitCount = 0;
    (window as any).tizen = {
      application: { getCurrentApplication: () => ({ exit: () => (window as any).__exitCount++ }) },
    };
  });
  await page.goto('/tv/?platform=tizen&focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  return fixture;
}

for (const zone of ['hero', 'rows', 'nav']) test(`Samsung Home Return confirms exit from ${zone} and defaults to Cancel`, async ({ page, baseURL }, testInfo) => {
  await start(page, baseURL!);
  if (zone === 'rows') await press(page, 'ArrowDown', 'ArrowRight');
  if (zone === 'nav') await press(page, 'ArrowUp', 'ArrowRight');
  const focus = await state(page).getAttribute('data-tv-focus');
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', 'confirm');
  expect(await exitCount(page)).toBe(0);
  if (zone === 'hero') await page.screenshot({ path: testInfo.outputPath('exit-confirmation.png') });
  await press(page, 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  await expect(state(page)).toHaveAttribute('data-tv-focus', focus!);
  expect(await exitCount(page)).toBe(0);
  await press(page, 'Escape', 'ArrowDown', 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  expect(await exitCount(page)).toBe(0);
  await press(page, 'Escape', 'ArrowDown', 'Enter');
  await expect.poll(() => exitCount(page)).toBe(1);
});

test('Samsung Return dismisses a source drawer and detail history before confirming root exit', async ({ page, baseURL }) => {
  await start(page, baseURL!);
  await press(page, 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', 'sources');
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  await press(page, 'ArrowDown', 'ArrowRight', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'home');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  expect(await exitCount(page)).toBe(0);
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', 'confirm');
});

test('Samsung signed-out root confirms exit while Return from pairing goes back to welcome', async ({ page, baseURL }) => {
  await start(page, baseURL!, false);
  await press(page, 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'pairing');
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'welcome');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  await press(page, 'Escape');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', 'confirm');
  await press(page, 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  expect(await exitCount(page)).toBe(0);
});
