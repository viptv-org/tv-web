import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';
import { installTizenSdkBoundary } from '../preview/tizen-sdk';

const stage = process.env.REMOTE_TIZEN_STAGE;
if (!stage) throw Error('Set REMOTE_TIZEN_STAGE to the output of scripts/stage-tizen.mjs.');
const index = resolve(stage, 'index.html');
const html = readFileSync(index, 'utf8');
const configuration = JSON.parse(/<script id="viptv-packaged-host" type="application\/json">([^<]+)<\/script>/.exec(html)![1]);
const entry = pathToFileURL(index).href + '?focusdebug=1';

async function numericBack(page: Page) {
  await page.evaluate(() => {
    for (const type of ['keydown', 'keyup'])
      document.dispatchEvent(new KeyboardEvent(type, { key: 'Unidentified', keyCode: 10009, bubbles: true, cancelable: true }));
  });
}

test('local Tizen closure starts from file assets and sends API requests only to its configured HTTPS origin', async ({ page }) => {
  const fixture = await installRemoteBackend(page, configuration.apiOrigin);
  await installTizenSdkBoundary(page);
  const remoteScripts: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'script' && !request.url().startsWith('file:')) remoteScripts.push(request.url()); });
  await page.goto(entry);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  await expect(root).toHaveAttribute('data-tv-platform', 'tizen');
  await expect(root).toHaveAttribute('data-tv-screen', 'home');
  expect(fixture.requests.some(request => request.path === '/api/bootstrap')).toBe(true);
  expect(remoteScripts).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('local-home.png') });
  const focus = await root.getAttribute('data-tv-focus');
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-tv-sources', '8');
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  await numericBack(page);
  await expect(root).toHaveAttribute('data-tv-overlay', '');
  await expect(root).toHaveAttribute('data-tv-focus', focus!);
});

test('local Tizen SDK boundary preserves the server-selected subtitle and paused replacement', async ({ page }) => {
  await installRemoteBackend(page, configuration.apiOrigin, { media: true, captionTracks: true, captionMedia: true });
  await installTizenSdkBoundary(page);
  await page.goto(entry);
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-tv-sources', '8');
  await expect(root).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-tv-player-state', 'playing');
  await expect(page.locator('#tv-avplay')).toHaveAttribute('type', 'application/avplayer');
  const calls = () => page.evaluate(() => (window as any).__tizenBoundaryCalls);
  await expect.poll(async () => (await calls()).subtitles).toEqual([8]);
  expect((await calls()).keys).toHaveLength(6);
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaPause', keyCode: 19, bubbles: true })));
  await expect(root).toHaveAttribute('data-tv-player-state', 'paused');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-tv-overlay', 'tracks');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
  await expect(root).toHaveAttribute('data-tv-overlay', '');
  await expect(root).toHaveAttribute('data-tv-player-state', 'paused');
  expect((await calls()).pause).toBe(1);
});
