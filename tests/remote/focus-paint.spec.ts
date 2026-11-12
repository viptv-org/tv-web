import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { installRemoteBackend } from '../preview/remote-backend';
import { temporalFocusPaint } from '../preview/focus-paint';

for (const [canvas, occupied] of [[false, false], [true, false], [true, true]]) {
  test(`focus text retains contrast on every painted frame (${canvas ? 'Canvas' : 'WebGL'}, occupied=${occupied})`, async ({ page, baseURL }, info) => {
    await page.addInitScript(canvas => {
      Object.defineProperty(navigator, 'userAgent', {configurable: true, get: () => 'Mozilla/5.0 (PlayStation 4 12.00) AppleWebKit/605.1.15'});
      if (!canvas) return;
      Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, type: string, ...args: any[]) {
        return type.includes('webgl') ? null : original.apply(this, [type, ...args] as any);
      } as typeof original;
    }, canvas);
    await installRemoteBackend(page, baseURL!);
    await page.route('**/*', route => route.request().url().startsWith(baseURL! + '/') ? route.fallback() : route.abort());
    await page.goto('/tv/?focusdebug=1');
    await expect(page.locator('html')).toHaveAttribute('data-tv-ready', 'true');
    const facts = await temporalFocusPaint(page, occupied);
    const {badFramePng, lastFramePng, ...measurements} = facts;
    if (badFramePng) writeFileSync(info.outputPath('invisible-text-frame.png'), Buffer.from(badFramePng.split(',')[1], 'base64'));
    if (lastFramePng) writeFileSync(info.outputPath('settled-focus-frame.png'), Buffer.from(lastFramePng.split(',')[1], 'base64'));
    writeFileSync(info.outputPath('painted-frames.json'), JSON.stringify(measurements, null, 2));
    await info.attach('painted-frame-contrast', { body: JSON.stringify(measurements), contentType: 'application/json' });
    expect(facts.samples.length).toBeGreaterThanOrEqual(22);
    expect(facts.samples.filter(frame => frame.contrastPixels < 250)).toEqual([]);
    expect(facts.samples.every(frame => frame.pending === 0)).toBe(true);
    expect(facts.samples.every(frame => frame.background < 80 || frame.background > 200)).toBe(true);
    expect(facts.finalBackground).toBeGreaterThan(200);
    expect(facts.maxChildren).toBe(1);
    expect(facts.pendingAfterDestroy).toBe(0);
    expect(facts.remainingChildren).toBe(0);
  });
}
