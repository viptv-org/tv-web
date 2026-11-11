import { expect, test, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { openNavigation } from './navigation-helpers';

const state = (page: Page) => page.locator('html');
const texts = (page: Page) => page.evaluate(() => {
  const values: string[] = [];
  function walk(node: any) { if (node.isRenderable && node.viptvText) values.push(node.viptvText); node.children?.forEach(walk); }
  walk((window as any).__viptvRenderer.stage.root);
  return values;
});
async function press(page: Page, ...keys: string[]) { for (const key of keys) await page.keyboard.press(key); }

test('Playback exposes distinct Next, device autoplay, skip, remembered choice and default-source settings', async ({ page, baseURL }, testInfo) => {
  const fixture = await installRemoteBackend(page, baseURL!);
  const preferences = fixture.bootstrap().preferences!;
  preferences.preferences.remembered_source_reuse = true;
  const controls = preferences.controls!;
  controls[0].description = 'Shows during the credits';
  controls[1].description = 'Shows shortcuts when the title provides segment markers';
  controls.splice(2, 0, {
    id: 'remembered_source_reuse', group: 'playback', label: 'Remember source choices',
    description: 'Reuse successful manual choices for this title on this device',
    choices: [{ label: 'On', value: true }, { label: 'Off', value: false }],
  });
  await page.goto('/tv/?focusdebug=1');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await openNavigation(page, 'profiles');
  await press(page, 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-screen', 'settings');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await press(page, 'ArrowRight');
  const shown = await texts(page);
  expect(shown.indexOf('Next episode button')).toBeLessThan(shown.indexOf('Autoplay next episode'));
  expect(shown.indexOf('Autoplay next episode')).toBeLessThan(shown.indexOf('Skip intros and recaps'));
  expect(shown).toContain('Plays the next episode after a 10-second countdown. Applies to this device.');
  await page.screenshot({ path: testInfo.outputPath('playback-settings.png') });
  await press(page, 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('viptv-device-playback:v1') || '{}').autoplay)).toBe(false);
  expect(fixture.requests.filter(request => request.path.endsWith('/preferences') && request.method === 'PUT')).toHaveLength(0);
  await press(page, 'ArrowUp', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  expect(preferences.preferences.next_episode_button).toBe(false);
  await press(page, 'ArrowDown', 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  expect(preferences.preferences.skip_intros).toBe(true);
  await press(page, 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-ready', 'true');
  expect(preferences.preferences.remembered_source_reuse).toBe(false);
  await press(page, 'ArrowDown', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', 'choices');
  await press(page, 'ArrowUp', 'Enter');
  await expect(state(page)).toHaveAttribute('data-tv-overlay', '');
  expect(preferences.preferences.source_selection).toBe('best');
  expect(fixture.requests.filter(request => request.path.endsWith('/preferences') && request.method === 'PUT').every(request => !('autoplay' in request.body.preferences))).toBe(true);
});
