import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
const state = (page: Page) => page.locator('html');
async function keys(page: Page, ...keys: string[]) { for(const key of keys) await page.keyboard.press(key); }
async function ready(page: Page, screen='home') {
  await expect(state(page)).toHaveAttribute('data-tv-screen',screen);
  await expect(state(page)).toHaveAttribute('data-tv-ready','true');
}

test('navigation closes unavailable slots and omits unsupported server routes', async ({page,baseURL}) => {
  const fixture=await installRemoteBackend(page,baseURL!,{navigation:['home','calendar','movie','library','profiles']});
  await page.goto('/tv/?platform=vizio&focusdebug=1');await ready(page);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','home,movie,library,profiles');
  await keys(page,'ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:0:/);
  await keys(page,'ArrowRight','Enter');await ready(page,'movie');
  await keys(page,'ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:1:/);
  await keys(page,'ArrowRight','Enter');await ready(page,'library');
  await keys(page,'Escape');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:2:/);
  expect(fixture.requests.some(r=>r.path.includes('/live/'))).toBe(false);
});

test('older bootstrap without navigation exposes only the base Home and Profile entry points', async ({page,baseURL}) => {
  await installRemoteBackend(page,baseURL!,{omitNavigation:true});
  await page.goto('/tv/?platform=vizio');await ready(page);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','home,profiles');
  await keys(page,'ArrowUp','ArrowRight','ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:1:/);
  await keys(page,'Enter');await expect(state(page)).toHaveAttribute('data-tv-overlay','choices');
});

test('a revision that removes the current section retires its content to Home', async ({page,baseURL}) => {
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);
  await page.goto('/tv/?platform=vizio');await ready(page);
  await keys(page,'ArrowUp','ArrowRight','Enter');await ready(page,'movie');
  fixture.setNavigation(['home','library','profiles']);
  await page.clock.fastForward(16000);
  await ready(page);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','home,library,profiles');
  await keys(page,'ArrowUp');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:0:/);
});

test('navigation revisions preserve the focused route identity when earlier entries disappear', async ({page,baseURL}) => {
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);
  await page.goto('/tv/?platform=vizio');await ready(page);
  await keys(page,'ArrowUp','ArrowRight','ArrowRight');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:3:/);
  fixture.setNavigation(['search','home','series','library','profiles']);
  await page.clock.fastForward(16000);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','search,home,series,library,profiles');
  await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:2:/);
  await keys(page,'Enter');await ready(page,'series');
});

test('Back cannot revive a now-unavailable catalog from detail history', async ({page,baseURL}) => {
  await page.clock.install();
  const fixture=await installRemoteBackend(page,baseURL!);
  await page.goto('/tv/?platform=vizio');await ready(page);
  await keys(page,'ArrowUp','ArrowRight','Enter');await ready(page,'movie');
  await keys(page,'ArrowDown','Enter');await ready(page,'detail');
  fixture.setNavigation(['home','library','profiles']);
  await page.clock.fastForward(16000);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','home,library,profiles');
  await keys(page,'Escape');await ready(page);
});

test('profile changes replace the previous profiles navigation capabilities', async ({page,baseURL}) => {
  await installRemoteBackend(page,baseURL!,{navigationByProfile:{'2':['home','profiles']}});
  await page.goto('/tv/?platform=vizio');await ready(page);
  await keys(page,'ArrowUp','ArrowRight','ArrowRight','ArrowRight','ArrowRight','ArrowRight','Enter','Enter');
  await ready(page,'profiles');
  await keys(page,'ArrowRight','Enter');await ready(page);
  await expect(state(page)).toHaveAttribute('data-tv-navigation','home,profiles');
  await keys(page,'ArrowUp','ArrowRight');await expect(state(page)).toHaveAttribute('data-tv-focus',/^nav:1:/);
});
