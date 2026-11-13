import { expect, test } from '@playwright/test';
import { installRemoteBackend } from '../preview/remote-backend';

for (const canvas of [false, true]) test(`presented sources with nullable metadata save without a warning (${canvas ? 'Canvas' : 'WebGL'})`, async ({ page, baseURL }) => {
  await page.addInitScript(canvas => {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15' });
    if (canvas) {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
        return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
      } as typeof original;
    }
  }, canvas);
  const fixture = await installRemoteBackend(page, baseURL!, { media: true, episodeFlow: true,
    sourcePresentation: { source_id: null, provider_name: null } });
  const state = page.locator('html');
  await page.goto('/tv/?platform=web&focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources', '8');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('viptv-device-playback:v1'))).toContain('addon:fixture');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('viptv-device-playback:v1')!));
  expect(stored.entries.length).toBeGreaterThan(0);
  for (const [, choice] of stored.entries) expect(choice).toEqual({ provider_id: 'addon:fixture', audio_languages: ['en'] });
  const text = await page.evaluate(() => {
    const labels: string[] = [];
    const visit = (node: any) => { if (node.isRenderable && node.viptvText) labels.push(node.viptvText); node.children?.forEach(visit); };
    visit((window as any).__viptvRenderer.stage.root); return labels.join('\n');
  });
  expect(text).not.toContain('Couldn’t save this source choice');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaStop', keyCode: 413, bubbles: true })));
  await expect(state).toHaveAttribute('data-tv-screen', 'home');
});

test('disabled remembered-source reuse makes no device save attempt or warning', async ({ page, baseURL }) => {
  const fixture = await installRemoteBackend(page, baseURL!, { media: true, episodeFlow: true,
    sourcePresentation: { source_id: null, provider_name: null } });
  fixture.bootstrap().preferences!.preferences.remembered_source_reuse = false;
  await page.addInitScript(() => {
    (window as any).__sourceChoiceWrites = 0;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'viptv-device-playback:v1') {
        (window as any).__sourceChoiceWrites++;
        throw new Error('Disabled source choice must not reach storage');
      }
      return original.call(this, key, value);
    };
  });
  await page.goto('/tv/solid.html');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-tv-sources', '8');
  await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(r => r.path.endsWith('/first-frame'))).toBe(true);
  expect(await page.evaluate(() => (window as any).__sourceChoiceWrites)).toBe(0);
  const labels = await page.evaluate(() => {
    const result: string[] = [];
    function visit(node: any) { if (node.isRenderable && node.viptvText) result.push(node.viptvText);node.children?.forEach(visit); }
    visit((window as any).__viptvRenderer.stage.root);return result.join('\n');
  });
  expect(labels).not.toContain('Couldn’t save this source choice');
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaStop', keyCode: 413, bubbles: true })));
});
