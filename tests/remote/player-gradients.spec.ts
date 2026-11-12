import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { installRemoteBackend } from '../preview/remote-backend';

const { PNG } = createRequire(import.meta.url)('pngjs');
const mask = createHash('sha256').update(readFileSync('roku/pkg/assets/player-scrim.png')).digest('hex').slice(0, 20) + '.png';
const scrims = (page: Page) => page.evaluate(mask => {
  let count = 0;
  function walk(node: any) {
    if (String(node.texture?.props?.src ?? node.props?.src ?? '').endsWith(mask)) count++;
    node.children?.forEach(walk);
  }
  walk((window as any).__viptvRenderer.stage.root);
  return count;
}, mask);
const samples = (frame: Buffer) => {
  const image = PNG.sync.read(frame);
  return [40, 320, 700, 1030].map(y => {
    const offset = (y * image.width + 1850) * 4;
    return Math.max(...image.data.subarray(offset, offset + 3));
  });
};
const geometry = (page: Page) => page.locator('video').evaluate(video => {
  const rect = video.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, src: (video as HTMLVideoElement).currentSrc };
});

for (const canvas of [false, true]) test(`authored player gradients protect bright video and retire with controls (${canvas ? 'Canvas' : 'WebGL'})`, async ({ page, baseURL }, info) => {
  if (canvas) await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
      return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
    } as typeof original;
  });
  const fixture = await installRemoteBackend(page, baseURL!, { media: true });
  const state = page.locator('html');
  await page.goto('/tv/?focusdebug=1');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect(state).toHaveAttribute('data-tv-sources', '8');
  await expect(state).toHaveAttribute('data-tv-ready', 'true');
  await page.keyboard.press('Enter');
  await expect.poll(() => fixture.requests.some(request => request.path.endsWith('/first-frame'))).toBe(true);
  await page.locator('video').evaluate(video => (video as HTMLVideoElement).pause());
  await expect(state).toHaveAttribute('data-tv-player-state', 'paused');
  await page.keyboard.press('ArrowUp');
  await expect(state).toHaveAttribute('data-tv-player-controls', 'true');
  await expect(state).toHaveAttribute('data-renderer-backend', canvas ? 'canvas' : 'webgl');
  await expect.poll(() => scrims(page)).toBe(1);
  const before = await geometry(page);
  // Wait for the packaged texture to reach the painted frame, not just the tree.
  await expect.poll(async () => samples(await page.screenshot())[3]).toBeLessThan(40);
  const shown = samples(await page.screenshot({ path: info.outputPath('bright-video-controls.png') }));
  await page.keyboard.press('Escape');
  await expect(state).toHaveAttribute('data-tv-player-controls', 'false');
  await expect(state).toHaveAttribute('data-tv-screen', 'player');
  await expect.poll(() => scrims(page)).toBe(0);
  const hidden = samples(await page.screenshot({ path: info.outputPath('bright-video-hidden.png') }));
  hidden.forEach(value => expect(value).toBeGreaterThan(180));
  expect(shown[0]).toBeLessThan(hidden[0] * .4); // authored top protection
  expect(Math.abs(shown[1] - hidden[1])).toBeLessThan(4); // untouched middle; no flat veil
  expect(shown[2]).toBeLessThan(hidden[2] * .25); // bottom midpoint
  expect(shown[3]).toBeLessThan(hidden[3] * .15); // strongest protection at the edge
  expect(await geometry(page)).toEqual(before);
  await page.keyboard.press('ArrowUp');
  await expect(state).toHaveAttribute('data-tv-player-controls', 'true');
  await expect.poll(() => scrims(page)).toBe(1);
  // Stop with the controls visible exercises exit disposal independently of hide.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'MediaStop', keyCode: 413, bubbles: true })));
  await expect(state).not.toHaveAttribute('data-tv-screen', 'player');
  await expect.poll(() => scrims(page)).toBe(0);
  await expect(page.locator('#video-layer')).toBeHidden();
  await page.screenshot({ path: info.outputPath('after-playback-exit.png') });
  await info.attach('gradient-pixels', { body: JSON.stringify({ shown, hidden, geometry: before }), contentType: 'application/json' });
});
