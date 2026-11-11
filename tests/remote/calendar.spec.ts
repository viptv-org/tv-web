import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { openNavigation } from './navigation-helpers';

const state = (page: Page) => page.locator('html');
async function start(page: Page, baseURL: string, empty = false) {
  const fixture = await installRemoteBackend(page, baseURL, { navigation: ['home', 'calendar', 'profiles'] });
  await page.route('**/api/calendar', route => route.fulfill({ json: {
    entries: empty ? [] : [{ id: 'episode', date: '2026-11-11T12:00:00Z', season: 0, episode: 1, card: fixture.cards[0] }], complete: true,
  } }));
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  const index = await openNavigation(page, 'calendar');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'calendar');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  return { fixture, index };
}

test('Calendar returns from its header to the date controls and can open the focused episode', async ({ page, baseURL }) => {
  await start(page, baseURL!);
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^nav:/);
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^calendar-days:/);
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^calendar-list:/);
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'calendar');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^calendar-list:/);
});

test('an empty Calendar never focuses a missing episode or Watch action', async ({ page, baseURL }) => {
  await start(page, baseURL!, true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^calendar-days:/);
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'calendar');
  await page.keyboard.press('ArrowUp');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^nav:/);
  await page.keyboard.press('ArrowDown');
  await expect(state(page)).toHaveAttribute('data-tv-focus', /^calendar-days:/);
});

for (const detail of [false, true]) test(`removing Calendar retires ${detail ? 'its detail history' : 'the current page'}`, async ({ page, baseURL }) => {
  await page.clock.install();
  const { fixture } = await start(page, baseURL!);
  if (detail) {
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(state(page)).toHaveAttribute('data-tv-screen', 'detail');
    await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  }
  fixture.setNavigation(['home', 'profiles']);
  await page.clock.fastForward(16000);
  await expect(state(page)).toHaveAttribute('data-tv-navigation', 'home,anime,profiles');
  if (detail) await page.keyboard.press('Escape');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'home');
});
