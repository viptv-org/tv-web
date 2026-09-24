#!/usr/bin/env node
// Isolated Chromium-only diagnostic for Blits Home input. Never logs API data.
import { chromium } from '@playwright/test';
import { installBackend, installMediaStubs } from './backend.ts';

const origin = process.env.PERF_PREVIEW_URL ?? 'http://127.0.0.1:4182/tv';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    timezoneId: 'America/New_York', locale: 'en-US', colorScheme: 'dark',
    reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.PERF_CPU_THROTTLE ?? 4) });
  await page.addInitScript(() => {
    window.__inputEvents = [];
    window.__glOps = { drawElements: 0, drawArrays: 0, texImage2D: 0, texSubImage2D: 0 };
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of Object.keys(window.__glOps)) {
        const original = prototype[name];
        if (typeof original !== 'function') continue;
        prototype[name] = function(...args) {
          window.__glOps[name]++;
          return original.apply(this, args);
        };
      }
    }
    window.addEventListener('keydown', event => {
      if (event.key.startsWith('Arrow')) window.__inputEvents.push({ kind: 'down', key: event.key, at: performance.now() });
    }, true);
    window.addEventListener('keyup', event => {
      if (event.key.startsWith('Arrow')) window.__inputEvents.push({ kind: 'up', key: event.key, at: performance.now() });
    }, true);
  });
  const backend = await installBackend(page, { family: 'tv', session: 'ready' });
  await installMediaStubs(page, { frame: '63e024' });
  await page.goto(`${origin}/lightning.html?platform=tizen&focusdebug=1&perfdebug=1`);
  await page.waitForFunction(() => window.__viptvFocus?.view === 'home-action', null, { timeout: 20000 });
  await page.waitForTimeout(Number(process.env.PERF_SETTLE_MS ?? 300));
  const glBefore = await page.evaluate(() => ({ ...window.__glOps }));
  await page.evaluate(() => {
    window.__frameIntervals = [];
    let previous = 0;
    const tick = now => {
      if (previous) window.__frameIntervals.push(now - previous);
      previous = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  const samples = [];
  for (let cycle = 0; cycle < 10; cycle++) {
    for (const [key, index] of [['ArrowRight', 1], ['ArrowRight', 2], ['ArrowLeft', 1], ['ArrowLeft', 0]]) {
      await page.keyboard.down(key);
      await page.waitForFunction(index => window.__viptvFocus?.view === 'home-action' && window.__viptvFocus?.index === index, index, { timeout: 5000 });
      const sample = await page.evaluate(() => ({
        focusAt: window.__viptvFocus?.at,
        events: window.__inputEvents.splice(0),
      }));
      samples.push({ key, ...sample });
      await page.keyboard.up(key);
    }
  }
  const { profile } = await cdp.send('Profiler.stop');
  const indexed = new Map(profile.nodes.map(node => [node.id, node]));
  const count = new Map();
  for (const id of profile.samples ?? []) count.set(id, (count.get(id) ?? 0) + 1);
  const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, ticks]) => {
    const frame = indexed.get(id)?.callFrame;
    return { ticks, name: frame?.functionName, url: frame?.url.split('/').pop(), line: frame?.lineNumber };
  });
  const delays = samples.map(sample => {
    const down = sample.events.find(event => event.kind === 'down' && event.key === sample.key);
    return down ? Number((sample.focusAt - down.at).toFixed(2)) : null;
  });
  if (backend.errors.length) throw new Error(backend.errors.join('; '));
  const frameIntervals = await page.evaluate(() => window.__frameIntervals);
  const glAfter = await page.evaluate(() => ({ ...window.__glOps }));
  const sorted = [...frameIntervals].sort((a, b) => a - b);
  console.log(JSON.stringify({ delays, glCalls: Object.fromEntries(Object.keys(glAfter).map(key => [key, glAfter[key] - glBefore[key]])), frames: {
    count: frameIntervals.length,
    median: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    over33: frameIntervals.filter(value => value > 33.3).length,
    over50: frameIntervals.filter(value => value > 50).length,
  }, top }, null, 2));
} finally {
  await browser.close();
}
